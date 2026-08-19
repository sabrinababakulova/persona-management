import { describe, expect, test } from "bun:test";
import { claimOlxConnectionTicket } from "./connection-ticket";

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

describe("OLX connection tickets", () => {
  test("claims a pending ticket with a concrete non-null identifier", async () => {
    const extensionId = "extension-id";
    const userId = "user-id";
    const pendingIdentifier = `olx-connect:pending:${extensionId}:${userId}`;
    const database = ticketDatabase(pendingIdentifier);

    const claim = await claimOlxConnectionTicket(
      database.db as never,
      "one-time-ticket",
      extensionId,
    );

    expect(claim).not.toBeNull();
    expect(claim?.pendingIdentifier).toBe(pendingIdentifier);
    expect(claim?.userId).toBe(userId);
    expect(database.assignedIdentifier()).toBe(claim?.claimIdentifier);
    expect(typeof database.assignedIdentifier()).toBe("string");
    expect(claim?.claimIdentifier).toMatch(
      /^olx-connect:verifying:[A-Za-z0-9_-]{22}:extension-id:user-id$/,
    );
  });

  test("does not update when no matching pending ticket exists", async () => {
    const database = ticketDatabase(undefined);

    const claim = await claimOlxConnectionTicket(
      database.db as never,
      "missing-ticket",
      "extension-id",
    );

    expect(claim).toBeNull();
    expect(database.assignedIdentifier()).toBeUndefined();
  });
});
