import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { shouldUseSecureCookies } from "~/shared/secure-cookies";

const ONBOARDING_PATH = "/onboarding/company";

export async function middleware(request: NextRequest) {
  // Must match `authConfig.useSecureCookies` exactly: this decides which cookie name
  // `getToken` looks for, and that decides whether a signed-in user is recognised at all.
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: shouldUseSecureCookies(),
  });
  const isAuthenticated = Boolean(token?.id);

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Signed in but without a company — a Google sign-up, which never passed through the company
  // step of registration. The rest of the app stays out of reach until they create or join one.
  const needsCompany = token?.needsCompany === true;
  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");

  if (needsCompany && !isOnboarding) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/calendar/:path*",
    "/candidates/:path*",
    "/vacancies/:path*",
    "/my-profile/:path*",
    "/onboarding/:path*",
  ],
};
