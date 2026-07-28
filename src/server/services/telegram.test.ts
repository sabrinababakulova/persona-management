import { describe, expect, test } from "bun:test";

import { createTelegramApi, parseTelegramMessageUrl } from "./telegram";

describe("Telegram grammY API client", () => {
  test("installs the bounded retry transformer", () => {
    const api = createTelegramApi("test-token");
    expect(api.config.installedTransformers().length).toBe(1);
  });
});

describe("parseTelegramMessageUrl", () => {
  test("parses public and private Telegram message links", () => {
    const publicMessage = parseTelegramMessageUrl("https://t.me/example/42");
    expect(publicMessage?.chatId).toBe("@example");
    expect(publicMessage?.messageId).toBe(42);

    const privateMessage = parseTelegramMessageUrl("https://t.me/c/123456/7");
    expect(privateMessage?.chatId).toBe("-100123456");
    expect(privateMessage?.messageId).toBe(7);
  });

  test("rejects unsupported links", () => {
    expect(parseTelegramMessageUrl("https://example.com/message/42")).toBe(
      null,
    );
  });
});
