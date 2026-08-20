export const AI_TAG_MAX_WORDS = 4;
export const AI_TAG_MAX_LENGTH = 64;
export const AI_TAG_MAX_COUNT = 3;

const TRAILING_CONNECTORS = new Set([
  "and",
  "or",
  "of",
  "for",
  "the",
  "и",
  "или",
  "для",
  "в",
  "на",
  "va",
  "yoki",
  "uchun",
]);

function comparableWord(value: string) {
  return value.toLocaleLowerCase().replace(/[.,:;!?()[\]{}"'«»]+/gu, "");
}

export function countAiTagWords(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * Keeps AI-generated badges scannable even when a model ignores its prompt.
 * This is also applied while reading legacy rows, so old sentence-like badges
 * do not keep stretching candidate cards.
 */
export function normalizeAiTag(
  value: string,
  options: { maxWords?: number; maxLength?: number } = {},
): string {
  const maxWords = options.maxWords ?? AI_TAG_MAX_WORDS;
  const maxLength = options.maxLength ?? AI_TAG_MAX_LENGTH;
  const words = value
    .replace(/^[✓✔✕✖✗•*+\-–—]+\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, maxWords);

  while (
    words.length > 1 &&
    TRAILING_CONNECTORS.has(comparableWord(words.at(-1) ?? ""))
  ) {
    words.pop();
  }

  return words
    .join(" ")
    .slice(0, maxLength)
    .trim()
    .replace(/[,:;\-–—]+$/u, "");
}

export function normalizeAiTags(
  values: string[] | null | undefined,
  options: {
    maxTags?: number;
    maxWords?: number;
    maxLength?: number;
  } = {},
): string[] {
  const maxTags = options.maxTags ?? AI_TAG_MAX_COUNT;
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const tag = normalizeAiTag(value, options);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(tag);
    if (normalized.length === maxTags) {
      break;
    }
  }

  return normalized;
}
