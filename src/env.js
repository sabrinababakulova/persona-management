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
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    RESUME_STORAGE_PATH: z.string().min(1).optional(),
    DIRECTUS_URL: z.string().url(),
    DIRECTUS_TOKEN: z.string().min(1),
    DIRECTUS_INTERNAL_URL: z.string().url().optional(),
    DIRECTUS_PUBLIC_URL: z.string().url().optional(),
    DIRECTUS_STORAGE_TOKEN: z.string().min(1).optional(),
    DIRECTUS_FOLDER: z.string().optional(),
    AUTH_URL: z.string().url().optional(),
    VERCEL_URL: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
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
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESUME_STORAGE_PATH: process.env.RESUME_STORAGE_PATH,
    DIRECTUS_URL: process.env.DIRECTUS_URL,
    DIRECTUS_TOKEN: process.env.DIRECTUS_TOKEN,
    DIRECTUS_INTERNAL_URL: process.env.DIRECTUS_INTERNAL_URL,
    DIRECTUS_PUBLIC_URL: process.env.DIRECTUS_PUBLIC_URL,
    DIRECTUS_STORAGE_TOKEN: process.env.DIRECTUS_STORAGE_TOKEN,
    DIRECTUS_FOLDER: process.env.DIRECTUS_FOLDER,
    AUTH_URL: process.env.AUTH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
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
