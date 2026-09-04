import { describe, expect, test } from "bun:test";

import { getPublicErrorMessage } from "./public-error-message";

describe("public API error messages", () => {
  test("replaces serialized validation issues in every locale", () => {
    const message = '[{"code":"too_big","maximum":50}]';

    expect(
      getPublicErrorMessage({
        code: "BAD_REQUEST",
        isValidationError: true,
        locale: "ru",
        message,
      }),
    ).toBe("Некорректные данные. Проверьте заполненные поля.");
    expect(
      getPublicErrorMessage({
        code: "BAD_REQUEST",
        isValidationError: true,
        locale: "en",
        message,
      }),
    ).toBe("Invalid data. Please check the fields you filled in.");
    expect(
      getPublicErrorMessage({
        code: "BAD_REQUEST",
        isValidationError: true,
        locale: "uz",
        message,
      }),
    ).toBe("Ma’lumotlar noto‘g‘ri. To‘ldirilgan maydonlarni tekshiring.");
  });

  test("keeps a human-authored Russian business error in the Russian UI", () => {
    expect(
      getPublicErrorMessage({
        code: "CONFLICT",
        isValidationError: false,
        locale: "ru",
        message: "Кандидат уже добавлен",
      }),
    ).toBe("Кандидат уже добавлен");
  });

  test("masks technical failures with a localized message", () => {
    expect(
      getPublicErrorMessage({
        code: "INTERNAL_SERVER_ERROR",
        isValidationError: false,
        locale: "en",
        message: 'duplicate key violates constraint "users_pkey"',
      }),
    ).toBe("The action could not be completed. Please try again later.");
  });
});
