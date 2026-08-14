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
    /**
     * Local development only: skips the emailed 6-digit code, so registration signs you in
     * straight away. Ignored unless NODE_ENV is "development" — see `src/server/auth/config.ts`.
     */
    SKIP_EMAIL_VERIFICATION: z.enum(["true", "false"]).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    RESUME_STORAGE_PATH: z.string().min(1).optional(),
    DIRECTUS_URL: z.string().url(),
    DIRECTUS_TOKEN: z.string().min(1),
    DIRECTUS_INTERNAL_URL: z.string().url().optional(),
    DIRECTUS_PUBLIC_URL: z.string().url().optional(),
    DIRECTUS_FOLDER: z.string().optional(),
    AUTH_URL: z.string().url().optional(),
    VERCEL_URL: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_RESUME_CHAT_ID: z
      .string()
      .regex(/^-?\d+$/, "TELEGRAM_RESUME_CHAT_ID must be a numeric chat id")
      .optional(),
    TELEGRAM_RESUME_COMPANY_ID: z.string().min(1).max(255).optional(),
    TELEGRAM_RESUME_VACANCY_ID: z.string().min(1).max(255).optional(),
    TELEGRAM_WEBHOOK_BASE_URL: z.string().url().optional(),
    TELEGRAM_WEBHOOK_SECRET: z
      .string()
      .min(16)
      .max(256)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "TELEGRAM_WEBHOOK_SECRET may only contain A-Z, a-z, 0-9, _ and -",
      )
      .optional(),
    HH_CLIENT_ID: z.string().min(1).optional(),
    HH_CLIENT_SECRET: z.string().min(1).optional(),
    HH_REDIRECT_URI: z.string().url().optional(),
    PERSON_HUNTER_API_KEY: z.string().min(1).optional(),
    OLX_BROWSER_EXECUTABLE_PATH: z.string().min(1).optional(),
    OLX_BROWSER_NO_SANDBOX: z.enum(["true", "false"]).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_OLX_CONNECTOR_URL: z.string().url().optional(),
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
    SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESUME_STORAGE_PATH: process.env.RESUME_STORAGE_PATH,
    DIRECTUS_URL: process.env.DIRECTUS_URL,
    DIRECTUS_TOKEN: process.env.DIRECTUS_TOKEN,
    DIRECTUS_INTERNAL_URL: process.env.DIRECTUS_INTERNAL_URL,
    DIRECTUS_PUBLIC_URL: process.env.DIRECTUS_PUBLIC_URL,
    DIRECTUS_FOLDER: process.env.DIRECTUS_FOLDER,
    AUTH_URL: process.env.AUTH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_RESUME_CHAT_ID: process.env.TELEGRAM_RESUME_CHAT_ID,
    TELEGRAM_RESUME_COMPANY_ID: process.env.TELEGRAM_RESUME_COMPANY_ID,
    TELEGRAM_RESUME_VACANCY_ID: process.env.TELEGRAM_RESUME_VACANCY_ID,
    TELEGRAM_WEBHOOK_BASE_URL: process.env.TELEGRAM_WEBHOOK_BASE_URL,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    HH_CLIENT_ID: process.env.HH_CLIENT_ID,
    HH_CLIENT_SECRET: process.env.HH_CLIENT_SECRET,
    HH_REDIRECT_URI: process.env.HH_REDIRECT_URI,
    PERSON_HUNTER_API_KEY: process.env.PERSON_HUNTER_API_KEY,
    OLX_BROWSER_EXECUTABLE_PATH: process.env.OLX_BROWSER_EXECUTABLE_PATH,
    OLX_BROWSER_NO_SANDBOX: process.env.OLX_BROWSER_NO_SANDBOX,
    NEXT_PUBLIC_OLX_CONNECTOR_URL: process.env.NEXT_PUBLIC_OLX_CONNECTOR_URL,
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
