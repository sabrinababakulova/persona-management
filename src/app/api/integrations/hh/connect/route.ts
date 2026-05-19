import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
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

  const state = buildHhConnectState({
    userId: session.user.id,
  });
  const authorizeUrl = buildHhAuthorizeUrl({
    requestUrl: request.url,
    state,
  });

  console.info("[hh.uz] redirecting user to HH authorize page", {
    userId: session.user.id,
    authorizeOrigin: new URL(authorizeUrl).origin,
  });

  return NextResponse.redirect(authorizeUrl);
}
