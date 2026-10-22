import { setRequestLocale } from "next-intl/server";
import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";

// The home page only routes: logged-in users go to their area, everyone else to the login.
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  redirectTo(user.role === "admin" ? "/admin" : "/dashboard", locale);
}
