import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { companyHhAccounts, users } from "~/server/db/schema";
import {
  exchangeHhAuthorizationCode,
  parseHhConnectState,
  resolveHhEmployerFromAccessToken,
} from "~/server/services/hh";
import { buildAppUrl } from "~/server/utils/request-url";

function redirectToCompanySettings(request: Request) {
  return NextResponse.redirect(
    buildAppUrl("/my-profile?section=company-settings", request),
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

  if (error || !code || !state) {
    return redirectToCompanySettings(request);
  }

  const parsedState = parseHhConnectState(state);
  if (!parsedState || parsedState.userId !== session.user.id) {
    return redirectToCompanySettings(request);
  }

  const userRows = await db
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const companyId = userRows[0]?.companyId;
  if (!companyId || companyId !== parsedState.companyId) {
    return redirectToCompanySettings(request);
  }

  try {
    const tokens = await exchangeHhAuthorizationCode({
      code,
      requestUrl: request.url,
    });
    const connectedAccount = await resolveHhEmployerFromAccessToken(
      tokens.accessToken,
    );

    const existingRows = await db
      .select({ id: companyHhAccounts.id })
      .from(companyHhAccounts)
      .where(eq(companyHhAccounts.companyId, companyId))
      .limit(1);

    if (existingRows[0]) {
      await db
        .update(companyHhAccounts)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          email: connectedAccount.email,
          employerId: connectedAccount.employerId,
        })
        .where(
          and(
            eq(companyHhAccounts.id, existingRows[0].id),
            eq(companyHhAccounts.companyId, companyId),
          ),
        );
    } else {
      await db.insert(companyHhAccounts).values({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: connectedAccount.email,
        employerId: connectedAccount.employerId,
        companyId,
      });
    }
  } catch (callbackError) {
    console.error("Failed to complete HH OAuth callback", callbackError);
  }

  return redirectToCompanySettings(request);
}
