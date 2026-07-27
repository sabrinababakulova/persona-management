import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import type ruMessages from "../../messages/ru.json";
import {
  type AppLocale,
  defaultLocale,
  isAppLocale,
  localeCookieName,
} from "./config";

type AppMessages = typeof ruMessages;

const messageLoaders: Record<AppLocale, () => Promise<AppMessages>> = {
  ru: () => import("../../messages/ru.json").then((module) => module.default),
  uz: () => import("../../messages/uz.json").then((module) => module.default),
  en: () => import("../../messages/en.json").then((module) => module.default),
};

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isAppLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return {
    locale,
    messages: await messageLoaders[locale](),
    timeZone: "Asia/Tashkent",
  };
});
