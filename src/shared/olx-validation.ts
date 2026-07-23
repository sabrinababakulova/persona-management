export type OlxContentField = "title" | "description";

export type OlxContentValidationIssue = {
  field: OlxContentField;
  message: string;
};

const EMAIL_OR_URL_PATTERN =
  /(?:[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}|https?:\/\/|www\.)/iu;
const PHONE_PATTERN = /(?:\+?\d(?:[\s().-]*\d){6,})/u;
const REPEATED_PUNCTUATION_PATTERN = /([!?.,\-=+#%&@*_><:()|])\1{2}/u;

export const OLX_MAX_SALARY = 99_999_999_999_999;

export function olxVisibleText(html: string): string {
  return html
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/(?:p|li|ul)>/giu, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function uppercaseRatio(value: string): number {
  const letters = [...value].filter((character) => /\p{L}/u.test(character));
  if (letters.length === 0) {
    return 0;
  }

  const uppercase = letters.filter(
    (character) =>
      character === character.toLocaleUpperCase() &&
      character !== character.toLocaleLowerCase(),
  );
  return uppercase.length / letters.length;
}

function validateCommonOlxText(
  field: OlxContentField,
  value: string,
): OlxContentValidationIssue[] {
  const issues: OlxContentValidationIssue[] = [];
  const label = field === "title" ? "Название" : "Описание";

  if (uppercaseRatio(value) > 0.5) {
    issues.push({
      field,
      message: `${label} не может более чем наполовину состоять из заглавных букв`,
    });
  }

  if (EMAIL_OR_URL_PATTERN.test(value)) {
    issues.push({
      field,
      message: `${label} не должно содержать email или ссылку`,
    });
  }

  if (PHONE_PATTERN.test(value)) {
    issues.push({
      field,
      message: `${label} не должно содержать номер телефона`,
    });
  }

  if (REPEATED_PUNCTUATION_PATTERN.test(value)) {
    issues.push({
      field,
      message: `${label} не должно содержать три одинаковых знака подряд`,
    });
  }

  return issues;
}

/**
 * Applies the OLX Partner API v2 text rules before a network request.
 * OLX still performs canonical validation and can return additional market-specific errors.
 */
export function validateOlxAdvertContent(input: {
  title: string;
  descriptionHtml: string;
}): OlxContentValidationIssue[] {
  const title = input.title.trim();
  const description = olxVisibleText(input.descriptionHtml);
  const issues: OlxContentValidationIssue[] = [];

  if (title.length < 16 || title.length > 150) {
    issues.push({
      field: "title",
      message: "Название должно содержать от 16 до 150 символов",
    });
  }

  if (description.length < 80 || description.length > 9000) {
    issues.push({
      field: "description",
      message: "Описание должно содержать от 80 до 9000 символов",
    });
  }

  issues.push(...validateCommonOlxText("title", title));
  issues.push(...validateCommonOlxText("description", description));

  return issues;
}
