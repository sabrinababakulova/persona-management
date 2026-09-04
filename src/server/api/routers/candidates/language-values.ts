type LanguageLookupOption = {
  value: string;
  label: string;
};

/**
 * Resolves either a stable lookup value or a legacy stored label to the
 * canonical label used by existing candidate language data.
 */
export function resolveCandidateLanguageLabel(
  name: string,
  options: readonly LanguageLookupOption[],
) {
  return options.find(
    (option) => option.value === name || option.label === name,
  )?.label;
}
