import { closeSync, existsSync, openSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserContext, BrowserContextOptions } from "playwright-core";
import { chromium } from "playwright-core";
import { env } from "~/env";

const DEFAULT_OPERATION_TIMEOUT_MS = 90_000;
const STALE_LOCK_MS = 2 * DEFAULT_OPERATION_TIMEOUT_MS;
const HOST_LOCK_PATH = join(tmpdir(), "persona-olx-browser.lock");

const COMMON_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
] as const;

type OlxRuntimeState = typeof globalThis & {
  __personaOlxBrowserBusy?: boolean;
};

const runtimeState = globalThis as OlxRuntimeState;

function acquireHostLock(): number {
  try {
    return openSync(HOST_LOCK_PATH, "wx", 0o600);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;

    // A killed worker can leave the file behind. Reclaim it only after twice
    // the hard browser timeout, then rely on O_EXCL again to settle races.
    let ageMs: number;
    try {
      ageMs = Date.now() - statSync(HOST_LOCK_PATH).mtimeMs;
    } catch (statError) {
      if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
        return acquireHostLock();
      }
      throw statError;
    }
    if (ageMs <= STALE_LOCK_MS) {
      throw new OlxBrowserRuntimeError(
        "busy",
        "Another OLX browser operation is already running on this host",
      );
    }
    try {
      unlinkSync(HOST_LOCK_PATH);
    } catch (unlinkError) {
      if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") {
        throw unlinkError;
      }
    }
    try {
      return openSync(HOST_LOCK_PATH, "wx", 0o600);
    } catch (retryError) {
      if ((retryError as NodeJS.ErrnoException).code === "EEXIST") {
        throw new OlxBrowserRuntimeError(
          "busy",
          "Another OLX browser operation acquired the host lock",
        );
      }
      throw retryError;
    }
  }
}

function releaseHostLock(fileDescriptor: number): void {
  closeSync(fileDescriptor);
  try {
    unlinkSync(HOST_LOCK_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export type OlxStorageState = Exclude<
  BrowserContextOptions["storageState"],
  string | undefined
>;

export class OlxBrowserRuntimeError extends Error {
  constructor(
    readonly code: "busy" | "unavailable" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "OlxBrowserRuntimeError";
  }
}

export function resolveOlxBrowserExecutable(): string | null {
  const candidates = [
    env.OLX_BROWSER_EXECUTABLE_PATH,
    ...COMMON_CHROME_PATHS,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * Runs one short-lived OLX browser operation at a time in this server process.
 * Requests are rejected while busy instead of accumulating a queue or launching
 * more Chrome processes.
 */
export async function withOlxBrowser<T>(
  options: { storageState?: OlxStorageState; timeoutMs?: number },
  operation: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  if (runtimeState.__personaOlxBrowserBusy) {
    throw new OlxBrowserRuntimeError(
      "busy",
      "Another OLX browser operation is already running",
    );
  }

  const hostLock = acquireHostLock();

  const executablePath = resolveOlxBrowserExecutable();
  if (!executablePath) {
    releaseHostLock(hostLock);
    throw new OlxBrowserRuntimeError(
      "unavailable",
      "Chrome or Chromium is not installed or configured",
    );
  }

  runtimeState.__personaOlxBrowserBusy = true;
  const browser = await chromium
    .launch({
      executablePath,
      headless: true,
      args:
        env.OLX_BROWSER_NO_SANDBOX === "true"
          ? ["--no-sandbox", "--disable-setuid-sandbox"]
          : [],
    })
    .catch((error: unknown) => {
      runtimeState.__personaOlxBrowserBusy = false;
      releaseHostLock(hostLock);
      throw new OlxBrowserRuntimeError(
        "unavailable",
        `Could not start Chrome: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void browser.close();
  }, options.timeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS);

  try {
    const context = await browser.newContext({
      locale: "ru-RU",
      timezoneId: "Asia/Tashkent",
      viewport: { width: 1365, height: 768 },
      storageState: options.storageState,
    });

    // Fonts and video are not needed to complete forms. Images remain enabled
    // because OLX may use them in a user-visible verification challenge.
    await context.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === "font" || resourceType === "media") {
        await route.abort();
        return;
      }
      await route.continue();
    });

    const result = await operation(context);
    if (timedOut) {
      throw new OlxBrowserRuntimeError(
        "timeout",
        "The OLX browser operation timed out",
      );
    }
    return result;
  } catch (error) {
    if (timedOut) {
      throw new OlxBrowserRuntimeError(
        "timeout",
        "The OLX browser operation timed out",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await browser.close().catch(() => undefined);
    runtimeState.__personaOlxBrowserBusy = false;
    releaseHostLock(hostLock);
  }
}
