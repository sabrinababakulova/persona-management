/**
 * hh.uz experience dictionary ids that can end up in `vacancies.experienceId`
 * (vacancies created or synced through hh flows). Mapped to localized labels
 * so raw ids like "between3And6" never reach the UI; any other value (e.g. a
 * human-entered string) passes through unchanged.
 */
const HH_EXPERIENCE_IDS = [
  "noExperience",
  "between1And3",
  "between3And6",
  "moreThan6",
] as const;

type HhExperienceId = (typeof HH_EXPERIENCE_IDS)[number];

function isHhExperienceId(value: string): value is HhExperienceId {
  return (HH_EXPERIENCE_IDS as readonly string[]).includes(value);
}

/**
 * @param translate — the `Common` namespace translator; labels live under
 *   `Common.experienceLabels.<id>`.
 */
export function formatHhExperience(
  value: string,
  translate: (key: `experienceLabels.${HhExperienceId}`) => string,
): string {
  return isHhExperienceId(value)
    ? translate(`experienceLabels.${value}`)
    : value;
}
