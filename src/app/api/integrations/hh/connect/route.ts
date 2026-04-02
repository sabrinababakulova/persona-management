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
import { buildAppUrl } from "~/server/utils/request-url";

export async function GET(request: Request) {
  if (!isHhConfigured()) {
    console.info("[hh.uz] connect skipped because HH env is not configured");
    return NextResponse.redirect(
      buildAppUrl("/my-profile?section=company-settings", request),
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    console.info("[hh.uz] connect skipped because user session is missing");
    return NextResponse.redirect(buildAppUrl("/login", request));
  }

  const userRows = await db
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const companyId = userRows[0]?.companyId;
  if (!companyId) {
    console.info("[hh.uz] connect skipped because user companyId is missing", {
      userId: session.user.id,
    });
    return NextResponse.redirect(
      buildAppUrl("/my-profile?section=company-settings", request),
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
