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

/** hh.uz employment dictionary ids (`vacancies.employmentId`). */
const HH_EMPLOYMENT_IDS = [
  "full",
  "part",
  "project",
  "volunteer",
  "probation",
] as const;

type HhEmploymentId = (typeof HH_EMPLOYMENT_IDS)[number];

function isHhEmploymentId(value: string): value is HhEmploymentId {
  return (HH_EMPLOYMENT_IDS as readonly string[]).includes(value);
}

/**
 * @param translate — the `Common` namespace translator; labels live under
 *   `Common.employmentLabels.<id>`.
 */
export function formatHhEmployment(
  value: string,
  translate: (key: `employmentLabels.${HhEmploymentId}`) => string,
): string {
  return isHhEmploymentId(value)
    ? translate(`employmentLabels.${value}`)
    : value;
}
