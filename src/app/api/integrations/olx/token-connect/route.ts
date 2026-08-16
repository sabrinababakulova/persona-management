import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { clearIdentifier, takeRateLimitSlot } from "~/server/auth/rate-limit";
import { db } from "~/server/db";
import { userOlxSessions } from "~/server/db/schema";
import {
  RequestBodyTooLargeError,
  readJsonBodyLimited,
} from "~/server/http/read-json-body";
import {
  claimOlxConnectionTicket,
  completeOlxConnectionTicket,
  encryptStoredOlxCredentials,
  OlxApiError,
  olxCredentialsSchema,
  releaseOlxConnectionTicket,
  verifyOlxCredentials,
} from "~/server/services/olx-api";

export const runtime = "nodejs";

const requestSchema = z.object({
  ticket: z.string().min(40).max(200),
  credentials: olxCredentialsSchema,
});
const MAX_REQUEST_BYTES = 70_000;
const TOKEN_CONNECT_WINDOW_MS = 15 * 60 * 1000;
const TOKEN_CONNECT_ATTEMPT_LIMIT = 20;

function extensionOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  const extensionId = env.OLX_CONNECTOR_EXTENSION_ID;
  return extensionId && origin === `chrome-extension://${extensionId}`
    ? origin
    : null;
}

function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 100);
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",").at(-1)?.trim() || "unknown").slice(0, 100);
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function json(origin: string, body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(origin),
  });
}

export async function OPTIONS(request: Request) {
  const origin = extensionOrigin(request);
  if (!origin) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
  const origin = extensionOrigin(request);
  if (!origin) {
    return NextResponse.json(
      { error: "extension_origin_required" },
      { status: 403 },
    );
  }

  const ipKey = `olx-token-connect-ip:${clientIp(request)}`;
  if (
    !(await takeRateLimitSlot(
      ipKey,
      TOKEN_CONNECT_ATTEMPT_LIMIT,
      TOKEN_CONNECT_WINDOW_MS,
    ))
  ) {
    return json(origin, { error: "rate_limited" }, 429);
  }

  let requestBody: unknown;
  try {
    requestBody = await readJsonBodyLimited(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json(origin, { error: "payload_too_large" }, 413);
    }
    return json(origin, { error: "invalid_request" }, 400);
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(requestBody);
  } catch {
    return json(origin, { error: "invalid_request" }, 400);
  }

  const extensionId = env.OLX_CONNECTOR_EXTENSION_ID;
  if (!extensionId) return json(origin, { error: "connector_disabled" }, 503);
  const claim = await claimOlxConnectionTicket(db, parsed.ticket, extensionId);
  if (!claim) {
    return json(origin, { error: "ticket_invalid_or_expired" }, 401);
  }

  try {
    const verified = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`olx-account:${claim.userId}`}, 0))`,
      );
      const result = await verifyOlxCredentials(parsed.credentials);
      const now = new Date();
      const existingRows = await transaction
        .select({ id: userOlxSessions.id })
        .from(userOlxSessions)
        .where(eq(userOlxSessions.userId, claim.userId))
        .limit(1);
      const existing = existingRows[0];
      const sessionId = existing?.id ?? randomUUID();
      const encryptedStorageState = encryptStoredOlxCredentials(
        result.credentials,
        claim.userId,
        sessionId,
      );

      if (existing) {
        await transaction
          .update(userOlxSessions)
          .set({
            encryptedStorageState,
            loginHint: result.account.loginHint,
            status: "connected",
            lastVerifiedAt: now,
            lastOperationAt: now,
            lastError: null,
          })
          .where(eq(userOlxSessions.id, existing.id));
      } else {
        await transaction.insert(userOlxSessions).values({
          id: sessionId,
          userId: claim.userId,
          encryptedStorageState,
          loginHint: result.account.loginHint,
          status: "connected",
          lastVerifiedAt: now,
          lastOperationAt: now,
        });
      }
      return result;
    });

    await completeOlxConnectionTicket(db, claim);
    await clearIdentifier(`olx-login-attempts:${claim.userId}`);

    return json(
      origin,
      {
        success: true,
        account: verified.account.loginHint,
      },
      200,
    );
  } catch (error) {
    await releaseOlxConnectionTicket(db, claim).catch(() => undefined);
    if (error instanceof OlxApiError) {
      console.warn("OLX token connection was rejected", {
        code: error.code,
        status: error.status ?? null,
        message: error.message,
      });
      const status =
        error.code === "reauth_required"
          ? 401
          : error.code === "rate_limited"
            ? 429
            : 502;
      return json(origin, { error: error.code }, status);
    }

    console.error("Unexpected OLX token connection error", error);
    return json(origin, { error: "connection_failed" }, 500);
  }
}
