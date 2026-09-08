import sanitizeHtml from "sanitize-html";

/**
 * Allowlist for HTML authored in the app's own Tiptap editor (`rich-text-editor.tsx`).
 *
 * Covers exactly what StarterKit + the Link extension can produce, so sanitizing a legitimate
 * document is a no-op. Anything else — `<script>`, `<img onerror>`, `<iframe>`, inline event
 * handlers, `style` attributes — is dropped.
 */
const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "hr",
  "a",
  "span",
];

/**
 * Sanitizes rich text authored inside the app before it is stored or rendered.
 *
 * The vacancy description is written through tRPC, and a tRPC procedure accepts whatever a
 * caller sends — the editor is a convenience, not a trust boundary. Since `descriptionHtml`
 * is rendered with `dangerouslySetInnerHTML` on the vacancy page, the funnel and the
 * publication preview, an unsanitized string is stored XSS against every colleague who opens
 * the vacancy.
 *
 * Applied on write (create/update) and again on read, so rows written before this existed are
 * cleaned on their way to the browser without a data migration.
 */
export function sanitizeRichTextHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: RICH_TEXT_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // Anything the editor links out to opens in a new tab; force the opener guard so a
    // sanitized link can never reach back into the app through `window.opener`.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
      }),
    },
    // `disallowedTagsMode: "discard"` (the default) drops the tag but keeps its text, which is
    // what a recruiter pasting from Word expects.
    allowedSchemesAppliedToAttributes: ["href"],
  });
}

/** Convenience wrapper for the nullable column shape used across the vacancy routers. */
export function sanitizeRichTextHtmlOrNull<T extends string | null | undefined>(
  input: T,
): T extends string ? string : T {
  if (typeof input !== "string") {
    return input as T extends string ? string : T;
  }
  return sanitizeRichTextHtml(input) as T extends string ? string : T;
}
