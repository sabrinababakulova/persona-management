import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import {
  buildHhAuthorizeUrl,
  buildHhConnectState,
  isHhConfigured,
} from "~/server/services/hh";

export async function GET(request: Request) {
  if (!isHhConfigured()) {
    return NextResponse.redirect(
      new URL("/my-profile?section=company-settings", request.url),
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userRows = await db
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const companyId = userRows[0]?.companyId;
  if (!companyId) {
    return NextResponse.redirect(
      new URL("/my-profile?section=company-settings", request.url),
    );
  }

  const state = buildHhConnectState({
    companyId,
    userId: session.user.id,
  });

  return NextResponse.redirect(
    buildHhAuthorizeUrl({
      requestUrl: request.url,
      state,
    }),
  );
}
