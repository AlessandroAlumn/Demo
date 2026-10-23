import AdminNav from "@/components/admin/AdminNav";
import TimeMachine from "@/components/admin/TimeMachine";
import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_END_DATE, getDemoState } from "@/lib/pipeline";
import { db } from "@/lib/db";

// Backoffice: admins only. A donor who types the URL is sent back to their dashboard.
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role !== "admin") redirectTo("/dashboard", locale);
  const { today, launchDate } = await getDemoState(db);

  return (
    <>
      <AdminNav />
      <div className="pb-28">{children}</div>
      <TimeMachine today={today} launchDate={launchDate} endDate={DEMO_END_DATE} variant="bar" />
    </>
  );
}
