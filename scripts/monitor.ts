import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import postgres from "postgres";

const execFileAsync = promisify(execFile);

type AlertSeverity = "warning" | "critical" | "recovery";

type AlertRecord = {
  active: boolean;
  lastSentAt?: string;
};

type AlertState = Record<string, AlertRecord>;

type TriggeredAlert = {
  key: string;
  title: string;
  body: string;
  severity: AlertSeverity;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const env = {
  databaseUrl: must("DATABASE_URL"),
  healthcheckUrl:
    process.env.MONITOR_HEALTHCHECK_URL ?? "http://127.0.0.1:3000/api/health",
  diskPath: process.env.MONITOR_DISK_PATH ?? "/",
  cpuThreshold: numberFromEnv("MONITOR_CPU_THRESHOLD_PERCENT", 85),
  memoryThreshold: numberFromEnv("MONITOR_MEMORY_THRESHOLD_PERCENT", 90),
  diskThreshold: numberFromEnv("MONITOR_DISK_THRESHOLD_PERCENT", 85),
  requestSpikeThreshold: numberFromEnv("MONITOR_REQUEST_SPIKE_THRESHOLD", 300),
  requestSpikeWindowMinutes: numberFromEnv(
    "MONITOR_REQUEST_SPIKE_WINDOW_MINUTES",
    5,
  ),
  authFailureThreshold: numberFromEnv("MONITOR_AUTH_FAILURE_THRESHOLD", 10),
  authFailureWindowMinutes: numberFromEnv(
    "MONITOR_AUTH_FAILURE_WINDOW_MINUTES",
    15,
  ),
  cooldownMinutes: numberFromEnv("MONITOR_ALERT_COOLDOWN_MINUTES", 30),
  stateFile:
    process.env.MONITOR_STATE_FILE ??
    path.join(projectRoot, "storage", "monitor", "alert-state.json"),
  channels: (process.env.ALERT_CHANNELS ?? "email")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};

function must(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberFromEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

async function readAlertState(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as AlertState;
  } catch {
    return {};
  }
}

async function writeAlertState(filePath: string, state: AlertState) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function shouldSend(record: AlertRecord | undefined, now: Date) {
  if (!record?.active || !record.lastSentAt) {
    return true;
  }

  const elapsedMs = now.getTime() - new Date(record.lastSentAt).getTime();
  return elapsedMs >= env.cooldownMinutes * 60_000;
}

async function getDiskUsagePercent(targetPath: string) {
  const { stdout } = await execFileAsync("df", ["-Pk", targetPath], {
    cwd: projectRoot,
  });
  const lines = stdout.trim().split("\n");
  const lastLine = lines.at(-1);

  if (!lastLine) {
    throw new Error(`Unable to read disk usage for ${targetPath}`);
  }

  const columns = lastLine.trim().split(/\s+/);
  const percent = columns[4]?.replace("%", "");
  const value = Number(percent);

  if (!Number.isFinite(value)) {
    throw new Error(`Unexpected df output for ${targetPath}: ${lastLine}`);
  }

  return value;
}

async function checkHealth() {
  try {
    const response = await fetch(env.healthcheckUrl, {
      signal: AbortSignal.timeout(5_000),
    });
    const payload = (await response.json().catch(() => null)) as {
      status?: string;
      components?: Record<string, { status?: string; message?: string }>;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        message:
          payload?.components &&
          Object.entries(payload.components)
            .filter(([, value]) => value.status === "error")
            .map(([key, value]) => `${key}: ${value.message ?? "failed"}`)
            .join(", "),
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Healthcheck failed",
    };
  }
}

async function getEventCount(
  sqlClient: postgres.Sql,
  eventType: string,
  outcomes: string[],
  minutes: number,
) {
  const since = new Date(Date.now() - minutes * 60_000);
  const rows = await sqlClient<[{ total: string | number | null }]>`
    select coalesce(sum("count"), 0) as total
    from "monitor_event_bucket"
    where "eventType" = ${eventType}
      and "bucketStart" >= ${since}
      and "outcome" = any(${sqlClient.array(outcomes)})
  `;

  return Number(rows[0]?.total ?? 0);
}

function renderMessage(alert: TriggeredAlert) {
  return `[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.body}`;
}

async function sendEmail(message: string) {
  const smtpUser = process.env.ALERT_SMTP_USER ?? process.env.MAIL_LOGIN;
  const smtpPass =
    process.env.ALERT_SMTP_PASS ?? process.env.MAIL_LOGIN_PASSWORD;
  const smtpHost = process.env.ALERT_SMTP_HOST ?? "smtp.yandex.ru";
  const smtpPort = numberFromEnv("ALERT_SMTP_PORT", 465);
  const smtpSecure = (process.env.ALERT_SMTP_SECURE ?? "true") === "true";
  const to = process.env.ALERT_EMAIL_TO;

  if (!smtpUser || !smtpPass || !to) {
    throw new Error(
      "Email alerts require ALERT_EMAIL_TO and SMTP credentials.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM ?? smtpUser,
    to,
    subject: "Persona Management monitor alert",
    text: message,
  });
}

async function sendTelegram(message: string) {
  const botToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error(
      "Telegram alerts require ALERT_TELEGRAM_BOT_TOKEN and ALERT_TELEGRAM_CHAT_ID.",
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram send failed with ${response.status}`);
  }
}

async function sendSms(message: string) {
  const sid = process.env.ALERT_TWILIO_ACCOUNT_SID;
  const token = process.env.ALERT_TWILIO_AUTH_TOKEN;
  const from = process.env.ALERT_TWILIO_FROM;
  const to = process.env.ALERT_SMS_TO;

  if (!sid || !token || !from || !to) {
    throw new Error(
      "SMS alerts require ALERT_TWILIO_ACCOUNT_SID, ALERT_TWILIO_AUTH_TOKEN, ALERT_TWILIO_FROM, and ALERT_SMS_TO.",
    );
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: message,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Twilio send failed with ${response.status}`);
  }
}

function getConfiguredChannels() {
  return env.channels.filter((channel) => {
    if (channel === "email") {
      const smtpUser = process.env.ALERT_SMTP_USER ?? process.env.MAIL_LOGIN;
      const smtpPass =
        process.env.ALERT_SMTP_PASS ?? process.env.MAIL_LOGIN_PASSWORD;
      return Boolean(process.env.ALERT_EMAIL_TO && smtpUser && smtpPass);
    }

    if (channel === "telegram") {
      return Boolean(
        process.env.ALERT_TELEGRAM_BOT_TOKEN &&
          process.env.ALERT_TELEGRAM_CHAT_ID,
      );
    }

    if (channel === "sms") {
      return Boolean(
        process.env.ALERT_TWILIO_ACCOUNT_SID &&
          process.env.ALERT_TWILIO_AUTH_TOKEN &&
          process.env.ALERT_TWILIO_FROM &&
          process.env.ALERT_SMS_TO,
      );
    }

    return false;
  });
}

async function dispatchAlert(alert: TriggeredAlert) {
  const message = renderMessage(alert);
  const configuredChannels = getConfiguredChannels();

  if (configuredChannels.length === 0) {
    console.warn(
      "Monitor alert triggered but no delivery channel is fully configured.",
    );
    return;
  }

  for (const channel of configuredChannels) {
    if (channel === "email") {
      await sendEmail(message);
      continue;
    }

    if (channel === "telegram") {
      await sendTelegram(message);
      continue;
    }

    if (channel === "sms") {
      await sendSms(message);
      continue;
    }

    throw new Error(`Unsupported ALERT_CHANNELS value: ${channel}`);
  }
}

async function main() {
  const now = new Date();
  const sqlClient = postgres(env.databaseUrl, { max: 1 });
  const state = await readAlertState(env.stateFile);
  const nextState: AlertState = { ...state };
  const alerts: TriggeredAlert[] = [];
  let metricsDbAlertAdded = false;

  try {
    const cpuPercent = ((os.loadavg()[0] ?? 0) / os.cpus().length) * 100;
    if (cpuPercent >= env.cpuThreshold) {
      alerts.push({
        key: "cpu",
        title: "CPU threshold exceeded",
        body: `1-minute load is ${formatPercent(cpuPercent)} (threshold ${formatPercent(env.cpuThreshold)}).`,
        severity: "warning",
      });
    }

    const memoryPercent =
      ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    if (memoryPercent >= env.memoryThreshold) {
      alerts.push({
        key: "memory",
        title: "Memory threshold exceeded",
        body: `Memory usage is ${formatPercent(memoryPercent)} (threshold ${formatPercent(env.memoryThreshold)}).`,
        severity: "warning",
      });
    }

    const diskPercent = await getDiskUsagePercent(env.diskPath);
    if (diskPercent >= env.diskThreshold) {
      alerts.push({
        key: "disk",
        title: "Disk threshold exceeded",
        body: `Disk usage for ${env.diskPath} is ${formatPercent(diskPercent)} (threshold ${formatPercent(env.diskThreshold)}).`,
        severity: "critical",
      });
    }

    try {
      const requestCount = await getEventCount(
        sqlClient,
        "api_request",
        ["success", "client_error", "server_error"],
        env.requestSpikeWindowMinutes,
      );
      if (requestCount >= env.requestSpikeThreshold) {
        alerts.push({
          key: "request-spike",
          title: "Request spike detected",
          body: `${requestCount} API requests were recorded in the last ${env.requestSpikeWindowMinutes} minute(s) (threshold ${env.requestSpikeThreshold}).`,
          severity: "warning",
        });
      }
    } catch (error) {
      if (!metricsDbAlertAdded) {
        alerts.push({
          key: "metrics-db",
          title: "Metrics database query failed",
          body:
            error instanceof Error
              ? error.message
              : "Unable to query API request metrics.",
          severity: "critical",
        });
        metricsDbAlertAdded = true;
      }
    }

    try {
      const authFailures = await getEventCount(
        sqlClient,
        "auth_attempt",
        ["failure", "rate_limited", "registration_failed", "invalid_data"],
        env.authFailureWindowMinutes,
      );
      if (authFailures >= env.authFailureThreshold) {
        alerts.push({
          key: "auth-failures",
          title: "Auth failure threshold exceeded",
          body: `${authFailures} auth failures were recorded in the last ${env.authFailureWindowMinutes} minute(s) (threshold ${env.authFailureThreshold}).`,
          severity: "warning",
        });
      }
    } catch (error) {
      if (!metricsDbAlertAdded) {
        alerts.push({
          key: "metrics-db",
          title: "Metrics database query failed",
          body:
            error instanceof Error
              ? error.message
              : "Unable to query auth failure metrics.",
          severity: "critical",
        });
        metricsDbAlertAdded = true;
      }
    }

    const health = await checkHealth();
    if (!health.ok) {
      alerts.push({
        key: "service-down",
        title: "Service healthcheck failed",
        body:
          health.message ??
          `Healthcheck ${env.healthcheckUrl} did not succeed.`,
        severity: "critical",
      });
    }

    const activeKeys = new Set(alerts.map((alert) => alert.key));

    for (const alert of alerts) {
      const current = state[alert.key];
      if (!shouldSend(current, now)) {
        nextState[alert.key] = {
          active: true,
          lastSentAt: current?.lastSentAt,
        };
        continue;
      }

      await dispatchAlert(alert);
      nextState[alert.key] = {
        active: true,
        lastSentAt: now.toISOString(),
      };
    }

    for (const [key, record] of Object.entries(state)) {
      if (!record.active || activeKeys.has(key)) {
        continue;
      }

      const recoveryAlert: TriggeredAlert = {
        key,
        title: `${key} recovered`,
        body: "The monitored value is back below the configured threshold.",
        severity: "recovery",
      };

      await dispatchAlert(recoveryAlert);
      nextState[key] = {
        active: false,
        lastSentAt: now.toISOString(),
      };
    }

    await writeAlertState(env.stateFile, nextState);
  } finally {
    await sqlClient.end({ timeout: 1 });
  }
}

await main();
