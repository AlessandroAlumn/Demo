import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";

// Everything inside this route group requires a logged-in user.
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  return <>{children}</>;
}
