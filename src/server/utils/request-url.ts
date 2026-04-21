import { env } from "~/env";

function getHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.split(",")[0]?.trim();
  return value ? value : null;
}

function isLocalHost(value: string): boolean {
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value.endsWith(".localhost")
  );
}

function getConfiguredOrigin(): string | null {
  if (env.HH_REDIRECT_URI) {
    return new URL(env.HH_REDIRECT_URI).origin;
  }

  if (env.AUTH_URL) {
    const url = new URL(env.AUTH_URL);
    if (url.protocol === "https:" && !isLocalHost(url.hostname)) {
      return url.origin;
    }
  }

  return null;
}

export function getAppOrigin(request: Request): string {
  const configuredOrigin = getConfiguredOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedHost = getHeaderValue(request.headers, "x-forwarded-host");
  const forwardedProto = getHeaderValue(request.headers, "x-forwarded-proto");

  if (
    forwardedHost &&
    forwardedProto === "https" &&
    !isLocalHost(forwardedHost.split(":")[0] ?? "")
  ) {
    return `https://${forwardedHost}`;
  }

  const requestOrigin = new URL(request.url);
  if (
    requestOrigin.protocol === "https:" &&
    !isLocalHost(requestOrigin.hostname)
  ) {
    return requestOrigin.origin;
  }

  throw new Error(
    "Unable to resolve a public HTTPS origin for redirects. Set HH_REDIRECT_URI or AUTH_URL to your public domain.",
  );
}

export function buildAppUrl(pathname: string, request: Request): URL {
  return new URL(pathname, getAppOrigin(request));
}
