import { getCurrentUser } from "@/lib/auth";
import { AT_RISK_COLUMNS, atRiskToCsvRows, getAtRisk } from "@/lib/admin-queries";
import { getToday } from "@/lib/clock";
import { toCsv } from "@/lib/csv-export";

/** GET /api/admin/at-risk: the at-risk recurring donors as a CSV download. Admins only. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Forbidden", { status: 403 });

  const [rows, today] = await Promise.all([getAtRisk(), getToday()]);
  return new Response(toCsv(AT_RISK_COLUMNS, atRiskToCsvRows(rows)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="at-risk-recurring-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
