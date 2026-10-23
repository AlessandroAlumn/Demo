import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEarnedBadge } from "@/lib/donor-queries";

const TIER_COLORS: Record<string, string> = {
  bronze: "#b9722f",
  silver: "#a7b0bd",
  gold: "#f9cf00",
  platinum: "#5fb4c9",
  diamond: "#6f7bf7",
};

let logoDataUri: string | null = null;
async function logo(): Promise<string> {
  if (!logoDataUri) {
    const bytes = await readFile(join(process.cwd(), "public", "brand", "logo-white.png"));
    logoDataUri = `data:image/png;base64,${bytes.toString("base64")}`;
  }
  return logoDataUri;
}

const hasEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

/**
 * GET /api/share-card/B-S2?period=&locale=es&format=card|story&download=1
 * A PNG of one of the signed-in donor's own badges, for sharing. 401 if signed out, 404 if not earned.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/share-card/[badgeId]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "donor" || !user.donorId) return new Response("Unauthorized", { status: 401 });

  const { badgeId } = await ctx.params;
  const q = request.nextUrl.searchParams;
  const locale = q.get("locale") === "en" ? "en" : "es";
  const story = q.get("format") === "story";

  const badge = await getEarnedBadge(user.donorId, badgeId, q.get("period") ?? undefined, locale);
  if (!badge) return new Response("Badge not earned", { status: 404 });

  const messages = (await import(`../../../../../messages/${locale}.json`)).default as {
    Share: { card: { label: string; by: string; cta: string; tagline: string } };
  };
  const card = messages.Share.card;
  const alias = user.alias ?? user.username;
  const ring = TIER_COLORS[badge.tier ?? ""] ?? TIER_COLORS.gold;
  const width = story ? 1080 : 1200;
  const height = story ? 1920 : 630;
  const s = story ? 1.5 : 0.78; // the 630px-high post card is scaled down so everything fits
  const logoSrc = await logo();

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#111111",
          color: "#ffffff",
          padding: `${48 * s}px`,
          borderTop: `${14 * s}px solid #f9cf00`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="AlumnUSB" width={Math.round(240 * s)} height={Math.round(75 * s)} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 210 * s,
              height: 210 * s,
              borderRadius: "50%",
              background: "#fdf5cc",
              border: `${12 * s}px solid ${ring}`,
              fontSize: 110 * s,
              color: "#111111",
            }}
          >
            {hasEmoji(badge.icon) ? badge.icon : badge.name.slice(0, 1)}
          </div>
          <div style={{ marginTop: 28 * s, fontSize: 26 * s, letterSpacing: 4 * s, color: "#f9cf00", display: "flex" }}>
            {card.label}
          </div>
          <div style={{ marginTop: 12 * s, fontSize: 64 * s, fontWeight: 700, lineHeight: 1.1, display: "flex" }}>
            {badge.name}
          </div>
          <div style={{ marginTop: 16 * s, fontSize: 32 * s, color: "#d0d5dd", display: "flex" }}>
            {fill(card.by, { alias })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              background: "#f9cf00",
              color: "#111111",
              fontSize: 32 * s,
              fontWeight: 700,
              padding: `${12 * s}px ${34 * s}px`,
              borderRadius: 999,
            }}
          >
            {card.cta}
          </div>
          <div style={{ marginTop: 14 * s, fontSize: 22 * s, color: "#98a2b3", display: "flex" }}>{card.tagline}</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        "Cache-Control": "no-store",
        ...(q.get("download") ? { "Content-Disposition": `attachment; filename="alumnusb-${badge.id}${story ? "-story" : ""}.png"` } : {}),
      },
    },
  );
  return image;
}
