import { access, constants } from "node:fs/promises";
import { env } from "~/env";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_CHARS = 2_000_000;

const COMMON_BROWSER_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];

let detectedExecutable: Promise<string> | undefined;

async function isExecutable(path: string) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function detectBrowserExecutable() {
  const configured = env.OLX_BROWSER_EXECUTABLE_PATH;
  if (configured) {
    if (await isExecutable(configured)) return configured;
    throw new Error("OLX browser executable is not accessible");
  }

  for (const candidate of COMMON_BROWSER_PATHS) {
    if (await isExecutable(candidate)) return candidate;
  }
  throw new Error(
    "Chrome or Chromium is required for OLX authenticated requests",
  );
}

async function browserExecutable() {
  detectedExecutable ??= detectBrowserExecutable();
  return detectedExecutable;
}

function inputUrl(input: URL | RequestInfo) {
  if (input instanceof URL) return input.toString();
  if (typeof input === "string") return input;
  return input.url;
}

export function cookieHeaderToBrowserCookies(
  header: string,
  origin: string,
): Array<{ name: string; value: string; url: string }> {
  return header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    const name = part.slice(0, separator).trim();
    if (separator < 1 || !name) return [];
    return [
      {
        name,
        value: part.slice(separator + 1).trim(),
        url: origin,
      },
    ];
  });
}

const BROWSER_MANAGED_HEADERS = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "cookie",
  "host",
  "origin",
  "referer",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "user-agent",
]);

export function browserSafeHeaders(init: RequestInit) {
  const result: Record<string, string> = {};
  new Headers(init.headers).forEach((value, name) => {
    if (!BROWSER_MANAGED_HEADERS.has(name.toLowerCase())) result[name] = value;
  });
  return result;
}

type BrowserFetchResult = {
  body: string;
  headers: Array<[string, string]>;
  status: number;
  statusText: string;
};

/**
 * Performs one OLX API request through a short-lived real Chromium network
 * context. No OLX page is automated and the process is closed after the
 * response, so there is no idle browser resource usage.
 */
export async function fetchOlxWithBrowser(
  input: URL | RequestInfo,
  init: RequestInit = {},
): Promise<Response> {
  const targetUrl = inputUrl(input);
  const target = new URL(targetUrl);
  if (target.protocol !== "https:" || !target.hostname.endsWith("olx.uz")) {
    throw new Error("OLX browser transport rejected a non-OLX destination");
  }

  const headers = new Headers(init.headers);
  const cookieHeader = headers.get("cookie") ?? "";
  const userAgent = headers.get("user-agent") ?? undefined;
  const method = init.method?.toUpperCase() ?? "GET";
  const body = init.body;
  if (body != null && typeof body !== "string") {
    throw new Error(
      "OLX browser transport supports string request bodies only",
    );
  }

  const { chromium } = await import("playwright-core");
  const executablePath = await browserExecutable();
  const noSandbox = env.OLX_BROWSER_NO_SANDBOX === "true";
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    chromiumSandbox: !noSandbox,
    timeout: REQUEST_TIMEOUT_MS,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      ...(noSandbox ? ["--no-sandbox"] : []),
    ],
  });

  try {
    const context = await browser.newContext({
      locale: "ru-RU",
      serviceWorkers: "block",
      ...(userAgent ? { userAgent } : {}),
    });
    if (cookieHeader) {
      await context.addCookies(
        cookieHeaderToBrowserCookies(cookieHeader, target.origin),
      );
    }

    const page = await context.newPage();
    const bootstrapUrl = `${target.origin}/robots.txt`;
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (
        request.url() === targetUrl ||
        (request.resourceType() === "document" &&
          request.url().startsWith(target.origin))
      ) {
        await route.continue();
        return;
      }
      await route.abort();
    });
    await page.goto(bootstrapUrl, {
      waitUntil: "domcontentloaded",
      timeout: REQUEST_TIMEOUT_MS,
    });

    const result = await page.evaluate<
      BrowserFetchResult,
      {
        body?: string;
        headers: Record<string, string>;
        method: string;
        maxResponseChars: number;
        timeoutMs: number;
        url: string;
      }
    >(
      async (request) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(
          () => controller.abort(),
          request.timeoutMs,
        );
        try {
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            ...(request.body == null ? {} : { body: request.body }),
            credentials: "include",
            signal: controller.signal,
          });
          return {
            body: (await response.text()).slice(0, request.maxResponseChars),
            headers: Array.from(response.headers.entries()),
            status: response.status,
            statusText: response.statusText,
          };
        } finally {
          window.clearTimeout(timeout);
        }
      },
      {
        url: targetUrl,
        method,
        headers: browserSafeHeaders(init),
        ...(body == null ? {} : { body }),
        maxResponseChars: MAX_RESPONSE_CHARS,
        timeoutMs: REQUEST_TIMEOUT_MS,
      },
    );

    const hasNoBody = [101, 204, 205, 304].includes(result.status);
    return new Response(hasNoBody ? null : result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
  } finally {
    await browser.close().catch(() => undefined);
  }
}
