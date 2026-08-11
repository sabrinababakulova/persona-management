"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { ChevronDownIcon, GlobeIcon } from "~/app/_components/icons";
import { type AppLocale, localeCookieName, locales } from "~/i18n/config";

type LocaleSwitcherProps = {
  variant?: "header" | "auth";
};

const localeLabelKeys = {
  ru: "ru",
  uz: "uz",
  en: "en",
} as const;

export function LocaleSwitcher({ variant = "header" }: LocaleSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("LocaleSwitcher");
  const [isPending, startTransition] = useTransition();

  const changeLocale = (nextLocale: AppLocale) => {
    if (nextLocale === locale) {
      return;
    }

    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API support is not universal; this first-party preference cookie is intentionally set synchronously.
    document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <label
      className={`relative inline-flex h-10 items-center gap-2 rounded-lg border transition-colors ${
        variant === "auth"
          ? "border-border-input bg-bg-input px-3 text-text-secondary shadow-sm hover:border-border-control"
          : "border-border-light bg-bg-input px-3 text-text-heading shadow-sm hover:border-border-control"
      } ${isPending ? "opacity-60" : ""}`}
    >
      <GlobeIcon className="pointer-events-none h-4 w-4 shrink-0" />
      <span className="sr-only">{t("current", { language: t(locale) })}</span>
      <select
        aria-label={t("label")}
        className="peer absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-wait"
        disabled={isPending}
        onChange={(event) => changeLocale(event.target.value as AppLocale)}
        value={locale}
      >
        {locales.map((availableLocale) => (
          <option key={availableLocale} value={availableLocale}>
            {t(localeLabelKeys[availableLocale])}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="min-w-5 font-medium text-sm leading-none"
      >
        {t(
          locale === "ru" ? "shortRu" : locale === "uz" ? "shortUz" : "shortEn",
        )}
      </span>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none h-3 w-3"
      />
    </label>
  );
}
