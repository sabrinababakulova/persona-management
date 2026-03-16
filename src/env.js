import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    MAIL_LOGIN: z.string(),
    MAIL_LOGIN_PASSWORD: z.string(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    RESUME_STORAGE_PATH: z.string().min(1).optional(),
    DIRECTUS_URL: z.string().url(),
    DIRECTUS_TOKEN: z.string().min(1),
    DIRECTUS_INTERNAL_URL: z.string().url().optional(),
    DIRECTUS_PUBLIC_URL: z.string().url().optional(),
    DIRECTUS_STORAGE_TOKEN: z.string().min(1).optional(),
    DIRECTUS_FOLDER: z.string().optional(),
    MONITOR_HEALTHCHECK_URL: z.string().url().optional(),
    MONITOR_DISK_PATH: z.string().min(1).optional(),
    MONITOR_CPU_THRESHOLD_PERCENT: z.coerce.number().positive().optional(),
    MONITOR_MEMORY_THRESHOLD_PERCENT: z.coerce.number().positive().optional(),
    MONITOR_DISK_THRESHOLD_PERCENT: z.coerce.number().positive().optional(),
    MONITOR_REQUEST_SPIKE_THRESHOLD: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    MONITOR_REQUEST_SPIKE_WINDOW_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    MONITOR_AUTH_FAILURE_THRESHOLD: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    MONITOR_AUTH_FAILURE_WINDOW_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    MONITOR_ALERT_COOLDOWN_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    MONITOR_STATE_FILE: z.string().min(1).optional(),
    ALERT_CHANNELS: z.string().min(1).optional(),
    ALERT_SMTP_HOST: z.string().min(1).optional(),
    ALERT_SMTP_PORT: z.coerce.number().int().positive().optional(),
    ALERT_SMTP_SECURE: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    ALERT_SMTP_USER: z.string().min(1).optional(),
    ALERT_SMTP_PASS: z.string().min(1).optional(),
    ALERT_EMAIL_FROM: z.string().email().optional(),
    ALERT_EMAIL_TO: z.string().min(1).optional(),
    ALERT_TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    ALERT_TELEGRAM_CHAT_ID: z.string().min(1).optional(),
    ALERT_TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    ALERT_TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    ALERT_TWILIO_FROM: z.string().min(1).optional(),
    ALERT_SMS_TO: z.string().min(1).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    MAIL_LOGIN: process.env.MAIL_LOGIN,
    MAIL_LOGIN_PASSWORD: process.env.MAIL_LOGIN_PASSWORD,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    RESUME_STORAGE_PATH: process.env.RESUME_STORAGE_PATH,
    DIRECTUS_URL: process.env.DIRECTUS_URL,
    DIRECTUS_TOKEN: process.env.DIRECTUS_TOKEN,
    DIRECTUS_INTERNAL_URL: process.env.DIRECTUS_INTERNAL_URL,
    DIRECTUS_PUBLIC_URL: process.env.DIRECTUS_PUBLIC_URL,
    DIRECTUS_STORAGE_TOKEN: process.env.DIRECTUS_STORAGE_TOKEN,
    DIRECTUS_FOLDER: process.env.DIRECTUS_FOLDER,
    MONITOR_HEALTHCHECK_URL: process.env.MONITOR_HEALTHCHECK_URL,
    MONITOR_DISK_PATH: process.env.MONITOR_DISK_PATH,
    MONITOR_CPU_THRESHOLD_PERCENT: process.env.MONITOR_CPU_THRESHOLD_PERCENT,
    MONITOR_MEMORY_THRESHOLD_PERCENT:
      process.env.MONITOR_MEMORY_THRESHOLD_PERCENT,
    MONITOR_DISK_THRESHOLD_PERCENT: process.env.MONITOR_DISK_THRESHOLD_PERCENT,
    MONITOR_REQUEST_SPIKE_THRESHOLD:
      process.env.MONITOR_REQUEST_SPIKE_THRESHOLD,
    MONITOR_REQUEST_SPIKE_WINDOW_MINUTES:
      process.env.MONITOR_REQUEST_SPIKE_WINDOW_MINUTES,
    MONITOR_AUTH_FAILURE_THRESHOLD: process.env.MONITOR_AUTH_FAILURE_THRESHOLD,
    MONITOR_AUTH_FAILURE_WINDOW_MINUTES:
      process.env.MONITOR_AUTH_FAILURE_WINDOW_MINUTES,
    MONITOR_ALERT_COOLDOWN_MINUTES: process.env.MONITOR_ALERT_COOLDOWN_MINUTES,
    MONITOR_STATE_FILE: process.env.MONITOR_STATE_FILE,
    ALERT_CHANNELS: process.env.ALERT_CHANNELS,
    ALERT_SMTP_HOST: process.env.ALERT_SMTP_HOST,
    ALERT_SMTP_PORT: process.env.ALERT_SMTP_PORT,
    ALERT_SMTP_SECURE: process.env.ALERT_SMTP_SECURE,
    ALERT_SMTP_USER: process.env.ALERT_SMTP_USER,
    ALERT_SMTP_PASS: process.env.ALERT_SMTP_PASS,
    ALERT_EMAIL_FROM: process.env.ALERT_EMAIL_FROM,
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO,
    ALERT_TELEGRAM_BOT_TOKEN: process.env.ALERT_TELEGRAM_BOT_TOKEN,
    ALERT_TELEGRAM_CHAT_ID: process.env.ALERT_TELEGRAM_CHAT_ID,
    ALERT_TWILIO_ACCOUNT_SID: process.env.ALERT_TWILIO_ACCOUNT_SID,
    ALERT_TWILIO_AUTH_TOKEN: process.env.ALERT_TWILIO_AUTH_TOKEN,
    ALERT_TWILIO_FROM: process.env.ALERT_TWILIO_FROM,
    ALERT_SMS_TO: process.env.ALERT_SMS_TO,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
