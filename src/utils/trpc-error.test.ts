import { describe, expect, test } from "bun:test";
import { TRPCClientError } from "@trpc/client";

import { isUnauthorizedError, resolveTrpcError } from "./trpc-error";

/** Builds a client-side error shaped like one the tRPC server would send back. */
function serverError(
  message: string,
  data: {
    code: string;
    httpStatus: number;
    zodError?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    } | null;
  },
) {
  return TRPCClientError.from({
    error: { message, code: -32600, data },
  } as never);
}

describe("resolveTrpcError", () => {
  test("carries the real HTTP status even though the wire response is 200", () => {
    // `httpBatchStreamLink` always returns 200; the per-call status lives in
    // the body, and this is the only place it surfaces.
    const resolved = resolveTrpcError(
      serverError("Недостаточно прав", { code: "FORBIDDEN", httpStatus: 403 }),
    );

    expect(resolved.code).toBe("FORBIDDEN");
    expect(resolved.httpStatus).toBe(403);
  });

  test("keeps user-facing messages for deliberately thrown codes", () => {
    const resolved = resolveTrpcError(
      serverError("Кандидат не найден", { code: "NOT_FOUND", httpStatus: 404 }),
    );

    expect(resolved.message).toBe("Кандидат не найден");
  });

  test("keeps Russian INTERNAL_SERVER_ERROR messages authored for the user", () => {
    const resolved = resolveTrpcError(
      serverError("Не удалось отправить сообщение в Telegram", {
        code: "INTERNAL_SERVER_ERROR",
        httpStatus: 500,
      }),
    );

    expect(resolved.message).toBe("Не удалось отправить сообщение в Telegram");
  });

  test("masks raw exception text so internals never reach the UI", () => {
    const resolved = resolveTrpcError(
      serverError(
        'duplicate key value violates unique constraint "users_pkey"',
        {
          code: "INTERNAL_SERVER_ERROR",
          httpStatus: 500,
        },
      ),
    );

    expect(resolved.message).toBeNull();
    expect(resolved.messageKey).toBe("serverError");
  });

  test("extracts field and form errors from a Zod failure", () => {
    const resolved = resolveTrpcError(
      serverError("[{...}]", {
        code: "BAD_REQUEST",
        httpStatus: 400,
        zodError: {
          fieldErrors: { email: ["Некорректный email"], name: [] },
          formErrors: ["Проверьте форму"],
        },
      }),
    );

    expect(resolved.fieldErrors).toEqual({ email: ["Некорректный email"] });
    expect(resolved.formErrors).toEqual(["Проверьте форму"]);
    // The serialized issue dump must never be shown in place of the real detail.
    expect(resolved.message).toBeNull();
  });

  test("reports a failed fetch as a network error rather than a server fault", () => {
    const resolved = resolveTrpcError(new TypeError("Failed to fetch"));

    expect(resolved.isNetworkError).toBe(true);
    expect(resolved.messageKey).toBe("network");
    expect(resolved.httpStatus).toBe(0);
  });

  test("falls back to a generic server error for unknown throwables", () => {
    const resolved = resolveTrpcError({ nope: true });

    expect(resolved.code).toBe("INTERNAL_SERVER_ERROR");
    expect(resolved.messageKey).toBe("serverError");
  });
});

describe("isUnauthorizedError", () => {
  test("detects an expired session", () => {
    expect(
      isUnauthorizedError(
        serverError("UNAUTHORIZED", { code: "UNAUTHORIZED", httpStatus: 401 }),
      ),
    ).toBe(true);
  });

  test("does not treat other failures as an auth problem", () => {
    expect(
      isUnauthorizedError(
        serverError("Нет прав", { code: "FORBIDDEN", httpStatus: 403 }),
      ),
    ).toBe(false);
  });
});
