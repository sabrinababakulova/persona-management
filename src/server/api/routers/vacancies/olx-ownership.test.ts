import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import { requireOlxPublisherOwnership } from "./olx-ownership";

describe("OLX publication ownership", () => {
  test("allows the user whose personal OLX account published the advert", () => {
    expect(() =>
      requireOlxPublisherOwnership("user-1", "user-1", "manage"),
    ).not.toThrow();
  });

  test("allows a legacy row to establish its owner", () => {
    expect(() =>
      requireOlxPublisherOwnership(null, "user-1", "manage"),
    ).not.toThrow();
  });

  test("rejects a teammate using the publisher's credentials", () => {
    try {
      requireOlxPublisherOwnership("publisher", "teammate", "delete");
      throw new Error("Expected ownership check to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});
