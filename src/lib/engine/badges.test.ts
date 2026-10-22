import { describe, expect, it } from "vitest";
import { BADGE_SEEDS } from "../badge-definitions";
import {
  awardKey,
  badgeProgress,
  badgeRarity,
  biggestClimber,
  computeFacts,
  createRankingSource,
  evaluateBadges,
  nearLifetimeBadges,
  periodCloseAwards,
  stateAwards,
  topDonorByAmount,
  type AwardCandidate,
  type BadgeDef,
  type BadgeInput,
} from "./badges";
import type { RankEntry, RankingResult } from "./rankings";
import {
  buildHistories,
  DEFAULT_ENGINE_SETTINGS as S,
  type DonationRec,
  type EngagementEvent,
  type SubscriptionRec,
} from "./types";

// ---------- helpers ----------

const defs: BadgeDef[] = BADGE_SEEDS.map((b) => ({
  id: b.id, rule: b.rule, repeatable: b.repeatable ?? false, manualOnly: b.manualOnly ?? false, active: true,
}));

let n = 0;
const don = (donorId: string, date: string, amount: number, extra: Partial<DonationRec> = {}): DonationRec => ({
  id: `d${++n}`, donorId, date, amountUsd: amount, method: "card", program: "becas",
  campaign: null, status: "succeeded", subscriptionId: null, ...extra,
});
const sub = (donorId: string, id: string, start: string, amount = 20, extra: Partial<SubscriptionRec> = {}): SubscriptionRec => ({
  id, donorId, amountUsd: amount, frequency: "monthly", startDate: start, endDate: null, ...extra,
});

function makeInput(
  donations: DonationRec[],
  subscriptions: SubscriptionRec[] = [],
  extra: Partial<BadgeInput> = {},
): BadgeInput {
  const histories = buildHistories(donations, subscriptions);
  const events = extra.events ?? [];
  return {
    defs, settings: S, histories, events, claims: [], shares: [], firstLogins: new Map(),
    launchDate: "2026-07-01", earlyAdopterDays: 30, eventsFrom: "2000-01-01",
    rankings: createRankingSource(histories, events, S),
    ...extra,
  };
}

const idsOf = (awards: AwardCandidate[], donorId = "A") =>
  awards.filter((a) => a.donorId === donorId).map((a) => (a.periodKey ? `${a.badgeId}:${a.periodKey}` : a.badgeId)).sort();
const find = (awards: AwardCandidate[], badgeId: string, donorId = "A", periodKey?: string) =>
  awards.find((a) => a.donorId === donorId && a.badgeId === badgeId && (periodKey === undefined || a.periodKey === periodKey));

// ---------- state badges ----------

describe("lifetime milestones", () => {
  const rows = [don("A", "2025-01-10", 60), don("A", "2025-06-10", 60), don("A", "2026-03-01", 200), don("A", "2026-09-01", 5000)];

  it("awards First Gift and each club on the date the running total crosses it", () => {
    const awards = stateAwards(makeInput(rows), "2026-06-30");
    expect(find(awards, "B-M0")!.awardedAt).toBe("2025-01-10");
    expect(find(awards, "B-M1")!.awardedAt).toBe("2025-06-10"); // 120 >= 100
    expect(find(awards, "B-M2")!.awardedAt).toBe("2026-03-01"); // 320 >= 250
    expect(find(awards, "B-M3")).toBeUndefined(); // 320 < 500
  });

  it("ignores failed charges and donations after the evaluated day", () => {
    const input = makeInput([don("A", "2026-01-01", 1000, { status: "failed" }), don("A", "2026-05-01", 30)]);
    expect(idsOf(stateAwards(input, "2026-04-30"))).toEqual([]);
    expect(idsOf(stateAwards(input, "2026-05-01"))).toContain("B-M0");
    expect(idsOf(stateAwards(input, "2026-05-01"))).not.toContain("B-M1");
  });

  it("counts matched gifts towards the lifetime total", () => {
    const input = makeInput([don("A", "2026-01-01", 60), don("A", "2026-01-20", 60, { method: "matching_gift" })]);
    expect(find(stateAwards(input, "2026-02-01"), "B-M1")!.awardedAt).toBe("2026-01-20");
  });

  it("awards several clubs at once when a big gift passes them all", () => {
    const awards = stateAwards(makeInput(rows), "2026-09-01");
    for (const id of ["B-M3", "B-M4", "B-M5", "B-M6"]) expect(find(awards, id)!.awardedAt).toBe("2026-09-01");
    expect(find(awards, "B-M7")).toBeUndefined();
  });
});

describe("recurring tiers and streaks", () => {
  const charge = (date: string, amount = 100) => don("A", date, amount, { subscriptionId: "S1" });

  it("awards every tier at or below the current monthly amount", () => {
    const input = makeInput([charge("2026-07-05")], [sub("A", "S1", "2026-07-05", 100)]);
    const awards = stateAwards(input, "2026-07-06");
    expect(idsOf(awards)).toEqual(expect.arrayContaining(["B-R1", "B-R2", "B-R3"]));
    expect(find(awards, "B-R4")).toBeUndefined();
    expect(find(awards, "B-R3")!.awardedAt).toBe("2026-07-06");
  });

  it("normalises annual plans: $600/year is Silver", () => {
    const annual = sub("A", "S1", "2026-09-15", 600, { frequency: "annual" });
    const awards = stateAwards(makeInput([charge("2026-09-15", 600)], [annual]), "2026-09-15");
    expect(find(awards, "B-R2")).toBeDefined();
    expect(find(awards, "B-R3")).toBeUndefined();
  });

  it("awards streak badges when the streak reaches 3, 6, 12, 24 months", () => {
    const charges = ["2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10", "2026-05-10", "2026-06-10"].map((d) => charge(d, 20));
    const input = makeInput(charges, [sub("A", "S1", "2026-01-10")]);
    expect(find(stateAwards(input, "2026-02-20"), "B-S1")).toBeUndefined();
    expect(find(stateAwards(input, "2026-03-10"), "B-S1")).toBeDefined();
    expect(find(stateAwards(input, "2026-06-10"), "B-S2")).toBeDefined();
    expect(find(stateAwards(input, "2026-06-10"), "B-S3")).toBeUndefined();
  });
});

describe("loyalty and anniversaries", () => {
  it("awards N-year supporter on the first gift of the Nth distinct year", () => {
    const input = makeInput([don("A", "2023-05-01", 10), don("A", "2024-05-01", 10), don("A", "2024-09-01", 10), don("A", "2026-08-18", 10)]);
    expect(find(stateAwards(input, "2026-08-17"), "B-L1")).toBeUndefined();
    expect(find(stateAwards(input, "2026-08-18"), "B-L1")!.awardedAt).toBe("2026-08-18");
    expect(find(stateAwards(input, "2026-12-31"), "B-L2")).toBeUndefined();
  });

  it("awards the anniversary once a year, only from eventsFrom on", () => {
    const rows = [don("A", "2016-08-18", 50)];
    const late = makeInput(rows, [], { eventsFrom: "2026-07-01" });
    expect(idsOf(stateAwards(late, "2026-08-17")).filter((x) => x.startsWith("B-L4"))).toEqual([]);
    const awards = stateAwards(late, "2026-09-01");
    expect(find(awards, "B-L4", "A", "2026")!.awardedAt).toBe("2026-08-18");
    expect(awards.filter((a) => a.badgeId === "B-L4")).toHaveLength(1);

    const all = stateAwards(makeInput(rows, [], { eventsFrom: "2000-01-01" }), "2026-09-01");
    expect(all.filter((a) => a.badgeId === "B-L4")).toHaveLength(10); // 2017..2026
  });

  it("does not give an anniversary in the year of the first gift", () => {
    expect(stateAwards(makeInput([don("A", "2026-08-18", 50)]), "2026-12-31").some((a) => a.badgeId === "B-L4")).toBe(false);
  });
});

describe("programs, campaigns and matching", () => {
  it("awards a program badge on the first gift to it, and Full Spectrum when all four permanent programs are covered", () => {
    const input = makeInput([
      don("A", "2021-03-15", 10, { program: "becas" }),
      don("A", "2023-05-20", 10, { program: "premio_planchart" }),
      don("A", "2025-04-10", 10, { program: "transporte" }),
      don("A", "2026-08-12", 10, { program: "infraestructura" }),
    ]);
    expect(find(stateAwards(input, "2026-08-11"), "B-P8")).toBeUndefined();
    const awards = stateAwards(input, "2026-08-12");
    expect(find(awards, "B-P4")!.awardedAt).toBe("2026-08-12");
    expect(find(awards, "B-P8")!.awardedAt).toBe("2026-08-12");
    expect(find(awards, "B-P1")!.awardedAt).toBe("2021-03-15");
  });

  it("awards one Campaign Hero per campaign slug", () => {
    const input = makeInput([
      don("A", "2026-08-10", 50, { campaign: "emergencia-sismo-2026", program: "fondo_general_emergencia" }),
      don("A", "2026-09-01", 50, { campaign: "emergencia-sismo-2026" }),
      don("A", "2026-09-05", 50, { campaign: "giving-tuesday" }),
    ]);
    const heroes = stateAwards(input, "2026-10-01").filter((a) => a.badgeId === "B-P9");
    expect(heroes.map((h) => [h.periodKey, h.awardedAt]).sort()).toEqual([
      ["emergencia-sismo-2026", "2026-08-10"], ["giving-tuesday", "2026-09-05"],
    ]);
  });

  it("awards Double Impact once per year and Matching Streak for 3 different years", () => {
    const input = makeInput([
      don("A", "2024-06-03", 100, { method: "matching_gift" }),
      don("A", "2025-06-02", 100, { method: "matching_gift" }),
      don("A", "2025-07-02", 100, { method: "matching_gift" }),
      don("A", "2026-09-20", 100, { method: "matching_gift" }),
    ]);
    const awards = stateAwards(input, "2026-09-20");
    expect(awards.filter((a) => a.badgeId === "B-G1").map((a) => a.periodKey).sort()).toEqual(["2024", "2025", "2026"]);
    expect(find(awards, "B-G2")!.awardedAt).toBe("2026-09-20");
    expect(find(stateAwards(input, "2026-09-19"), "B-G2")).toBeUndefined();
  });
});

describe("social, referrals, reactivation, early adopter, manual", () => {
  it("awards each follow badge from an approved claim, and Fully Connected once all five exist", () => {
    const networks = ["instagram", "tiktok", "x", "youtube", "facebook"];
    const claims = networks.map((network, i) => ({ donorId: "A", network, reviewedAt: `2026-08-0${i + 1}` }));
    const input = makeInput([don("A", "2026-07-01", 10)], [], { claims });
    const partial = stateAwards(input, "2026-08-04");
    expect(["B-SO1", "B-SO2", "B-SO3", "B-SO4"].every((id) => find(partial, id))).toBe(true);
    expect(find(partial, "B-SO5")).toBeUndefined();
    expect(find(partial, "B-SO6")).toBeUndefined();
    const full = stateAwards(input, "2026-08-05");
    expect(find(full, "B-SO6")!.awardedAt).toBe("2026-08-05");
  });

  it("awards Proud Supporter on the first share", () => {
    const input = makeInput([don("A", "2026-07-01", 10)], [], { shares: [{ donorId: "A", date: "2026-08-02" }, { donorId: "A", date: "2026-09-01" }] });
    expect(find(stateAwards(input, "2026-08-01"), "B-SO7")).toBeUndefined();
    expect(find(stateAwards(input, "2026-09-30"), "B-SO7")!.awardedAt).toBe("2026-08-02");
  });

  it("awards Recruiter for 1 referral and Super Recruiter for 5, on the date of the referred donor's first gift", () => {
    const events: EngagementEvent[] = ["2026-08-05", "2026-09-12", "2026-10-08", "2026-11-14", "2026-12-06"].map((date) => ({ donorId: "A", date, kind: "referral" }));
    const input = makeInput([don("A", "2026-07-01", 10)], [], { events });
    expect(find(stateAwards(input, "2026-08-05"), "B-SO9")!.awardedAt).toBe("2026-08-05");
    expect(find(stateAwards(input, "2026-12-05"), "B-SO10")).toBeUndefined();
    expect(find(stateAwards(input, "2026-12-06"), "B-SO10")!.awardedAt).toBe("2026-12-06");
  });

  it("awards Early Adopter only for a first login within 30 days of launch", () => {
    const rows = [don("A", "2026-07-01", 10), don("B", "2026-07-01", 10)];
    const input = makeInput(rows, [], { firstLogins: new Map([["A", "2026-07-31"], ["B", "2026-08-01"]]) });
    const awards = stateAwards(input, "2026-09-01");
    expect(find(awards, "B-X2", "A")!.awardedAt).toBe("2026-07-31");
    expect(find(awards, "B-X2", "B")).toBeUndefined();
    expect(find(stateAwards(input, "2026-07-30"), "B-X2", "A")).toBeUndefined(); // hasn't logged in yet
  });

  it("never awards manual-only badges, nor inactive ones", () => {
    const input = makeInput([don("A", "2026-07-01", 10)]);
    expect(idsOf(stateAwards(input, "2026-07-02"))).not.toContain("B-SO8");
    const off = makeInput([don("A", "2026-07-01", 10)], [], { defs: defs.map((d) => (d.id === "B-M0" ? { ...d, active: false } : d)) });
    expect(idsOf(stateAwards(off, "2026-07-02"))).not.toContain("B-M0");
  });

  describe("Back in the Game", () => {
    const charge = (date: string, status: "succeeded" | "failed" = "succeeded", subId = "S1") =>
      don("A", date, 50, { subscriptionId: subId, status });
    const comeback = (rows: DonationRec[], subs: SubscriptionRec[], day = "2026-12-31") =>
      find(stateAwards(makeInput(rows, subs), day), "B-X1")?.awardedAt;

    it("is not earned when a failure is fixed inside the grace period", () => {
      const rows = [charge("2026-06-15"), charge("2026-07-15", "failed"), charge("2026-07-19"), charge("2026-08-15")];
      expect(comeback(rows, [sub("A", "S1", "2026-06-15", 50)])).toBeUndefined();
    });

    it("is earned by restarting after the grace expired (a new plan)", () => {
      const rows = [charge("2026-07-03"), charge("2026-08-03", "failed"), charge("2026-10-05", "succeeded", "S2")];
      const subs = [sub("A", "S1", "2025-04-03", 50, { endDate: "2026-10-05" }), sub("A", "S2", "2026-10-05", 100)];
      expect(comeback(rows, subs, "2026-10-04")).toBeUndefined();
      expect(comeback(rows, subs)).toBe("2026-10-05");
    });

    it("is earned by a fix that comes after the grace expired", () => {
      const rows = [charge("2026-07-03"), charge("2026-08-03", "failed"), charge("2026-08-20")];
      expect(comeback(rows, [sub("A", "S1", "2026-01-03", 50)])).toBe("2026-08-20");
    });

    it("is not earned by a plan change where the new plan charges on the cancellation day", () => {
      const rows = [charge("2026-09-15"), charge("2026-10-15", "succeeded", "S2"), charge("2026-11-15", "succeeded", "S2")];
      const subs = [sub("A", "S1", "2026-01-15", 45, { endDate: "2026-10-15" }), sub("A", "S2", "2026-10-15", 50)];
      expect(comeback(rows, subs)).toBeUndefined();
    });

    it("is earned by cancelling and coming back after more than a failure window", () => {
      const rows = [charge("2026-01-10"), charge("2026-04-20", "succeeded", "S2")];
      const subs = [sub("A", "S1", "2026-01-10", 50, { endDate: "2026-02-10" }), sub("A", "S2", "2026-04-20", 50)];
      expect(comeback(rows, subs)).toBe("2026-04-20");
    });
  });
});

// ---------- period-close badges ----------

describe("topDonorByAmount", () => {
  it("picks the biggest total in the range; ties go to the earliest gift, then the donor id", () => {
    const histories = buildHistories(
      [
        don("A", "2026-07-20", 100), don("B", "2026-07-21", 60), don("B", "2026-07-22", 60),
        don("C", "2026-07-19", 500), // before the range
        don("D", "2026-07-22", 120, { status: "failed" }),
      ],
      [],
    );
    expect(topDonorByAmount(histories, "2026-07-20", "2026-07-26")).toEqual({ donorId: "B", amount: 120 });
    const tie = buildHistories([don("X", "2026-07-22", 50), don("Y", "2026-07-21", 50), don("Z", "2026-07-21", 50)], []);
    expect(topDonorByAmount(tie, "2026-07-20", "2026-07-26")).toEqual({ donorId: "Y", amount: 50 });
    expect(topDonorByAmount(buildHistories([], []), "2026-07-20", "2026-07-26")).toBeNull();
  });
});

describe("period-close awards", () => {
  const rows = [
    don("A", "2026-07-20", 1500), // Monday of 2026-W30
    don("B", "2026-07-22", 100),
    don("C", "2026-07-29", 40), // next week
  ];
  const input = makeInput(rows);

  it("Donor of the Week: only on the Sunday that closes the ISO week", () => {
    expect(periodCloseAwards(input, "2026-07-25")).toEqual([]); // Saturday
    const sunday = periodCloseAwards(input, "2026-07-26");
    expect(sunday.filter((a) => a.badgeId === "B-C1")).toEqual([
      { donorId: "A", badgeId: "B-C1", periodKey: "2026-W30", awardedAt: "2026-07-26" },
    ]);
  });

  it("Donor of the Month, Top 10 and Top 10%: only on the last day of the month", () => {
    expect(periodCloseAwards(input, "2026-07-30").some((a) => a.badgeId === "B-C2")).toBe(false);
    const closing = periodCloseAwards(input, "2026-07-31");
    expect(find(closing, "B-C2", "A", "2026-07")).toBeDefined();
    expect(find(closing, "B-C2", "B")).toBeUndefined();
    for (const donor of ["A", "B", "C"]) expect(find(closing, "B-C3", donor, "2026-07")).toBeDefined(); // only 3 ranked
    expect(find(closing, "B-C4", "A", "2026-07")).toBeUndefined(); // rank 1 of 3 is the top 34%, not 10%
  });

  it("Top 10% needs a rank inside the top tenth of the ranking", () => {
    const crowd: DonationRec[] = [];
    for (let i = 0; i < 50; i++) crowd.push(don(`D${String(i).padStart(2, "0")}`, "2026-07-10", 100 - i));
    const closing = periodCloseAwards(makeInput(crowd), "2026-07-31");
    const top10pct = closing.filter((a) => a.badgeId === "B-C4").map((a) => a.donorId).sort();
    expect(top10pct).toEqual(["D00", "D01", "D02", "D03", "D04"]);
    expect(closing.filter((a) => a.badgeId === "B-C3")).toHaveLength(10);
  });

  it("Yearly Top 10: only on December 31", () => {
    expect(periodCloseAwards(input, "2026-12-30").some((a) => a.badgeId === "B-C6")).toBe(false);
    const closing = periodCloseAwards(input, "2026-12-31");
    expect(find(closing, "B-C6", "A", "2026")).toBeDefined();
  });

  it("produces nothing before eventsFrom, so launching does not invent past winners", () => {
    const late = makeInput(rows, [], { eventsFrom: "2026-08-01" });
    expect(periodCloseAwards(late, "2026-07-31")).toEqual([]);
    expect(periodCloseAwards(late, "2026-08-31").some((a) => a.badgeId === "B-C2")).toBe(false); // nobody donated in August
  });

  it("evaluateBadges combines state and period-close awards for a day", () => {
    const awards = evaluateBadges(input, "2026-07-31");
    expect(find(awards, "B-M0", "A")).toBeDefined();
    expect(find(awards, "B-C2", "A", "2026-07")).toBeDefined();
  });
});

describe("biggestClimber", () => {
  const entry = (donorId: string, rank: number): RankEntry => ({
    donorId, rank, totalRanked: 4, points: 0, topPercent: 100, gapToNext: null,
  });
  const result = (entries: RankEntry[]): RankingResult => ({
    period: { ranking: "alltime", key: "all", from: null, to: "2026-07-31" },
    entries, byDonor: new Map(entries.map((e) => [e.donorId, e])),
  });

  it("picks the largest rank gain among donors ranked at both ends", () => {
    const start = result([entry("A", 1), entry("B", 2), entry("C", 3), entry("D", 4)]);
    const end = result([entry("D", 1), entry("A", 2), entry("B", 3), entry("C", 4), entry("NEW", 5)]);
    expect(biggestClimber(start, end)).toEqual({ donorId: "D", gained: 3 });
  });

  it("breaks ties by the better final rank, and returns null if nobody climbed", () => {
    const start = result([entry("A", 3), entry("B", 4), entry("C", 1), entry("D", 2)]);
    const end = result([entry("A", 1), entry("B", 2), entry("C", 3), entry("D", 4)]);
    expect(biggestClimber(start, end)).toEqual({ donorId: "A", gained: 2 });
    expect(biggestClimber(end, end)).toBeNull();
  });
});

// ---------- progress, near-miss and rarity ----------

describe("progress, nearLifetimeBadges, rarity", () => {
  const rows = [don("A", "2026-01-01", 235)];
  const facts = computeFacts(makeInput(rows), buildHistories(rows, []).get("A")!, "2026-07-01");

  it("reports progress towards locked badges", () => {
    expect(badgeProgress({ type: "lifetime_total", usd: 250 }, facts, S)).toEqual({ current: 235, target: 250, unit: "usd" });
    expect(badgeProgress({ type: "lifetime_total", usd: 100 }, facts, S)).toEqual({ current: 100, target: 100, unit: "usd" });
    expect(badgeProgress({ type: "years_donated", years: 3 }, facts, S)).toEqual({ current: 1, target: 3, unit: "years" });
    expect(badgeProgress({ type: "recurring_tier", tier: "silver" }, facts, S)).toEqual({ current: 0, target: 50, unit: "usd" });
    expect(badgeProgress({ type: "donor_of_month" }, facts, S)).toBeNull();
  });

  it("lists money badges within 10% of the target", () => {
    const near = nearLifetimeBadges(defs, facts, 10);
    expect(near).toEqual([{ badgeId: "B-M2", remaining: 15, target: 250 }]);
    expect(nearLifetimeBadges(defs, facts, 3)).toEqual([]);
  });

  it("computes rarity as the share of donors holding a badge", () => {
    const awards = [
      { donorId: "A", badgeId: "B-M0" }, { donorId: "B", badgeId: "B-M0" }, { donorId: "A", badgeId: "B-M0" },
      { donorId: "A", badgeId: "B-C2" },
    ];
    const rarity = badgeRarity(awards, 8);
    expect(rarity.get("B-M0")).toBe(25);
    expect(rarity.get("B-C2")).toBe(12.5);
    expect(awardKey({ donorId: "A", badgeId: "B-C2", periodKey: "2026-07" })).toBe("A|B-C2|2026-07");
  });
});
