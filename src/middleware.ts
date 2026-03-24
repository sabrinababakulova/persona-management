import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const isSecureRequest =
    forwardedProto === "https" || request.nextUrl.protocol === "https:";
  const useSecureCookie =
    process.env.AUTH_URL?.startsWith("https://") ?? isSecureRequest;

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: useSecureCookie,
  });
  const isAuthenticated = Boolean(token?.id);

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/candidates/:path*",
    "/vacancies/:path*",
    "/my-profile/:path*",
  ],
};
