import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { isAuthorized, isHealthCheck } from "./lib/basic-auth";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE } from "./lib/session-cookie";

const intl = createMiddleware(routing);

/**
 * 1. Optional shared password (DEMO_BASIC_AUTH="user:password"): for a demo on a public address.
 * 2. Optimistic guard: no session cookie, no pages except /login. The real check (signature, user exists, role)
 *    happens in the layouts through getCurrentUser(); this just avoids rendering for visitors who are obviously
 *    logged out.
 * 3. Language routing (next-intl).
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const shared = process.env.DEMO_BASIC_AUTH;
  if (shared && !isHealthCheck(pathname) && !isAuthorized(request.headers.get("authorization"), shared)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="AlumnUSB demo", charset="UTF-8"' },
    });
  }

  // API routes check the session themselves and have no language prefix.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const match = pathname.match(/^\/(es|en)(\/.*)?$/);
  if (match && !/^\/(es|en)\/login\/?$/.test(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL(`/${match[1]}/login`, request.url));
  }
  return intl(request);
}

export const config = {
  // Everything except Next's static files and the public brand images / icon.
  matcher: ["/((?!_next/static|_next/image|_vercel|brand/|favicon.ico).*)"],
};
