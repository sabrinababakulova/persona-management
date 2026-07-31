import { spawn } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "../src/server/db";
import {
  companies,
  telegramResumeImports,
  vacancies,
} from "../src/server/db/schema";
import {
  getTelegramBotProfile,
  getTelegramChat,
  getTelegramChatMember,
  getTelegramWebhookInfo,
} from "../src/server/services/telegram";

const DEFAULT_CHAT_ID = "-4910953100";
const DEFAULT_COMPANY_NAME = "Default Company";
const DEFAULT_VACANCY_TITLE = "placeholder-vacancy";
const CRON_MARKER = "persona-management-telegram-resume-ingestion";

type SetupOptions = {
  chatId: string;
  companyName: string;
  vacancyTitle: string;
  envFile: string;
  installCron: boolean;
};

function readOption(name: string) {
  const inline = process.argv.find((argument) =>
    argument.startsWith(`${name}=`),
  );
  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseOptions(): SetupOptions {
  return {
    chatId:
      readOption("--chat-id") ??
      process.env.TELEGRAM_RESUME_CHAT_ID ??
      DEFAULT_CHAT_ID,
    companyName: readOption("--company-name") ?? DEFAULT_COMPANY_NAME,
    vacancyTitle: readOption("--vacancy-title") ?? DEFAULT_VACANCY_TITLE,
    envFile: path.resolve(readOption("--env-file") ?? ".env.local"),
    installCron: !process.argv.includes("--no-cron"),
  };
}

function assertOptions(options: SetupOptions) {
  if (!/^-?\d+$/.test(options.chatId)) {
    throw new Error("--chat-id must be a numeric Telegram chat id");
  }
  if (!options.companyName.trim() || options.companyName.length > 255) {
    throw new Error("--company-name must contain 1-255 characters");
  }
  if (!options.vacancyTitle.trim() || options.vacancyTitle.length > 255) {
    throw new Error("--vacancy-title must contain 1-255 characters");
  }
}

async function verifyTelegram(chatId: string) {
  const bot = await getTelegramBotProfile();
  const chat = await getTelegramChat(chatId);
  const membership = await getTelegramChatMember(chatId, bot.id);
  if (membership.status === "left" || membership.status === "kicked") {
    throw new Error("The Telegram bot is not a member of the configured group");
  }
  const receivesAllMessages =
    membership.status === "administrator" ||
    membership.status === "creator" ||
    bot.can_read_all_group_messages === true;

  if (!receivesAllMessages) {
    throw new Error(
      "The Telegram bot cannot receive ordinary group documents. Make it an " +
        "administrator, or disable Group Privacy in BotFather and re-add it.",
    );
  }
  if (chat.has_protected_content) {
    throw new Error(
      "The Telegram group has protected content enabled and cannot be imported",
    );
  }

  const webhook = await getTelegramWebhookInfo();

  return {
    bot: bot.username ? `@${bot.username}` : String(bot.id),
    chat: chat.title ?? String(chat.id),
    webhook: {
      configured: Boolean(webhook.url),
      url: webhook.url || null,
      pendingUpdates: webhook.pending_update_count,
      lastError: webhook.last_error_message ?? null,
    },
  };
}

async function ensureCompanyAndVacancy(
  companyName: string,
  vacancyTitle: string,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('telegram-resume-bootstrap'))`,
    );

    let [company] = await tx
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.name, companyName))
      .orderBy(asc(companies.createdAt))
      .limit(1);
    let companyCreated = false;

    if (!company) {
      [company] = await tx
        .insert(companies)
        .values({ name: companyName })
        .returning({ id: companies.id, name: companies.name });
      companyCreated = true;
    }
    if (!company) {
      throw new Error("Failed to create the Telegram resume company");
    }

    let [vacancy] = await tx
      .select({
        id: vacancies.id,
        title: vacancies.title,
        isInternal: vacancies.isInternal,
      })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.companyId, company.id),
          eq(vacancies.title, vacancyTitle),
          eq(vacancies.isPublication, false),
        ),
      )
      .orderBy(asc(vacancies.createdAt))
      .limit(1);
    let vacancyCreated = false;

    if (!vacancy) {
      const vacancyId = crypto.randomUUID();
      [vacancy] = await tx
        .insert(vacancies)
        .values({
          id: vacancyId,
          parentId: vacancyId,
          title: vacancyTitle,
          status: "active",
          responses: 0,
          salaryCurrency: "UZS",
          companyId: company.id,
          isPublication: false,
          isInternal: true,
          isActive: false,
        })
        .returning({
          id: vacancies.id,
          title: vacancies.title,
          isInternal: vacancies.isInternal,
        });
      vacancyCreated = true;
    }
    if (!vacancy) {
      throw new Error("Failed to create the Telegram resume vacancy");
    }
    if (!vacancy.isInternal) {
      [vacancy] = await tx
        .update(vacancies)
        .set({ isInternal: true })
        .where(eq(vacancies.id, vacancy.id))
        .returning({
          id: vacancies.id,
          title: vacancies.title,
          isInternal: vacancies.isInternal,
        });
    }
    if (!vacancy) {
      throw new Error("Failed to mark the Telegram resume vacancy as internal");
    }

    return {
      company,
      companyCreated,
      vacancy,
      vacancyCreated,
    };
  });
}

async function verifyDatabaseSchema() {
  try {
    await db
      .select({ id: telegramResumeImports.id })
      .from(telegramResumeImports)
      .limit(1);
  } catch (error) {
    throw new Error(
      "Telegram resume database schema is missing or unavailable. Run " +
        "`bun run db:push` and retry the setup.",
      { cause: error },
    );
  }
}

function quoteEnvValue(value: string) {
  return JSON.stringify(value);
}

function upsertEnvContent(original: string, values: Record<string, string>) {
  const lines = original.split(/\r?\n/);
  const remaining = new Map(Object.entries(values));
  const updated = lines.map((line) => {
    for (const [key, value] of remaining) {
      if (new RegExp(`^\\s*${key}\\s*=`).test(line)) {
        remaining.delete(key);
        return `${key}=${quoteEnvValue(value)}`;
      }
    }
    return line;
  });

  if (remaining.size > 0 && updated.at(-1)?.trim()) {
    updated.push("");
  }
  for (const [key, value] of remaining) {
    updated.push(`${key}=${quoteEnvValue(value)}`);
  }

  return `${updated.join("\n").replace(/\n+$/, "")}\n`;
}

async function updateEnvFile(envFile: string, values: Record<string, string>) {
  let original = "";
  let mode = 0o600;
  try {
    original = await readFile(envFile, "utf8");
    mode = (await stat(envFile)).mode & 0o777;
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }

  const temporary = `${envFile}.telegram-resume-${process.pid}.tmp`;
  await writeFile(temporary, upsertEnvContent(original, values), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(temporary, mode);
  await rename(temporary, envFile);
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function readCrontab() {
  const { stdout, stderr, exitCode } = await runProcess("crontab", ["-l"]);
  if (exitCode !== 0 && !stderr.toLowerCase().includes("no crontab")) {
    throw new Error(`Unable to read crontab: ${stderr.trim()}`);
  }
  return stdout;
}

function runProcess(command: string, args: string[], input?: string) {
  return new Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? 1,
      });
    });
    child.stdin.end(input);
  });
}

function withoutManagedCron(crontab: string) {
  return crontab
    .split(/\r?\n/)
    .filter((line) => !line.includes(CRON_MARKER))
    .join("\n")
    .replace(/\n+$/, "");
}

function getRequiredRuntimeValue(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required by the installed Telegram resume worker`,
    );
  }
  return value;
}

async function verifyDirectusStorageToken() {
  const baseUrl = (
    process.env.DIRECTUS_INTERNAL_URL ?? getRequiredRuntimeValue("DIRECTUS_URL")
  ).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/users/me?fields=id`, {
    headers: {
      Authorization: `Bearer ${getRequiredRuntimeValue("DIRECTUS_TOKEN")}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Directus rejected DIRECTUS_TOKEN (${response.status}). Run ` +
        "`bun run directus:token:repair`, then retry this setup.",
    );
  }
}

async function writePrivateEnvFile(
  envFile: string,
  values: Record<string, string>,
) {
  const temporary = `${envFile}.${process.pid}.tmp`;
  const content = Object.entries(values)
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`)
    .join("\n");
  await writeFile(temporary, `${content}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await rename(temporary, envFile);
}

async function prepareMacOsCronRuntime(
  appDir: string,
  resumeConfig: {
    chatId: string;
    companyId: string;
    vacancyId: string;
  },
) {
  const workerDir = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "persona-management",
    "telegram-resume-worker",
  );
  await mkdir(workerDir, { recursive: true, mode: 0o700 });
  const stagingDir = await mkdtemp(path.join(workerDir, ".staging-"));

  try {
    const build = await runProcess(process.execPath, [
      "build",
      path.join(appDir, "scripts", "drain-telegram-resumes.ts"),
      "--target=bun",
      "--outdir",
      stagingDir,
    ]);
    if (build.exitCode !== 0) {
      throw new Error(
        `Unable to bundle the macOS cron worker: ${build.stderr.trim()}`,
      );
    }

    const runnerName = "telegram-resumes-worker-cron.sh";
    await copyFile(
      path.join(appDir, "scripts", runnerName),
      path.join(stagingDir, runnerName),
    );
    await chmod(path.join(stagingDir, runnerName), 0o700);

    for (const fileName of ["drain-telegram-resumes.js", runnerName]) {
      await rename(
        path.join(stagingDir, fileName),
        path.join(workerDir, fileName),
      );
    }
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  const runtimeEnvFile = path.join(workerDir, "runtime.env");
  const runtimeValues: Record<string, string> = {
    SKIP_ENV_VALIDATION: "1",
    NODE_ENV: process.env.NODE_ENV ?? "production",
    AUTH_SECRET: getRequiredRuntimeValue("AUTH_SECRET"),
    DATABASE_URL: getRequiredRuntimeValue("DATABASE_URL"),
    DIRECTUS_URL: getRequiredRuntimeValue("DIRECTUS_URL"),
    DIRECTUS_TOKEN: getRequiredRuntimeValue("DIRECTUS_TOKEN"),
    GOOGLE_GENERATIVE_AI_API_KEY: getRequiredRuntimeValue(
      "GOOGLE_GENERATIVE_AI_API_KEY",
    ),
    TELEGRAM_BOT_TOKEN: getRequiredRuntimeValue("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_RESUME_CHAT_ID: resumeConfig.chatId,
    TELEGRAM_RESUME_COMPANY_ID: resumeConfig.companyId,
    TELEGRAM_RESUME_VACANCY_ID: resumeConfig.vacancyId,
  };
  for (const optionalName of [
    "RESUME_STORAGE_PATH",
    "DIRECTUS_INTERNAL_URL",
    "DIRECTUS_PUBLIC_URL",
    "DIRECTUS_FOLDER",
    "TELEGRAM_WEBHOOK_SECRET",
  ]) {
    const value = process.env[optionalName];
    if (value) {
      runtimeValues[optionalName] = value;
    }
  }
  await writePrivateEnvFile(runtimeEnvFile, runtimeValues);

  return {
    runner: path.join(workerDir, "telegram-resumes-worker-cron.sh"),
    envFile: runtimeEnvFile,
    workerDir,
    logFile: path.join(workerDir, "telegram-resumes-cron.log"),
  };
}

async function installCron(
  appDir: string,
  envFile: string,
  resumeConfig: {
    chatId: string;
    companyId: string;
    vacancyId: string;
  },
) {
  const sourceCronScript = path.join(
    appDir,
    "scripts",
    "telegram-resumes-worker-cron.sh",
  );
  await chmod(sourceCronScript, 0o755);
  const runtime =
    process.platform === "darwin"
      ? await prepareMacOsCronRuntime(appDir, resumeConfig)
      : {
          runner: sourceCronScript,
          envFile,
          workerDir: null,
          logFile: path.join(
            appDir,
            "storage",
            "logs",
            "telegram-resumes-cron.log",
          ),
        };
  await mkdir(path.dirname(runtime.logFile), {
    recursive: true,
    mode: 0o700,
  });

  const existing = withoutManagedCron(await readCrontab());
  const environment =
    `BUN_BIN=${shellQuote(process.execPath)} ` +
    `TELEGRAM_RESUME_ENV_FILE=${shellQuote(runtime.envFile)} ` +
    (runtime.workerDir
      ? `TELEGRAM_RESUME_WORKER_DIR=${shellQuote(runtime.workerDir)} `
      : "") +
    shellQuote(runtime.runner);
  const cronLine =
    `* * * * * ${environment} >> ${shellQuote(runtime.logFile)} 2>&1 ` +
    `# ${CRON_MARKER}`;
  const nextCrontab = `${existing ? `${existing}\n` : ""}${cronLine}\n`;

  const { stderr, exitCode } = await runProcess("crontab", ["-"], nextCrontab);
  if (exitCode !== 0) {
    throw new Error(`Unable to install crontab: ${stderr.trim()}`);
  }

  return { cronLine, logFile: runtime.logFile };
}

async function main() {
  const options = parseOptions();
  assertOptions(options);
  const appDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );

  await verifyDatabaseSchema();
  await verifyDirectusStorageToken();
  const telegram = await verifyTelegram(options.chatId);
  const database = await ensureCompanyAndVacancy(
    options.companyName.trim(),
    options.vacancyTitle.trim(),
  );
  await updateEnvFile(options.envFile, {
    TELEGRAM_RESUME_CHAT_ID: options.chatId,
    TELEGRAM_RESUME_COMPANY_ID: database.company.id,
    TELEGRAM_RESUME_VACANCY_ID: database.vacancy.id,
  });
  const cron = options.installCron
    ? await installCron(appDir, options.envFile, {
        chatId: options.chatId,
        companyId: database.company.id,
        vacancyId: database.vacancy.id,
      })
    : null;
  console.log(
    JSON.stringify(
      {
        telegram: {
          bot: telegram.bot,
          chat: telegram.chat,
          webhook: telegram.webhook,
        },
        company: {
          ...database.company,
          created: database.companyCreated,
        },
        vacancy: {
          ...database.vacancy,
          created: database.vacancyCreated,
        },
        environmentFile: options.envFile,
        cron: cron
          ? { installed: true, schedule: "every minute", logFile: cron.logFile }
          : { installed: false },
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
