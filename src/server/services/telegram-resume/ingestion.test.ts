import { describe, expect, test } from "bun:test";

import {
  getTelegramResumeIgnoredReason,
  toTelegramResumeDocumentInput,
} from "./ingestion";

const config = {
  chatId: "-4910953100",
  companyId: "company-id",
  vacancyId: "vacancy-id",
  webhookSecret: "secret-secret-secret",
};

describe("Telegram resume update parsing", () => {
  test("extracts a PDF document from the configured group", () => {
    const result = toTelegramResumeDocumentInput(config, {
      update_id: 101,
      message: {
        message_id: 42,
        date: 1_700_000_000,
        chat: { id: -4910953100, type: "group" },
        document: {
          file_id: "bot-file-id",
          file_unique_id: "stable-file-id",
          file_name: "candidate.pdf",
          mime_type: "application/pdf",
          file_size: 1234,
        },
      },
    });

    expect(result?.companyId).toBe("company-id");
    expect(result?.vacancyId).toBe("vacancy-id");
    expect(result?.chatId).toBe("-4910953100");
    expect(result?.messageId).toBe(42);
    expect(result?.updateId).toBe("101");
    expect(result?.source).toBe("bot");
    expect(result?.document.fileId).toBe("bot-file-id");
    expect(result?.document.fileUniqueId).toBe("stable-file-id");
    expect(result?.messageDate?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  test("accepts channel_post and ignores documents from every other chat", () => {
    const otherChat = toTelegramResumeDocumentInput(config, {
      update_id: 102,
      channel_post: {
        message_id: 43,
        date: 1_700_000_001,
        chat: { id: -100123, type: "channel" },
        document: {
          file_id: "file",
          file_unique_id: "unique",
          file_name: "candidate.pdf",
        },
      },
    });

    expect(otherChat).toBe(null);
  });

  test("ignores non-document messages", () => {
    const result = toTelegramResumeDocumentInput(config, {
      update_id: 103,
      message: {
        message_id: 44,
        date: 1_700_000_002,
        chat: { id: -4910953100, type: "group" },
      },
    });

    expect(result).toBe(null);
  });
});

describe("Telegram resume file filtering", () => {
  test("accepts PDF by extension or MIME type", () => {
    expect(
      getTelegramResumeIgnoredReason({
        fileName: "candidate.pdf",
        mimeType: "application/octet-stream",
        fileSize: 1024,
      }),
    ).toBe(null);
    expect(
      getTelegramResumeIgnoredReason({
        fileName: "candidate",
        mimeType: "application/pdf",
        fileSize: 1024,
      }),
    ).toBe(null);
    expect(
      getTelegramResumeIgnoredReason({
        fileName: "candidate",
        mimeType: "application/octet-stream",
        fileSize: 1024,
      }),
    ).toBe(null);
  });

  test("records unsupported and oversized documents as ignored", () => {
    expect(
      getTelegramResumeIgnoredReason({
        fileName: "candidate.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 1024,
      })?.includes("Only PDF"),
    ).toBe(true);
    expect(
      getTelegramResumeIgnoredReason({
        fileName: "candidate.pdf",
        mimeType: "application/pdf",
        fileSize: 10 * 1024 * 1024 + 1,
      })?.includes("exceeds"),
    ).toBe(true);
  });
});
