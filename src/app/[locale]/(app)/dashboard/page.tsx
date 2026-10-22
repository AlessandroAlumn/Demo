import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getToday } from "@/lib/clock";

// Placeholder: the real dashboard (totals, rank cards, badges, feed) is built in step 9.
export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);

  const t = await getTranslations("Dashboard");
  const today = await getToday();

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl text-brand-black md:text-4xl">{t("welcome", { name: user.username })}</h1>
      <p className="mt-2 max-w-2xl font-light text-gray-500">{t("placeholder")}</p>
      <dl className="mt-6 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 rounded-2xl border border-gray-200 bg-brand-white p-5 text-sm shadow-sm">
        <dt className="text-gray-400">{t("donorId")}</dt>
        <dd className="font-medium">{user.donorId}</dd>
        <dt className="text-gray-400">{t("firstDonation")}</dt>
        <dd className="font-medium">{user.donor?.firstDonationDate}</dd>
        <dt className="text-gray-400">{t("today")}</dt>
        <dd className="font-medium">{today}</dd>
      </dl>
    </section>
  );
}
