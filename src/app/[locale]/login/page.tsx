import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user) redirectTo(user.role === "admin" ? "/admin" : "/dashboard", locale);

  const t = await getTranslations("Login");

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm sm:p-8">
        <span className="inline-block rounded-full bg-brand-yellow px-3 py-1 font-accent text-xs font-semibold text-brand-black">
          DEMO
        </span>
        <h1 className="mt-3 text-3xl text-brand-black">{t("title")}</h1>
        <p className="mt-1 mb-6 font-light text-gray-500">{t("subtitle")}</p>
        <LoginForm />
      </div>
    </section>
  );
}
