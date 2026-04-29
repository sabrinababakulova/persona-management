import sanitizeHtml from "sanitize-html";

const HH_ALLOWED_TAGS = [
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "h3",
  "h4",
];

export function sanitizeHhDescriptionHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: HH_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      b: "strong",
      i: "em",
      h1: "h3",
      h2: "h3",
      h5: "h4",
      h6: "h4",
    },
  })
    .replace(/\s+/g, " ")
    .trim();
}
