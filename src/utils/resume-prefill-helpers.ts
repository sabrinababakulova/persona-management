import type { CandidateResumePrefillData } from "~/schemas/resume-analysis";

type LookupOption = { value: string; label: string };

export type ResumeLookupOptions = {
  contactTypes: LookupOption[];
  sources: LookupOption[];
  positions: LookupOption[];
  skills: LookupOption[];
  languages: LookupOption[];
  languageLevels: LookupOption[];
  statusOptions: LookupOption[];
  vacancyLevels: LookupOption[];
};

export const EMPTY_LOOKUP_OPTIONS: ResumeLookupOptions = {
  contactTypes: [],
  sources: [],
  positions: [],
  skills: [],
  languages: [],
  languageLevels: [],
  statusOptions: [],
  vacancyLevels: [],
};

function toStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toContacts(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const contact = item as Record<string, unknown>;
      const type = toStringValue(contact.type);
      const contactValue = toStringValue(contact.value);
      if (!type || !contactValue) {
        return null;
      }

      return { type, value: contactValue };
    })
    .filter((contact): contact is { type: string; value: string } =>
      Boolean(contact),
    );
}

function toLanguages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const language = item as Record<string, unknown>;
      const name = toStringValue(language.name);
      const level = toStringValue(language.level);
      if (!name || !level) {
        return null;
      }

      return { name, level };
    })
    .filter((language): language is { name: string; level: string } =>
      Boolean(language),
    );
}

function parseSalaryExpectation(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d.]/g, "").trim());
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric);
    }
  }

  return undefined;
}

function parseSalaryCurrency(value: unknown): "UZS" | "USD" {
  const token = typeof value === "string" ? value.trim().toUpperCase() : "";
  return token === "USD" || token === "$" ? "USD" : "UZS";
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
}

function findLookupOption(
  value: unknown,
  options: LookupOption[],
): LookupOption | undefined {
  const raw = toStringValue(value);
  if (!raw || options.length === 0) {
    return undefined;
  }

  const token = normalizeToken(raw);
  const exactMatch = options.find(
    (option) =>
      normalizeToken(option.value) === token ||
      normalizeToken(option.label) === token,
  );
  if (exactMatch) {
    return exactMatch;
  }

  return options.find(
    (option) =>
      token.includes(normalizeToken(option.value)) ||
      token.includes(normalizeToken(option.label)) ||
      normalizeToken(option.value).includes(token) ||
      normalizeToken(option.label).includes(token),
  );
}

function toLookupValue(value: unknown, options: LookupOption[]) {
  return findLookupOption(value, options)?.value ?? "";
}

function toLookupLabel(value: unknown, options: LookupOption[]) {
  return findLookupOption(value, options)?.label ?? "";
}

function toLookupValueArray(value: unknown, options: LookupOption[]) {
  const uniqueValues = new Set<string>();
  const result: string[] = [];

  for (const raw of toStringArray(value)) {
    const normalized = toLookupValue(raw, options);
    if (normalized && !uniqueValues.has(normalized)) {
      uniqueValues.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function toNormalizedContacts(value: unknown, options: LookupOption[]) {
  return toContacts(value)
    .map((contact) => ({
      type: toLookupValue(contact.type, options),
      value: contact.value,
    }))
    .filter((contact) => Boolean(contact.type && contact.value));
}

function toNormalizedLanguages(
  value: unknown,
  languageOptions: LookupOption[],
  levelOptions: LookupOption[],
) {
  const uniqueValues = new Set<string>();
  const result: { name: string; level: string }[] = [];

  for (const language of toLanguages(value)) {
    const name = toLookupLabel(language.name, languageOptions);
    const level = toLookupValue(language.level, levelOptions);
    if (!name || !level) {
      continue;
    }

    const key = `${name}::${level}`;
    if (!uniqueValues.has(key)) {
      uniqueValues.add(key);
      result.push({ name, level });
    }
  }

  return result;
}

export function toLookupOptionsHints(options: LookupOption[]) {
  if (options.length === 0) {
    return "нет доступных вариантов";
  }

  return options
    .map((option) => `${option.value} (${option.label})`)
    .join(", ");
}

export function toResumePrefillData(
  rawPayload: unknown,
  lookupOptions: ResumeLookupOptions,
): CandidateResumePrefillData {
  const payload =
    rawPayload && typeof rawPayload === "object"
      ? (rawPayload as Record<string, unknown>)
      : {};

  return {
    fullName: toStringValue(payload.fullName),
    city: toStringValue(payload.city),
    contacts: toNormalizedContacts(
      payload.contacts,
      lookupOptions.contactTypes,
    ).slice(0, 20),
    source: toLookupValue(payload.source, lookupOptions.sources),
    salaryExpectation: parseSalaryExpectation(payload.salaryExpectation),
    salaryCurrency: parseSalaryCurrency(payload.salaryCurrency),
    vacancyLevel: toLookupValue(
      payload.vacancyLevel,
      lookupOptions.vacancyLevels,
    ),
    currentPosition: toLookupValue(
      payload.currentPosition,
      lookupOptions.positions,
    ),
    skills: toLookupValueArray(payload.skills, lookupOptions.skills).slice(
      0,
      50,
    ),
    languages: toNormalizedLanguages(
      payload.languages,
      lookupOptions.languages,
      lookupOptions.languageLevels,
    ).slice(0, 20),
    status: toLookupValue(payload.status, lookupOptions.statusOptions),
  };
}

export function hasAnyPrefillData(prefillData: CandidateResumePrefillData) {
  return Boolean(
    prefillData.fullName ||
      prefillData.city ||
      prefillData.contacts.length > 0 ||
      prefillData.source ||
      prefillData.salaryExpectation !== undefined ||
      prefillData.vacancyLevel ||
      prefillData.currentPosition ||
      prefillData.skills.length > 0 ||
      prefillData.languages.length > 0 ||
      prefillData.status,
  );
}
