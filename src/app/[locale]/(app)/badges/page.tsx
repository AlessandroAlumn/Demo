import { getTranslations, setRequestLocale } from "next-intl/server";
import BadgeCard from "@/components/BadgeCard";
import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBadgeCatalog } from "@/lib/donor-queries";
import { makeFormatters } from "@/lib/format";
import { badgeLabels } from "@/lib/badge-labels";

export default async function BadgesPage({ params }: PageProps<"/[locale]/badges">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);
  if (user.gamificationOptOut) redirectTo("/donations", locale);

  const [t, tCategories] = await Promise.all([getTranslations("Badges"), getTranslations("Categories")]);
  const f = makeFormatters(locale);
  const catalog = await getBadgeCatalog(user.donorId!, user.id, locale);
  const labels = await badgeLabels(locale, f);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">
          {t("summary", { earned: catalog.earnedCount, total: catalog.items.length })}
        </p>
      </header>

      {catalog.groups.map((group) => (
        <section key={group.category} aria-labelledby={`cat-${group.category}`}>
          <h2 id={`cat-${group.category}`} className="text-xl text-brand-black">
            {(tCategories as unknown as (k: string) => string)(group.category)}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} labels={labels} f={f} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
