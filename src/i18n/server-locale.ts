import {
  type AppLocale,
  defaultLocale,
  isAppLocale,
  localeCookieName,
} from "./config";

export function getRequestLocale(headers: Headers): AppLocale {
  const explicitLocale = headers.get("x-app-locale") ?? undefined;
  if (isAppLocale(explicitLocale)) {
    return explicitLocale;
  }

  const cookieHeader = headers.get("cookie") ?? "";
  const localeCookie = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === localeCookieName)?.[1];

  const cookieLocale = localeCookie
    ? decodeURIComponent(localeCookie)
    : undefined;
  return isAppLocale(cookieLocale) ? cookieLocale : defaultLocale;
}
