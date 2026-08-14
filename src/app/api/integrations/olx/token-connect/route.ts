import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env";
import { clearIdentifier } from "~/server/auth/rate-limit";
import { db } from "~/server/db";
import { userOlxSessions } from "~/server/db/schema";
import {
  consumeOlxConnectionTicket,
  encryptOlxCredentials,
  OlxApiError,
  olxCredentialsSchema,
  verifyOlxCredentials,
} from "~/server/services/olx-api";

export const runtime = "nodejs";

const requestSchema = z.object({
  ticket: z.string().min(40).max(200),
  credentials: olxCredentialsSchema,
});

function extensionOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  return origin?.startsWith("chrome-extension://") ? origin : null;
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

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 70_000) {
    return json(origin, { error: "payload_too_large" }, 413);
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return json(origin, { error: "invalid_request" }, 400);
  }

  const userId = await consumeOlxConnectionTicket(db, parsed.ticket);
  if (!userId) {
    return json(origin, { error: "ticket_invalid_or_expired" }, 401);
  }

  try {
    const verified = await verifyOlxCredentials(parsed.credentials);
    const encryptedStorageState = encryptOlxCredentials(
      verified.credentials,
      env.AUTH_SECRET,
    );
    const now = new Date();
    const existingRows = await db
      .select({ id: userOlxSessions.id })
      .from(userOlxSessions)
      .where(eq(userOlxSessions.userId, userId))
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      await db
        .update(userOlxSessions)
        .set({
          encryptedStorageState,
          loginHint: verified.account.loginHint,
          status: "connected",
          lastVerifiedAt: now,
          lastOperationAt: now,
          lastError: null,
        })
        .where(eq(userOlxSessions.id, existing.id));
    } else {
      await db.insert(userOlxSessions).values({
        userId,
        encryptedStorageState,
        loginHint: verified.account.loginHint,
        status: "connected",
        lastVerifiedAt: now,
        lastOperationAt: now,
      });
    }

    await clearIdentifier(`olx-login-attempts:${userId}`);

    return json(
      origin,
      {
        success: true,
        account: verified.account.loginHint,
      },
      200,
    );
  } catch (error) {
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
