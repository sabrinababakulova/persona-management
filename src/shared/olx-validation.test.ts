import { describe, expect, test } from "bun:test";

import { olxVisibleText, validateOlxAdvertContent } from "./olx-validation";

const validDescription =
  "Мы ищем внимательного специалиста для работы с клиентами. Предлагаем официальное оформление, обучение и понятный график.";

describe("olxVisibleText", () => {
  test("converts supported job HTML into normalized visible text", () => {
    expect(
      olxVisibleText(
        "<p>Условия&nbsp;работы</p><ul><li>Офис</li><li>Обучение</li></ul>",
      ),
    ).toBe("Условия работы Офис Обучение");
  });
});

describe("validateOlxAdvertContent", () => {
  test("accepts an OLX-compatible vacancy", () => {
    expect(
      validateOlxAdvertContent({
        title: "Оператор call-центра",
        descriptionHtml: `<p>${validDescription}</p>`,
      }),
    ).toEqual([]);
  });

  test("validates documented length limits", () => {
    const issues = validateOlxAdvertContent({
      title: "Коротко",
      descriptionHtml: "Слишком короткое описание",
    });

    expect(issues.map((issue) => issue.field)).toEqual([
      "title",
      "description",
    ]);
  });

  test("rejects excessive uppercase, contact data, and repeated punctuation", () => {
    const issues = validateOlxAdvertContent({
      title: "ОПЕРАТОР CALL-ЦЕНТРА!!!",
      descriptionHtml: `<p>${validDescription} Позвоните +998 90 123 45 67 или откройте www.example.com.</p>`,
    });
    const messages = issues.map((issue) => issue.message).join(" ");

    expect(messages).toContain("заглавных");
    expect(messages).toContain("три одинаковых знака");
    expect(messages).toContain("номер телефона");
    expect(messages).toContain("email или ссылку");
  });
});
