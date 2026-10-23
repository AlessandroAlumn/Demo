import { db } from "@/lib/db";

/** GET /api/health: for the host's health check. Open (no login), reveals nothing but whether the database answers. */
export async function GET() {
  try {
    await db.setting.count();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
