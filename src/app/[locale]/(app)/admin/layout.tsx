import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";

// Backoffice: admins only. A donor who types the URL is sent back to their dashboard.
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role !== "admin") redirectTo("/dashboard", locale);
  return <>{children}</>;
}
