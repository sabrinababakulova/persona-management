import { describe, expect, test } from "bun:test";
import {
  RequestBodyTooLargeError,
  readJsonBodyLimited,
} from "./read-json-body";

describe("bounded JSON request reader", () => {
  test("reads a chunked body within the byte limit", async () => {
    const encoder = new TextEncoder();
    const request = new Request("https://example.test", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"ok":'));
          controller.enqueue(encoder.encode("true}"));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);

    expect(await readJsonBodyLimited(request, 32)).toEqual({ ok: true });
  });

  test("stops a chunked body once its actual bytes exceed the limit", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: '{"value":"too large"}',
    });
    expect(readJsonBodyLimited(request, 8)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  test("rejects an oversized declared content length before reading", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "Content-Length": "100" },
      body: "{}",
    });
    expect(readJsonBodyLimited(request, 8)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });
});
