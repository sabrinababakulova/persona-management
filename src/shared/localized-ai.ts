import { z } from "zod";

import type { AppLocale } from "~/i18n/config";
import { normalizeAiTags } from "./ai-tags";

export const localizedTextSchema = z.object({
  ru: z.string().trim().min(1).max(5000),
  en: z.string().trim().min(1).max(5000),
  uz: z.string().trim().min(1).max(5000),
});

export const localizedStringListSchema = z.object({
  ru: z.array(z.string().max(255)).max(8),
  en: z.array(z.string().max(255)).max(8),
  uz: z.array(z.string().max(255)).max(8),
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type LocalizedStringList = z.infer<typeof localizedStringListSchema>;

export function getLocalizedText(
  translations: LocalizedText | null | undefined,
  locale: AppLocale,
  fallback = "",
): string {
  return translations?.[locale]?.trim() || translations?.ru?.trim() || fallback;
}

export function getLocalizedStringList(
  translations: LocalizedStringList | null | undefined,
  locale: AppLocale,
  fallback: string[] = [],
): string[] {
  const localized = translations?.[locale] ?? translations?.ru;
  return normalizeAiTags(localized ?? fallback, { maxTags: 8 });
}
