import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/candidates",
  "/vacancies",
  "/my-profile",
];
const authPaths = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuth = authPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuth && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/candidates/:path*",
    "/vacancies/:path*",
    "/my-profile/:path*",
    "/login",
    "/register",
  ],
};
