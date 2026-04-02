import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import {
  buildHhAuthorizeUrl,
  buildHhConnectState,
  isHhConfigured,
} from "~/server/services/hh";
import { ensureUserCompanyId } from "~/server/utils/ensure-user-company";
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

  const companyId = await ensureUserCompanyId(session.user.id);
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
  const authorizeUrl = buildHhAuthorizeUrl({
    requestUrl: request.url,
    state,
  });

  console.info("[hh.uz] redirecting user to HH authorize page", {
    userId: session.user.id,
    companyId,
    authorizeOrigin: new URL(authorizeUrl).origin,
  });

  return NextResponse.redirect(authorizeUrl);
}
