"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  { href: "/admin", key: "overview", exact: true },
  { href: "/admin/import", key: "import" },
  { href: "/admin/donors", key: "donors" },
  { href: "/admin/rankings", key: "rankings" },
  { href: "/admin/badges", key: "badges" },
  { href: "/admin/claims", key: "claims" },
  { href: "/admin/posts", key: "posts" },
  { href: "/admin/at-risk", key: "atRisk" },
  { href: "/admin/settings", key: "settings" },
] as const;

/** Section tabs of the backoffice; the current one is highlighted. */
export default function AdminNav() {
  const t = useTranslations("Admin.nav");
  const tAdmin = useTranslations("Admin");
  const pathname = usePathname();

  return (
    <nav aria-label={tAdmin("title")} className="border-b border-gray-200 bg-brand-white">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {ITEMS.map((item) => {
          const active = "exact" in item ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 font-accent text-sm font-semibold ${
                  active ? "border-brand-yellow text-brand-black" : "border-transparent text-gray-400 hover:text-brand-black"
                }`}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
