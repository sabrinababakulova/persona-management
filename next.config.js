/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { env } from "./src/env.js";

/** @type {import("next").NextConfig} */
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
    protocol: directusPublicUrl.protocol.replace(":", ""),
    hostname: directusPublicUrl.hostname,
    pathname: "/assets/**",
    ...(directusPublicUrl.port ? { port: directusPublicUrl.port } : {}),
  });
}

const config = {
  serverExternalPackages: ["argon2", "@react-pdf/renderer"],
  poweredByHeader: false,
  images: {
    remotePatterns,
  },
};

export default config;
