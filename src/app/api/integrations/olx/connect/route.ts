import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import {
  buildOlxAuthorizeUrl,
  buildOlxConnectState,
  isOlxConfigured,
} from "~/server/services/olx";
import { buildAppUrl } from "~/server/utils/request-url";

export async function GET(request: Request) {
  if (!isOlxConfigured()) {
    return NextResponse.redirect(
      buildAppUrl(
        "/my-profile?section=company-settings&olx_error=not_configured",
        request,
      ),
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(buildAppUrl("/login", request));
  }

  const state = buildOlxConnectState({ userId: session.user.id });
  return NextResponse.redirect(
    buildOlxAuthorizeUrl({ requestUrl: request.url, state }),
  );
}
