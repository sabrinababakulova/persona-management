/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

import createNextIntlPlugin from "next-intl/plugin";
import { env } from "./src/env.js";

/** @type {Array<URL | import("next/dist/shared/lib/image-config").RemotePattern>} */
const remotePatterns = [
  {
    protocol: "https",
    hostname: "api.dicebear.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",
    pathname: "/**",
  },
];

const directusAssetBaseUrl = env.DIRECTUS_PUBLIC_URL ?? env.DIRECTUS_URL;
if (directusAssetBaseUrl) {
  const directusPublicUrl = new URL(directusAssetBaseUrl);

  remotePatterns.push({
    protocol: /** @type {"http" | "https"} */ (
      directusPublicUrl.protocol.replace(":", "")
    ),
    hostname: directusPublicUrl.hostname,
    pathname: "/assets/**",
    ...(directusPublicUrl.port ? { port: directusPublicUrl.port } : {}),
  });
}

/**
 * Content Security Policy for the app.
 *
 * The vacancy description is authored in the app's rich-text editor and rendered with
 * `dangerouslySetInnerHTML`; it is sanitized on write and on read, and this is the layer that
 * contains anything that ever gets past that. Sent from Next rather than only from nginx so
 * development and production enforce the same policy.
 *
 * - `'unsafe-inline'` on styles: Tailwind and `next/image` both emit inline style attributes.
 * - `'unsafe-inline'`/`'unsafe-eval'` on scripts in development only: the Turbopack dev
 *   runtime and React Refresh need them; production runs without either.
 * - `img-src` includes the Directus asset host and the avatar providers already listed in
 *   `images.remotePatterns`.
 */
const directusImageOrigin = directusAssetBaseUrl
  ? new URL(directusAssetBaseUrl).origin
  : "";

const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://api.dicebear.com https://lh3.googleusercontent.com ${directusImageOrigin}`.trim(),
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src 'none'",
  // Only meaningful behind TLS, and it would rewrite plain-http requests in local dev.
  ...(process.env.NODE_ENV === "development"
    ? []
    : ["upgrade-insecure-requests"]),
].join("; ");

/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: ["argon2", "@react-pdf/renderer", "playwright-core"],
  poweredByHeader: false,
  images: {
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(config);
