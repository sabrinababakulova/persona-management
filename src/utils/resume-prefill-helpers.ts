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
      if (!name) {
        return null;
      }

      return { name, level };
    })
    .filter((language): language is { name: string; level: string } =>
      Boolean(language),
    );
}

function toWorkExperience(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const experience = item as Record<string, unknown>;
      const company = toStringValue(experience.company);
      const position = toStringValue(experience.position);
      const period = toStringValue(experience.period);
      const description = toStringArray(experience.description);

      if (!company && !position && !period && description.length === 0) {
        return null;
      }

      return { company, position, period, description };
    })
    .filter(
      (
        item,
      ): item is {
        company: string;
        position: string;
        period: string;
        description: string[];
      } => Boolean(item),
    );
}

function toEducation(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const education = item as Record<string, unknown>;
      const institution = toStringValue(education.institution);
      const gpa = normalizeAcademicGrade(education.gpa);
      const period = toStringValue(education.period);

      if (!institution && !gpa && !period) {
        return null;
      }

      return { institution, gpa, period };
    })
    .filter(
      (item): item is { institution: string; gpa: string; period: string } =>
        Boolean(item),
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
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const LANGUAGE_ALIASES: Record<string, string[]> = {
  russian: ["russian", "русский", "русский язык", "rus tili"],
  uzbek: [
    "uzbek",
    "uzbek language",
    "узбекский",
    "узбекский язык",
    "o‘zbek",
    "o'zbek",
    "o‘zbek tili",
    "o'zbek tili",
  ],
  english: ["english", "английский", "английский язык", "ingliz tili"],
  german: ["german", "немецкий", "немецкий язык", "nemis tili"],
  french: ["french", "французский", "французский язык", "fransuz tili"],
  spanish: ["spanish", "испанский", "испанский язык", "ispan tili"],
  korean: ["korean", "корейский", "корейский язык", "koreys tili"],
  chinese: ["chinese", "китайский", "китайский язык", "xitoy tili"],
};

const LANGUAGE_LEVEL_ALIASES: Array<{
  aliases: string[];
  value: string;
}> = [
  {
    value: "C2",
    aliases: [
      "native",
      "mother tongue",
      "native speaker",
      "fluent",
      "proficient",
      "родной",
      "свободно",
      "в совершенстве",
      "ona tili",
      "mukammal",
    ],
  },
  {
    value: "C1",
    aliases: ["advanced", "продвинутый", "ilg‘or", "ilgor"],
  },
  {
    value: "B2",
    aliases: [
      "upper intermediate",
      "upper-intermediate",
      "выше среднего",
      "o‘rtadan yuqori",
      "ortadan yuqori",
    ],
  },
  {
    value: "B1",
    aliases: ["intermediate", "средний", "o‘rta", "orta"],
  },
  {
    value: "A2",
    aliases: ["elementary", "элементарный", "elementar"],
  },
  {
    value: "A1",
    aliases: [
      "beginner",
      "basic",
      "начальный",
      "базовый",
      "boshlang‘ich",
      "boshlangich",
    ],
  },
];

function normalizeAcademicGrade(value: unknown) {
  const grade = toStringValue(value);
  if (!grade) {
    return "";
  }

  const explicitGradeLabel =
    /\b(?:gpa|grade|grades|average score|academic score|honou?rs?|distinction)\b|(?:средн(?:ий|яя|ее)\s+балл|оценк\p{L}*|балл\p{L}*|диплом\s+с\s+отличием|отлично|хорошо)|(?:o‘rtacha\s+ball|o'rtacha\s+ball|baho|imtiyozli\s+diplom)/iu;
  const standaloneNumericGrade =
    /^\d{1,3}(?:[.,]\d{1,2})?\s*(?:(?:\/|из|of)\s*\d{1,3}(?:[.,]\d{1,2})?|%)?$/iu;
  const standaloneLetterGrade = /^[A-F][+-]?$/iu;

  return explicitGradeLabel.test(grade) ||
    standaloneNumericGrade.test(grade) ||
    standaloneLetterGrade.test(grade)
    ? grade
    : "";
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

function findLanguageOption(value: unknown, options: LookupOption[]) {
  const directMatch = findLookupOption(value, options);
  if (directMatch) {
    return directMatch;
  }

  const token = normalizeToken(toStringValue(value));
  if (!token) {
    return undefined;
  }

  const aliasedValue = Object.entries(LANGUAGE_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => token.includes(normalizeToken(alias))),
  )?.[0];

  return aliasedValue
    ? options.find(
        (option) =>
          normalizeToken(option.value) === normalizeToken(aliasedValue),
      )
    : undefined;
}

function toLanguageLevelValue(value: unknown, options: LookupOption[]) {
  const directMatch = findLookupOption(value, options);
  if (directMatch) {
    return directMatch.value;
  }

  const raw = toStringValue(value);
  const cefrMatch = raw
    .toUpperCase()
    .match(/(?:^|[^A-Z])([ABC][12])(?:$|[^A-Z0-9])/);
  if (cefrMatch?.[1]) {
    const option = options.find(
      (candidate) => candidate.value.toUpperCase() === cefrMatch[1],
    );
    if (option) {
      return option.value;
    }
  }

  const token = normalizeToken(raw);
  const aliasMatch = LANGUAGE_LEVEL_ALIASES.find(({ aliases }) =>
    aliases.some((alias) => token.includes(normalizeToken(alias))),
  );

  return aliasMatch
    ? (options.find((option) => option.value.toUpperCase() === aliasMatch.value)
        ?.value ?? "")
    : "";
}

function toLookupValue(value: unknown, options: LookupOption[]) {
  return findLookupOption(value, options)?.value ?? "";
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
    const name =
      findLanguageOption(language.name, languageOptions)?.value ?? "";
    const level = toLanguageLevelValue(
      `${language.level} ${language.name}`,
      levelOptions,
    );
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
    workExperience: toWorkExperience(payload.workExperience).slice(0, 20),
    education: toEducation(payload.education).slice(0, 20),
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
      prefillData.workExperience.length > 0 ||
      prefillData.education.length > 0 ||
      prefillData.status,
  );
}
