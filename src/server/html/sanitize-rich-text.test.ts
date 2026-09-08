import { describe, expect, test } from "bun:test";

import {
  sanitizeRichTextHtml,
  sanitizeRichTextHtmlOrNull,
} from "./sanitize-rich-text";

describe("sanitizeRichTextHtml", () => {
  test("keeps the markup the editor actually produces", () => {
    const authored =
      "<h2>Обязанности</h2><p>Работа с <strong>командой</strong></p><ul><li>Найм</li></ul>";

    expect(sanitizeRichTextHtml(authored)).toBe(authored);
  });

  test("drops a script tag and its contents", () => {
    expect(
      sanitizeRichTextHtml("<p>до</p><script>alert(1)</script><p>после</p>"),
    ).toBe("<p>до</p><p>после</p>");
  });

  test("drops inline event handlers", () => {
    expect(sanitizeRichTextHtml('<p onclick="alert(1)">текст</p>')).toBe(
      "<p>текст</p>",
    );
  });

  test("drops an image payload entirely", () => {
    expect(sanitizeRichTextHtml('<img src="x" onerror="alert(1)">')).toBe("");
  });

  test("strips a javascript: link but keeps its text", () => {
    const sanitized = sanitizeRichTextHtml(
      '<a href="javascript:alert(1)">нажми</a>',
    );

    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("нажми");
  });

  test("keeps an http link and forces the opener guard", () => {
    const sanitized = sanitizeRichTextHtml(
      '<a href="https://example.com">сайт</a>',
    );

    expect(sanitized).toContain('href="https://example.com"');
    expect(sanitized).toContain('rel="noopener noreferrer nofollow"');
  });

  test("drops an iframe", () => {
    expect(
      sanitizeRichTextHtml('<iframe src="https://evil.test"></iframe>'),
    ).toBe("");
  });

  test("drops style attributes", () => {
    expect(
      sanitizeRichTextHtml('<p style="position:fixed;top:0">перекрытие</p>'),
    ).toBe("<p>перекрытие</p>");
  });

  test("passes null and undefined through unchanged", () => {
    expect(sanitizeRichTextHtmlOrNull(null)).toBeNull();
    expect(sanitizeRichTextHtmlOrNull(undefined)).toBeUndefined();
  });

  test("sanitizes a non-null string", () => {
    expect(sanitizeRichTextHtmlOrNull("<script>x</script><p>ок</p>")).toBe(
      "<p>ок</p>",
    );
  });
});
