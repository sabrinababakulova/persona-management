import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userHhAccounts } from "~/server/db/schema";
import {
  exchangeHhAuthorizationCode,
  parseHhConnectState,
  resolveHhEmployerFromAccessToken,
} from "~/server/services/hh";
import { buildAppUrl } from "~/server/utils/request-url";

function redirectToCompanySettings(request: Request, connected = false) {
  // `hh_connected=1` tells the company-settings screen to run the candidate
  // data migration (initial hh.uz sync) and show its loading screen.
  const suffix = connected ? "&hh_connected=1" : "";
  return NextResponse.redirect(
    buildAppUrl(`/my-profile?section=company-settings${suffix}`, request),
  );
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    console.info("[hh.uz] callback skipped because user session is missing");
    return NextResponse.redirect(buildAppUrl("/login", request));
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error || !code || !state) {
    console.info("[hh.uz] callback missing required params", {
      error,
      hasCode: Boolean(code),
      hasState: Boolean(state),
    });
    return redirectToCompanySettings(request);
  }

  const parsedState = parseHhConnectState(state);
  if (!parsedState || parsedState.userId !== session.user.id) {
    console.info("[hh.uz] callback state validation failed", {
      hasParsedState: Boolean(parsedState),
      sessionUserId: session.user.id,
      stateUserId: parsedState?.userId,
    });
    return redirectToCompanySettings(request);
  }

  let connected = false;
  try {
    const tokens = await exchangeHhAuthorizationCode({
      code,
      requestUrl: request.url,
    });
    const connectedAccount = await resolveHhEmployerFromAccessToken(
      tokens.accessToken,
    );

    const existingRows = await db
      .select({ id: userHhAccounts.id })
      .from(userHhAccounts)
      .where(eq(userHhAccounts.userId, session.user.id))
      .limit(1);

    if (existingRows[0]) {
      await db
        .update(userHhAccounts)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          email: connectedAccount.email,
          employerId: connectedAccount.employerId,
        })
        .where(
          and(
            eq(userHhAccounts.id, existingRows[0].id),
            eq(userHhAccounts.userId, session.user.id),
          ),
        );
    } else {
      await db.insert(userHhAccounts).values({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: connectedAccount.email,
        employerId: connectedAccount.employerId,
        userId: session.user.id,
      });
    }
    connected = true;
  } catch (callbackError) {
    console.error("Failed to complete HH OAuth callback", callbackError);
  }

  return redirectToCompanySettings(request, connected);
}
