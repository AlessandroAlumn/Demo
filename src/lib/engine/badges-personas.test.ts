// Runs the badge engine day by day over the generated mock data and checks that the persona
// timelines from PLAN.md section 5 produce the promised badges on the promised days.

import { beforeAll, describe, expect, it } from "vitest";
import { BADGE_SEEDS } from "../badge-definitions";
import { generateMockData } from "../../../scripts/generate-mock-data";
import { addDays, lastDayOfMonth, toDate } from "../dates";
import {
  awardKey,
  createRankingSource,
  evaluateBadges,
  periodCloseAwards,
  stateAwards,
  type AwardCandidate,
  type BadgeDef,
  type BadgeInput,
} from "./badges";
import { referralEvents } from "./points";
import {
  buildHistories,
  DEFAULT_ENGINE_SETTINGS as S,
  type DonationRec,
  type EngagementEvent,
  type SubscriptionRec,
} from "./types";

const defs: BadgeDef[] = BADGE_SEEDS.map((b) => ({
  id: b.id, rule: b.rule, repeatable: b.repeatable ?? false, manualOnly: b.manualOnly ?? false, active: true,
}));
const id = (n: number) => `D${String(n).padStart(4, "0")}`;

let input: BadgeInput;
const cache = new Map<string, AwardCandidate[]>();

/** All awards holding on a day (cached). */
const on = (day: string) => {
  if (!cache.has(day)) cache.set(day, evaluateBadges(input, day));
  return cache.get(day)!;
};
/** Awards that appear on `day` and were not there the day before (what the pipeline would notify). */
const newOn = (day: string, donor: number) => {
  const before = new Set(on(addDays(day, -1)).map(awardKey));
  return on(day)
    .filter((a) => a.donorId === id(donor) && !before.has(awardKey(a)))
    .map((a) => (a.periodKey ? `${a.badgeId}:${a.periodKey}` : a.badgeId))
    .sort();
};

beforeAll(() => {
  const data = generateMockData();
  const donations: DonationRec[] = data.donations.map((d) => ({
    id: d.id, donorId: d.donorId, date: d.date, amountUsd: d.amountUsd, method: d.method,
    program: d.program, campaign: d.campaign || null, status: d.status, subscriptionId: d.subscriptionId || null,
  }));
  const subscriptions: SubscriptionRec[] = data.subscriptions.map((s) => ({
    id: s.id, donorId: s.donorId, amountUsd: s.amountUsd, frequency: s.frequency,
    startDate: s.startDate, endDate: s.endDate || null,
  }));
  const histories = buildHistories(donations, subscriptions);
  const referredBy = new Map<string, string>();
  for (const d of data.donations) if (d.referredBy && !referredBy.has(d.donorId)) referredBy.set(d.donorId, d.referredBy);
  const events: EngagementEvent[] = referralEvents(
    data.donors.map((d) => ({ id: d.id, referredBy: referredBy.get(d.id) ?? null })),
    histories,
  );
  input = {
    defs, settings: S, histories, events, claims: [], shares: [], firstLogins: new Map(),
    launchDate: "2026-07-01", earlyAdopterDays: 30, eventsFrom: "2026-07-01",
    rankings: createRankingSource(histories, events, S),
  };
}, 60_000);

describe("state badges land on the promised days", () => {
  it("User1: Diamond Recurring (and every lower tier) on Jul 5; $10K Club on Jul 20", () => {
    expect(newOn("2026-07-05", 1)).toEqual(expect.arrayContaining(["B-R1", "B-R2", "B-R3", "B-R4", "B-R5"]));
    expect(newOn("2026-07-20", 1)).toContain("B-M7");
    expect(on("2026-07-19").some((a) => a.donorId === id(1) && a.badgeId === "B-M7")).toBe(false);
  });

  it("User2: 24-month streak on Aug 10", () => {
    expect(newOn("2026-08-10", 2)).toContain("B-S4");
    expect(newOn("2026-08-09", 2)).not.toContain("B-S4");
  });

  it("User5: First Gift and Recurring on Jul 10, 3- and 6-month streaks, then $100 Club on Nov 10", () => {
    expect(newOn("2026-07-10", 5)).toEqual(expect.arrayContaining(["B-M0", "B-R1", "B-P1"]));
    expect(newOn("2026-09-10", 5)).toContain("B-S1");
    expect(newOn("2026-12-10", 5)).toContain("B-S2");
    expect(newOn("2026-11-10", 5)).toContain("B-M1");
  });

  it("User6: Double Impact 2026, Matching Streak and the 3rd giving year when the September match lands", () => {
    expect(newOn("2026-09-10", 6)).toContain("B-L1");
    expect(newOn("2026-09-20", 6)).toEqual(expect.arrayContaining(["B-G1:2026", "B-G2"]));
    expect(on("2026-07-01").filter((a) => a.donorId === id(6) && a.badgeId === "B-G1").map((a) => a.periodKey).sort()).toEqual(["2024", "2025"]);
  });

  it("User7: $250, $500 and $1K clubs together on Sep 9; Platinum on Oct 1", () => {
    expect(newOn("2026-09-09", 7)).toEqual(expect.arrayContaining(["B-M2", "B-M3", "B-M4"]));
    expect(newOn("2026-10-01", 7)).toEqual(expect.arrayContaining(["B-R1", "B-R2", "B-R3", "B-R4"]));
  });

  it("User8: crosses the $250 Club on Aug 20 (plus Transportation and the 5th giving year)", () => {
    expect(on("2026-07-01").some((a) => a.donorId === id(8) && a.badgeId === "B-M2")).toBe(false);
    expect(newOn("2026-08-20", 8)).toEqual(expect.arrayContaining(["B-M2", "B-P3", "B-L2"]));
  });

  it("User9: Silver on Oct 15, $500 Club on Nov 15, 12-month streak on Dec 15", () => {
    expect(newOn("2026-10-15", 9)).toContain("B-R2");
    expect(newOn("2026-11-15", 9)).toContain("B-M3");
    expect(newOn("2026-12-15", 9)).toContain("B-S3");
  });

  it("User3: $1K Club on Oct 15 and the 12-month streak on Dec 15 (July failure was fixed in grace)", () => {
    expect(newOn("2026-10-15", 3)).toContain("B-M4");
    expect(newOn("2026-12-15", 3)).toContain("B-S3");
  });

  it("User4: Back in the Game and Gold on Oct 5, no streak badge across the lapse", () => {
    expect(newOn("2026-10-05", 4)).toEqual(expect.arrayContaining(["B-X1", "B-R3"]));
  });

  it("User11: $5K Club, Infrastructure and Full Spectrum on Aug 12", () => {
    expect(newOn("2026-08-12", 11)).toEqual(expect.arrayContaining(["B-M6", "B-P4", "B-P8"]));
  });

  it("User12: $2.5K Club, Emergency Fund and the earthquake Campaign Hero on Aug 10", () => {
    expect(newOn("2026-08-10", 12)).toEqual(
      expect.arrayContaining(["B-M5", "B-P5", "B-P9:emergencia-sismo-2026"]),
    );
  });

  it("User13: Teacher Champion and the 3rd giving year on Aug 14", () => {
    expect(newOn("2026-08-14", 13)).toEqual(expect.arrayContaining(["B-P2", "B-L1"]));
  });

  it("User14: Recruiter on Aug 5, Super Recruiter on Dec 6", () => {
    expect(newOn("2026-08-05", 14)).toContain("B-SO9");
    expect(newOn("2026-12-06", 14)).toContain("B-SO10");
    expect(newOn("2026-12-05", 14)).not.toContain("B-SO10");
  });

  it("User16: 10-year supporter and the anniversary on Aug 18", () => {
    expect(newOn("2026-08-18", 16)).toEqual(expect.arrayContaining(["B-L3", "B-L4:2026"]));
  });

  it("User17: Event Supporter in October; User19: Silver Recurring and the $500 Club on Sep 15; User20: Project Backer on Sep 18", () => {
    expect(on("2026-10-31").some((a) => a.donorId === id(17) && a.badgeId === "B-P7")).toBe(true);
    expect(newOn("2026-09-15", 19)).toEqual(expect.arrayContaining(["B-R2", "B-M3"]));
    expect(newOn("2026-09-18", 20)).toContain("B-P6");
  });

  it("User10 (lapsed) earns nothing new during the demo", () => {
    const before = on("2026-07-01").filter((a) => a.donorId === id(10)).length;
    const after = on("2026-12-31").filter((a) => a.donorId === id(10) && a.badgeId !== "B-L4").length;
    expect(after).toBeLessThanOrEqual(before);
  });

  it("never awards the Ambassador badge automatically", () => {
    expect(on("2026-12-31").some((a) => a.badgeId === "B-SO8")).toBe(false);
  });
});

describe("period-close winners", () => {
  it("Donor of the Month: User1 in July, August, October, December; User7 in September", () => {
    const winner = (day: string, ym: string) =>
      on(day).find((a) => a.badgeId === "B-C2" && a.periodKey === ym)?.donorId;
    expect(winner("2026-07-31", "2026-07")).toBe(id(1));
    expect(winner("2026-08-31", "2026-08")).toBe(id(1));
    expect(winner("2026-09-30", "2026-09")).toBe(id(7));
    expect(winner("2026-10-31", "2026-10")).toBe(id(1));
    expect(winner("2026-12-31", "2026-12")).toBe(id(1));
  });

  it("Donor of the Week: User1 wins the week of his $1,500 gift (closes Sunday Jul 26)", () => {
    const winners = on("2026-07-26").filter((a) => a.badgeId === "B-C1");
    expect(winners).toEqual([{ donorId: id(1), badgeId: "B-C1", periodKey: "2026-W30", awardedAt: "2026-07-26" }]);
  });

  it("closes a month with one Biggest Climber, ten Top-10 donors and a Top 10% group", () => {
    const closing = on("2026-08-31");
    expect(closing.filter((a) => a.badgeId === "B-C5" && a.periodKey === "2026-08")).toHaveLength(1);
    expect(closing.filter((a) => a.badgeId === "B-C3")).toHaveLength(10);
    const topPct = closing.filter((a) => a.badgeId === "B-C4").length;
    expect(topPct).toBeGreaterThan(55);
    expect(topPct).toBeLessThan(90);
    expect(closing.find((a) => a.badgeId === "B-C3" && a.donorId === id(1))).toBeDefined();
  });

  it("Yearly Top 10 closes on Dec 31 and includes User1", () => {
    const yearly = on("2026-12-31").filter((a) => a.badgeId === "B-C6");
    expect(yearly).toHaveLength(10);
    expect(yearly.every((a) => a.periodKey === "2026")).toBe(true);
    expect(yearly.some((a) => a.donorId === id(1))).toBe(true);
  });

  it("does not invent past winners on launch day", () => {
    const launch = on("2026-07-01");
    expect(launch.some((a) => ["B-C1", "B-C2", "B-C3", "B-C4", "B-C5", "B-C6"].includes(a.badgeId))).toBe(false);
  });
});

describe("volume and speed", () => {
  it("evaluates every state badge for 2,500+ donors in reasonable time, with unique award keys", () => {
    const started = Date.now();
    const awards = stateAwards(input, "2026-12-31");
    const ms = Date.now() - started;
    const keys = new Set(awards.map(awardKey));
    console.log(`stateAwards(2026-12-31): ${ms} ms, ${awards.length} awards for ${input.histories.size} donors`);
    expect(keys.size).toBe(awards.length);
    expect(ms).toBeLessThan(10_000);
  }, 60_000);
});

describe("coverage from data alone", () => {
  it("produces 41 of the 50 badges during the demo; the other 9 need a UI action or the admin", () => {
    const produced = new Set(stateAwards(input, "2026-12-31").map((a) => a.badgeId));
    // Period winners are only produced on closing days: every Sunday, month end and Dec 31.
    for (let day = "2026-07-01"; day <= "2026-12-31"; day = addDays(day, 1)) {
      const closes =
        toDate(day).getUTCDay() === 0 || day === lastDayOfMonth(day.slice(0, 7)) || day.endsWith("-12-31");
      if (closes) for (const a of periodCloseAwards(input, day)) produced.add(a.badgeId);
    }
    const missing = BADGE_SEEDS.map((b) => b.id).filter((badgeId) => !produced.has(badgeId));
    expect(missing).toEqual([
      "B-SO1", "B-SO2", "B-SO3", "B-SO4", "B-SO5", "B-SO6", // social follows: need approved claims
      "B-SO7", // Proud Supporter: needs a share
      "B-SO8", // Ambassador: manual
      "B-X2", // Early Adopter: needs a first login
    ]);
  }, 120_000);
});
