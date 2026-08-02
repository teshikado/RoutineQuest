import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Uses the Edge-safe base config directly (not lib/auth.ts) so this middleware
// bundle never pulls in Prisma/bcrypt, which cannot run in the Edge runtime.
const { auth } = NextAuth(authConfig);

// Auth pages -- only meant for logged-out visitors, so a logged-in user gets bounced to the
// dashboard instead (see below).
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
// Legal pages -- must stay reachable regardless of login state (a prospective user reads the
// privacy policy before registering; an existing user reaches it from Settings).
const ALWAYS_PUBLIC_PATHS = ["/datenschutz", "/impressum"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAlwaysPublic = ALWAYS_PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isAlwaysPublic) {
    return NextResponse.next();
  }

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
