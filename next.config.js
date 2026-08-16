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

/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: ["argon2", "@react-pdf/renderer", "playwright-core"],
  poweredByHeader: false,
  images: {
    remotePatterns,
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(config);
