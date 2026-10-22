import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE } from "./lib/session-cookie";

const intl = createMiddleware(routing);

/**
 * Optimistic guard: no session cookie, no pages except /login. The real check (signature, user
 * exists, role) happens in the layouts through getCurrentUser(); this just avoids rendering for
 * visitors who are obviously logged out.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/(es|en)(\/.*)?$/);

  if (match && !/^\/(es|en)\/login\/?$/.test(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL(`/${match[1]}/login`, request.url));
  }
  return intl(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (images, fonts…)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
