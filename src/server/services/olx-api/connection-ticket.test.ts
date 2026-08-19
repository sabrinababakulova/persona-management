import { describe, expect, test } from "bun:test";
import {
  claimOlxConnectionTicket,
  createOlxConnectionTicket,
  getOlxConnectionTicketScope,
} from "./connection-ticket";

function ticketDatabase(pendingIdentifier: string | undefined) {
  let assignedIdentifier: unknown;
  const transaction = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            for: async () =>
              pendingIdentifier ? [{ identifier: pendingIdentifier }] : [],
          }),
        }),
      }),
    }),
    update: () => ({
      set: (values: { identifier: string }) => {
        assignedIdentifier = values.identifier;
        return {
          where: () => ({
            returning: async () => [{ identifier: values.identifier }],
          }),
        };
      },
    }),
  };

  return {
    assignedIdentifier: () => assignedIdentifier,
    db: {
      transaction: <T>(callback: (tx: typeof transaction) => Promise<T>) =>
        callback(transaction),
    },
  };
}

function ticketCreationDatabase() {
  let insertedValue: unknown;
  const transaction = {
    delete: () => ({ where: async () => undefined }),
    insert: () => ({
      values: async (value: unknown) => {
        insertedValue = value;
      },
    }),
  };

  return {
    insertedValue: () => insertedValue,
    db: {
      transaction: <T>(callback: (tx: typeof transaction) => Promise<T>) =>
        callback(transaction),
    },
  };
}

describe("OLX connection tickets", () => {
  test("creates one ticket row bound to the exact allowed-id set", async () => {
    const database = ticketCreationDatabase();
    const allowedExtensionIds = ["official-id", "local-id", "official-id"];
    const scope = getOlxConnectionTicketScope(allowedExtensionIds);

    const ticket = await createOlxConnectionTicket(
      database.db as never,
      "user-id",
      allowedExtensionIds,
    );

    const inserted = database.insertedValue() as {
      expires: Date;
      identifier: string;
      token: string;
    };
    expect(ticket.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(inserted).toEqual({
      identifier: `olx-connect:pending:${scope}:user-id`,
      token: inserted.token,
      expires: ticket.expiresAt,
    });
    expect(inserted.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Array.isArray(inserted)).toBe(false);
  });

  test("claims a pending ticket with a concrete non-null identifier", async () => {
    const extensionId = "extension-id";
    const allowedExtensionIds = [extensionId, "local-extension-id"];
    const userId = "user-id";
    const scope = getOlxConnectionTicketScope(allowedExtensionIds);
    const pendingIdentifier = `olx-connect:pending:${scope}:${userId}`;
    const database = ticketDatabase(pendingIdentifier);

    const claim = await claimOlxConnectionTicket(
      database.db as never,
      "one-time-ticket",
      extensionId,
      allowedExtensionIds,
    );

    expect(claim).not.toBeNull();
    expect(claim?.pendingIdentifier).toBe(pendingIdentifier);
    expect(claim?.userId).toBe(userId);
    expect(database.assignedIdentifier()).toBe(claim?.claimIdentifier);
    expect(typeof database.assignedIdentifier()).toBe("string");
    expect(claim?.claimIdentifier).toMatch(
      new RegExp(
        `^olx-connect:verifying:[A-Za-z0-9_-]{22}:extension-id:${scope}:user-id$`,
      ),
    );
  });

  test("does not update when no matching pending ticket exists", async () => {
    const database = ticketDatabase(undefined);

    const claim = await claimOlxConnectionTicket(
      database.db as never,
      "missing-ticket",
      "extension-id",
      ["extension-id"],
    );

    expect(claim).toBeNull();
    expect(database.assignedIdentifier()).toBeUndefined();
  });

  test("rejects an extension outside the ticket's exact allowlist", async () => {
    const database = ticketDatabase(
      `olx-connect:pending:${getOlxConnectionTicketScope(["official-id"])}:user-id`,
    );

    const claim = await claimOlxConnectionTicket(
      database.db as never,
      "one-time-ticket",
      "unpacked-id",
      ["official-id"],
    );

    expect(claim).toBeNull();
    expect(database.assignedIdentifier()).toBeUndefined();
  });

  test("uses the same scope regardless of allowlist order or duplicates", () => {
    expect(getOlxConnectionTicketScope(["official-id", "local-id"])).toBe(
      getOlxConnectionTicketScope(["local-id", "official-id", "official-id"]),
    );
  });
});
