import { sql } from "drizzle-orm";
import { db } from "~/server/db";
import { monitorEventBuckets } from "~/server/db/schema";

export type MonitorEventType = "api_request" | "auth_attempt";

type RecordMonitorEventInput = {
  eventType: MonitorEventType;
  target?: string;
  outcome?: string;
  at?: Date;
};

export async function recordMonitorEvent({
  eventType,
  target = "all",
  outcome = "count",
  at = new Date(),
}: RecordMonitorEventInput) {
  const bucketStart = new Date(at);
  bucketStart.setSeconds(0, 0);

  await db
    .insert(monitorEventBuckets)
    .values({
      eventType,
      bucketStart,
      target,
      outcome,
      count: 1,
      lastSeenAt: at,
    })
    .onConflictDoUpdate({
      target: [
        monitorEventBuckets.eventType,
        monitorEventBuckets.bucketStart,
        monitorEventBuckets.target,
        monitorEventBuckets.outcome,
      ],
      set: {
        count: sql`${monitorEventBuckets.count} + 1`,
        lastSeenAt: at,
      },
    });
}
