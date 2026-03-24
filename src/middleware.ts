import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const authPaths = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
  const isAuthenticated = !!token?.id;

  const isAuth = authPaths.some((p) => pathname.startsWith(p));

  // Check auth pages first — these must remain accessible to unauthenticated users
  if (isAuth) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Everything else in the matcher is protected
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
    "/login",
    "/register",
  ],
};
