export function toStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function toContacts(value: unknown) {
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

export function toLanguages(value: unknown) {
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

export function parseSalaryExpectation(value: unknown) {
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

export function parseSalaryCurrency(value: unknown): "UZS" | "USD" {
  const token = typeof value === "string" ? value.trim().toUpperCase() : "";
  return token === "USD" || token === "$" ? "USD" : "UZS";
}
