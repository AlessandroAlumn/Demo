import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/**
 * `redirect` from next-intl is typed `void`; this wrapper is typed `never` so TypeScript narrows
 * (e.g. `if (!user) redirectTo("/login", locale)` leaves `user` non-null afterwards).
 */
export function redirectTo(href: string, locale: string): never {
  redirect({ href, locale });
  throw new Error("unreachable: redirect() always throws");
}
