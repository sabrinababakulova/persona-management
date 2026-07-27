"use client";

import { useMessages } from "next-intl";
import { useCallback } from "react";
import type { LookupOption } from "~/types/shared/candidate-lookups";

export type LookupGroup =
  | "contactTypes"
  | "sources"
  | "positions"
  | "skills"
  | "languages"
  | "languageLevels"
  | "candidateStatuses"
  | "vacancyLevels"
  | "workTypes"
  | "vacancyStatuses"
  | "vacancySources";

export function useLookupLocalizer() {
  const messages = useMessages();
  const lookupMessages = messages.Lookups as Record<
    LookupGroup,
    Record<string, string>
  >;

  return useCallback(
    (options: readonly LookupOption[] | undefined, group: LookupGroup) =>
      (options ?? []).map((option) => ({
        ...option,
        label: lookupMessages[group]?.[option.value] ?? option.label,
      })),
    [lookupMessages],
  );
}
