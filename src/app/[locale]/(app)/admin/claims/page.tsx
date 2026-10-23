import { getTranslations, setRequestLocale } from "next-intl/server";
import { titleFor } from "@/lib/page-title";
import { getClaims } from "@/lib/admin-queries";
import { SOCIAL_URLS, type SocialNetwork } from "@/lib/constants";
import { makeFormatters } from "@/lib/format";
import { reviewClaimAction } from "./actions";

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  titleFor(params, "Admin.nav", "claims");

export default async function ClaimsPage({ params }: PageProps<"/[locale]/admin/claims">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tNetworks] = await Promise.all([getTranslations("Admin.claims"), getTranslations("Networks")]);
  const f = makeFormatters(locale);
  const { pending, reviewed } = await getClaims();
  const network = tNetworks as unknown as (k: string) => string;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <section>
        <h2 className="text-2xl text-brand-black">{t("pending")}</h2>
        {pending.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-200 bg-brand-white p-6 text-center text-sm text-gray-500">{t("empty")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-brand-white p-4 shadow-sm">
                <div>
                  <p className="font-medium text-brand-black">
                    {c.donorName} <span className="ml-1 rounded-full bg-brand-yellow px-2 py-0.5 font-accent text-[11px] font-semibold">{c.username}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    <a href={SOCIAL_URLS[c.network as SocialNetwork]} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue hover:underline">
                      {network(c.network)} ↗
                    </a>{" "}
                    · {f.date(c.createdAt)}
                  </p>
                </div>
                <form action={reviewClaimAction} className="flex gap-2">
                  <input type="hidden" name="claimId" value={c.id} />
                  <button type="submit" name="decision" value="approve" className="rounded-lg bg-brand-black px-4 py-2 font-accent text-sm font-semibold text-brand-white hover:bg-gray-500">
                    {t("approve")}
                  </button>
                  <button type="submit" name="decision" value="reject" className="rounded-lg border border-red-200 px-4 py-2 font-accent text-sm font-semibold text-red-700 hover:bg-red-50">
                    {t("reject")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="text-2xl text-brand-black">{t("reviewed")}</h2>
          <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
            {reviewed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{c.donorName}</span> · {network(c.network)}
                </span>
                <span className="flex items-center gap-3 text-gray-400">
                  {c.reviewedAt ? f.date(c.reviewedAt) : ""}
                  <span className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${c.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                    {c.status === "approved" ? t("approved") : t("rejected")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
