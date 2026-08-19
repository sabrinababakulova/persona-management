import { describe, expect, test } from "bun:test";

import { parseTelegramResumeConnectCommand } from "./connection";

const CODE = "a1b2c3d4e5f60718293a4b5c";

describe("Telegram resume group connection commands", () => {
  test("accepts direct and bot-addressed commands", () => {
    expect(parseTelegramResumeConnectCommand(`/connect ${CODE}`)).toBe(CODE);
    expect(
      parseTelegramResumeConnectCommand(
        `/connect@recruiting_people_bot ${CODE.toUpperCase()}`,
      ),
    ).toBe(CODE);
  });

  test("allows surrounding whitespace but no extra arguments", () => {
    expect(parseTelegramResumeConnectCommand(`  /connect ${CODE}\n`)).toBe(
      CODE,
    );
    expect(parseTelegramResumeConnectCommand(`/connect ${CODE} extra`)).toBe(
      null,
    );
  });

  test("rejects missing, short, and non-hex codes", () => {
    expect(parseTelegramResumeConnectCommand(undefined)).toBe(null);
    expect(parseTelegramResumeConnectCommand("/connect")).toBe(null);
    expect(parseTelegramResumeConnectCommand("/connect abc123")).toBe(null);
    expect(
      parseTelegramResumeConnectCommand("/connect zzzzzzzzzzzzzzzzzzzzzzzz"),
    ).toBe(null);
  });
});
