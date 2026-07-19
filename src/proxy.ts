import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Uses the Edge-safe base config directly (not lib/auth.ts) so this middleware
// bundle never pulls in Prisma/bcrypt, which cannot run in the Edge runtime.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isPublic && pathname !== "/") {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Excludes API routes, Next internals, and any request for a static file
  // (icons, logo images, manifest, etc.) — those live under /public and must
  // be servable on logged-out pages too (e.g. the logo on the login screen).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
