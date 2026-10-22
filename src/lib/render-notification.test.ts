import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { STORED_TYPES } from "./notification-types";
import { renderNotification, type PostView, type RenderEnv } from "./render-notification";

const catalogs = { en, es } as const;

const post: PostView = { id: "P1", kind: "campaign", title: "Earthquake relief", body: "Help us.", campaign: "camp", goalAmount: 1800 };

function envFor(locale: "en" | "es"): RenderEnv {
  const messages = catalogs[locale] as Record<string, unknown>;
  const t = createTranslator({
    locale, messages, namespace: "Notifications",
    onError: (e) => { throw e; },
  }) as unknown as RenderEnv["t"];
  const nameOf = (ns: string) => (key: string) => ((messages[ns] as Record<string, string>)[key] ?? key);
  return {
    t,
    money: (n) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n),
    number: (n) => new Intl.NumberFormat(locale).format(n),
    monthLabel: (ym) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`)),
    rankingName: nameOf("Rankings"),
    badgeName: (id, period) => `${id}${period ? `:${period}` : ""}`,
    badgeIcon: () => "🏅",
    programName: nameOf("Programs"),
    networkName: nameOf("Networks"),
    tierName: nameOf("Tiers"),
    impact: (key, units) => `${units}×${key}`,
    post: (id) => (id === "P1" ? post : undefined),
    campaignRaised: () => 900,
  };
}

/** One realistic param set per stored type. */
const SAMPLES: Record<string, unknown> = {
  N1: { badgeId: "B-S2", periodKey: "" },
  N3: { badgeId: "B-M2", remainingUsd: 15, targetUsd: 250 },
  N4: { ranking: "monthly", periodKey: "2026-08", from: 215, to: 214, total: 2000, gap: { dollars: 12, nextRank: 213 }, keepLead: false },
  N5: { ranking: "yearly", periodKey: "2026", from: 214, to: 215, total: 2000, gap: { dollars: 12, nextRank: 214 }, keepLead: false },
  N6: { ranking: "alltime", rank: 214, total: 2000, gapDollars: 12, nextRank: 213 },
  N7: { month: "2026-03", rank: 31, total: 1840, topPercent: 2 },
  N8: { year: "2026", rank: 120, total: 3100, topPercent: 4 },
  N9: { badgeId: "B-C2", periodKey: "2026-07", amountUsd: 2000 },
  N10: { month: "2026-07", gained: 340 },
  N11: { month: "2026-08" },
  N12: { tier: "gold", streak: 8, monthlyAmount: 100 },
  N13: { daysLeft: 2, streak: 8 },
  N14: { tier: "gold", streak: 8 },
  N15: { streakRestored: true, tier: "gold", streak: 7 },
  N16: { tier: "gold", badgeIds: ["B-R3"] },
  N17: { nextTier: "silver", gapUsd: 5 },
  N18: { donationId: "DON-1", amountUsd: 50, program: "becas" },
  N19: { key: "scholarshipMonth", units: 2, usd: 300, lifetimeUsd: 650 },
  N20: { years: 3 },
  N21: { lastDonation: "2025-12-05", months: 6 },
  N22: { year: "2026", amountUsd: 150, badgeUnlocked: true },
  N23: { year: "2026" },
  N24: { network: "instagram", badgeId: "B-SO1" },
  N25: { network: "tiktok" },
  N26: { badgeUnlocked: true },
  N27: { postId: "P1" },
  N28: { postId: "P1" },
  N29: { postId: "P1", kind: "pct", pct: 50, raisedUsd: 900 },
  N30: { milestoneUsd: 200000 },
  N31: {},
};

const row = (type: string, params: unknown) => ({ id: `n-${type}`, type, params, createdAt: "2026-08-20", readAt: null });

describe("renderNotification", () => {
  for (const locale of ["en", "es"] as const) {
    it(`renders every stored notification type in ${locale} without missing messages`, () => {
      const env = envFor(locale);
      for (const type of STORED_TYPES) {
        expect(SAMPLES[type], `sample for ${type}`).toBeDefined();
        const r = renderNotification(row(type, SAMPLES[type]), env);
        expect(r.text.length, type).toBeGreaterThan(3);
        expect(r.text, type).not.toContain("Notifications.");
        expect(r.type).toBe(type);
        expect(r.read).toBe(false);
      }
    });
  }

  it("covers the whole registry with samples", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...STORED_TYPES].sort());
  });

  it("renders the rank-up example from the spec in both languages", () => {
    const en = renderNotification(row("N4", SAMPLES.N4), envFor("en"));
    expect(en.text).toBe("You moved up in the monthly ranking: #215 → #214 of 2,000.");
    expect(en.detail).toBe("You're only $12 away from #213.");
    const es = renderNotification(row("N4", SAMPLES.N4), envFor("es"));
    expect(es.text).toBe("Subiste en el ranking mensual: #215 → #214 de 2000.");
    expect(es.detail).toContain("del puesto #213.");
  });

  it("says 'keep your lead' for #1 and has no donate button", () => {
    const r = renderNotification(row("N4", { ...(SAMPLES.N4 as object), to: 1, from: 2, gap: null, keepLead: true }), envFor("en"));
    expect(r.detail).toBe("You're #1! Keep your lead.");
    expect(r.cta).toBeUndefined();
  });

  it("uses plurals correctly and picks week vs month for Donor of the ...", () => {
    const one = renderNotification(row("N10", { month: "2026-07", gained: 1 }), envFor("en"));
    expect(one.text).toContain("+1 position.");
    const many = renderNotification(row("N10", { month: "2026-07", gained: 340 }), envFor("en"));
    expect(many.text).toContain("+340 positions.");
    expect(renderNotification(row("N9", { badgeId: "B-C1", periodKey: "2026-W30" }), envFor("en")).text).toBe("You're the Donor of the Week!");
    expect(renderNotification(row("N9", { badgeId: "B-C2", periodKey: "2026-07" }), envFor("es")).text).toBe("¡Eres el Donante del Mes!");
  });

  it("handles a failed payment with and without a tier, with the update-card button", () => {
    const withTier = renderNotification(row("N12", SAMPLES.N12), envFor("en"));
    expect(withTier.text).toBe("Your monthly donation isn't going through. Your Gold Recurring status and 8-month streak are at risk.");
    expect(withTier.cta).toMatchObject({ label: "Update my card", external: true });
    const noTier = renderNotification(row("N12", { tier: null, streak: 1, monthlyAmount: 10 }), envFor("en"));
    expect(noTier.text).toBe("Your monthly donation isn't going through. Your 1-month streak is at risk.");
    expect(renderNotification(row("N13", { daysLeft: 1, streak: 8 }), envFor("es")).text).toBe("Queda 1 día para salvar tu racha de 8 meses.");
  });

  it("shows campaign progress on N28 and N29", () => {
    const r = renderNotification(row("N28", { postId: "P1" }), envFor("en"));
    expect(r.progress).toEqual({ raised: 900, goal: 1800, pct: 50 });
    expect(renderNotification(row("N29", { postId: "P1", kind: "ending", pct: 92, daysLeft: 5 }), envFor("en")).text).toBe(
      "Earthquake relief: 92% of the goal reached, 5 days left!",
    );
  });

  it("marks read notifications and survives unknown posts and types", () => {
    const read = renderNotification({ ...row("N31", {}), readAt: "2026-08-21" }, envFor("en"));
    expect(read.read).toBe(true);
    expect(renderNotification(row("N27", { postId: "missing" }), envFor("en")).text).toBe("");
    expect(renderNotification(row("N99", {}), envFor("en")).text).toBe("N99");
  });
});

describe("message catalogs", () => {
  const keys = (o: unknown, prefix = ""): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  const empty = (o: unknown, prefix = ""): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === "string" ? (v.trim() === "" ? [`${prefix}${k}`] : []) : empty(v, `${prefix}${k}.`),
    );

  it("have exactly the same keys in Spanish and English", () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });

  it("have no empty strings", () => {
    expect(empty(en)).toEqual([]);
    expect(empty(es)).toEqual([]);
  });
});
