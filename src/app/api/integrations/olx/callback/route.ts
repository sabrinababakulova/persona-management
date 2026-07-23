import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { userOlxAccounts } from "~/server/db/schema";
import {
  exchangeOlxAuthorizationCode,
  parseOlxConnectState,
  resolveOlxAccountProfile,
} from "~/server/services/olx";
import { buildAppUrl } from "~/server/utils/request-url";

function redirectToSettings(
  request: Request,
  outcome: "connected" | "denied" | "failed",
) {
  const query =
    outcome === "connected"
      ? "olx_connected=1"
      : `olx_error=${encodeURIComponent(outcome)}`;
  return NextResponse.redirect(
    buildAppUrl(`/my-profile?section=company-settings&${query}`, request),
  );
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(buildAppUrl("/login", request));
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (error) {
    return redirectToSettings(request, "denied");
  }
  if (!code || !state) {
    return redirectToSettings(request, "failed");
  }

  const parsedState = parseOlxConnectState(state);
  if (!parsedState || parsedState.userId !== session.user.id) {
    return redirectToSettings(request, "failed");
  }

  try {
    const tokens = await exchangeOlxAuthorizationCode({
      code,
      requestUrl: request.url,
    });
    const profile = await resolveOlxAccountProfile(tokens.accessToken);
    const values = {
      olxUserId: profile.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      isBusiness: profile.isBusiness,
    };

    await db
      .insert(userOlxAccounts)
      .values({
        userId: session.user.id,
        ...values,
      })
      .onConflictDoUpdate({
        target: userOlxAccounts.userId,
        set: values,
      });
  } catch (callbackError) {
    console.error("Failed to complete OLX OAuth callback", callbackError);
    return redirectToSettings(request, "failed");
  }

  return redirectToSettings(request, "connected");
}
