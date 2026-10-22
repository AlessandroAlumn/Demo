import { describe, expect, it } from "vitest";
import { BADGE_SEEDS } from "../badge-definitions";
import { daysBetween } from "../dates";
import type { AwardCandidate, BadgeDef } from "./badges";
import {
  badgeDrafts,
  gapNudgeDraft,
  rankChangeDraft,
  subscriptionDrafts,
  tierNudgeDraft,
  type RankSnap,
} from "./notifications";
import type { RankEntry } from "./rankings";
import type { RecurringSummary, SubState, SubStatus } from "./subscriptions";

// ---------- helpers ----------

const entry = (rank: number, total = 2000, gap: number | null = 12): RankEntry => ({
  donorId: "D1", rank, totalRanked: total, points: 100, topPercent: 10,
  gapToNext: rank === 1 || gap === null ? null : { points: gap, dollars: Math.floor(gap) + 1, aboveDonorId: "D0" },
});
const snap = (rank: number, periodKey = "2026-08"): RankSnap => ({ periodKey, rank, totalRanked: 2000 });
const rank = (prev: RankSnap | undefined, cur: RankEntry | undefined, opts = {}) =>
  rankChangeDraft("D1", "monthly", "2026-08", prev, cur, "2026-08-20", { daysSince: daysBetween, ...opts });

// ---------- rankings ----------

describe("rankChangeDraft", () => {
  it("N4: moving up even one position, with the gap to the next position (#215 -> #214 of 2,000)", () => {
    const draft = rank(snap(215), entry(214, 2000, 11.2))!;
    expect(draft.type).toBe("N4");
    expect(draft.params).toEqual({
      ranking: "monthly", periodKey: "2026-08", from: 215, to: 214, total: 2000,
      gap: { dollars: 12, nextRank: 213 }, keepLead: false,
    });
    expect(draft.dedupeKey).toBe("rank:D1:monthly:2026-08-20");
  });

  it("N5: moving down", () => {
    const draft = rank(snap(214), entry(215))!;
    expect(draft.type).toBe("N5");
    expect(draft.params).toMatchObject({ from: 214, to: 215 });
  });

  it("flags 'keep your lead' (no gap) for #1", () => {
    expect(rank(snap(2), entry(1))!.params).toMatchObject({ to: 1, gap: null, keepLead: true });
  });

  it("stays silent without a snapshot, in a new period, or when nothing changed", () => {
    expect(rank(undefined, entry(10))).toBeNull();
    expect(rank(snap(10, "2026-07"), entry(5))).toBeNull(); // the month rolled over
    expect(rank(snap(10), entry(10))).toBeNull();
    expect(rank(snap(10), undefined)).toBeNull();
  });

  it("throttles 'someone passed you' to one digest per cooldown, but never throttles moving up", () => {
    const cooldown = { downCooldownDays: 7 };
    expect(rank(snap(100), entry(105), { ...cooldown, lastDownDate: "2026-08-17" })).toBeNull(); // 3 days ago
    expect(rank(snap(100), entry(105), { ...cooldown, lastDownDate: "2026-08-13" })!.type).toBe("N5"); // 7 days
    expect(rank(snap(100), entry(105), { ...cooldown, lastDownDate: undefined })!.type).toBe("N5");
    expect(rank(snap(105), entry(100), { ...cooldown, lastDownDate: "2026-08-19" })!.type).toBe("N4");
    expect(rank(snap(100), entry(105), { downCooldownDays: 0, lastDownDate: "2026-08-19" })!.type).toBe("N5");
  });

  it("digests drops against the last rank the donor was told about", () => {
    // told #100 a week ago; silently slid to #105 yesterday and today: one digest "100 -> 105"
    const draft = rank(snap(105), entry(105), { downFrom: snap(100), downCooldownDays: 7, lastDownDate: "2026-08-10" })!;
    expect(draft.type).toBe("N5");
    expect(draft.params).toMatchObject({ from: 100, to: 105 });
    // once told, the same rank is silent
    expect(rank(snap(105), entry(105), { downFrom: snap(105), downCooldownDays: 7 })).toBeNull();
    // a stale reference from another period is ignored
    expect(rank(snap(105), entry(105), { downFrom: snap(90, "2026-07") })).toBeNull();
  });
});

describe("gapNudgeDraft", () => {
  const opts = { thresholdUsd: 20, cooldownDays: 7, lastSent: undefined as string | undefined, daysSince: daysBetween };
  const gap = (cur: RankEntry | undefined, o = {}) => gapNudgeDraft("D1", "yearly", cur, "2026-08-20", { ...opts, ...o });

  it("N6: tells a donor they are only $X from the next position when the gap is small", () => {
    const draft = gap(entry(214, 2000, 11.2))!;
    expect(draft.type).toBe("N6");
    expect(draft.params).toEqual({ ranking: "yearly", rank: 214, total: 2000, gapDollars: 12, nextRank: 213 });
  });

  it("is silent for a big gap, for #1, and during the cooldown", () => {
    expect(gap(entry(214, 2000, 50))).toBeNull();
    expect(gap(entry(1))).toBeNull();
    expect(gap(entry(214, 2000, 5), { lastSent: "2026-08-18" })).toBeNull();
    expect(gap(entry(214, 2000, 5), { lastSent: "2026-08-13" })).not.toBeNull();
    expect(gap(undefined)).toBeNull();
  });
});

// ---------- recurring payments ----------

const state = (status: SubStatus, failureStart: string | null = null, graceDaysLeft: number | null = null): SubState => ({
  subscriptionId: "S1", status, lastSuccessDate: null, failureStart, graceDaysLeft,
});
const summary = (
  overall: RecurringSummary["overall"],
  extra: Partial<RecurringSummary> = {},
): RecurringSummary => ({
  states: [], monthlyAmount: 100, tier: "gold", next: { tier: "platinum", threshold: 250, gap: 150 },
  streak: 8, overall, graceDaysLeft: null, ...extra,
});

describe("subscriptionDrafts", () => {
  const drafts = (prev: RecurringSummary, cur: RecurringSummary) => subscriptionDrafts("D1", prev, cur, "2026-08-10");

  it("N12 when a charge fails: tier and streak at risk, one per failure", () => {
    const cur = summary("grace", { states: [state("grace", "2026-08-03", 7)], graceDaysLeft: 7 });
    const [d] = drafts(summary("active"), cur);
    expect(d).toMatchObject({ type: "N12", dedupeKey: "N12:D1:2026-08-03", params: { tier: "gold", streak: 8, monthlyAmount: 100 } });
    expect(drafts(summary("grace"), cur).filter((x) => x.type === "N12")).toEqual([]); // already in grace
  });

  it("N13 when 2 days (or fewer) of grace are left", () => {
    const at = (left: number) =>
      drafts(summary("grace"), summary("grace", { states: [state("grace", "2026-08-03", left)], graceDaysLeft: left }));
    expect(at(3)).toEqual([]);
    expect(at(2)[0]).toMatchObject({ type: "N13", params: { daysLeft: 2, streak: 8 }, dedupeKey: "N13:D1:2026-08-03" });
    expect(at(1)[0].dedupeKey).toBe("N13:D1:2026-08-03"); // same key: stored only once per failure
  });

  it("N14 when the grace period expires (streak reset, status inactive)", () => {
    const prev = summary("grace", { states: [state("grace", "2026-08-03", 1)] });
    const [d] = drafts(prev, summary("inactive", { streak: 0, tier: null, monthlyAmount: 0 }));
    expect(d).toMatchObject({ type: "N14", params: { tier: "gold", streak: 8 } });
  });

  it("N15 when payment is back; the streak is restored only if it happened inside grace", () => {
    expect(drafts(summary("grace"), summary("active"))[0]).toMatchObject({ type: "N15", params: { streakRestored: true } });
    expect(drafts(summary("inactive"), summary("active", { streak: 1 }))[0]).toMatchObject({
      type: "N15", params: { streakRestored: false, streak: 1 },
    });
  });

  it("sends nothing while everything is fine", () => {
    expect(drafts(summary("active"), summary("active"))).toEqual([]);
    expect(drafts(summary("none"), summary("none"))).toEqual([]);
  });
});

describe("tierNudgeDraft", () => {
  const nudge = (cur: RecurringSummary) => tierNudgeDraft("D1", cur, 10, "2026-08-10");

  it("N17 when an active donor is within 10% of the next tier ($45 of $50)", () => {
    const d = nudge(summary("active", { monthlyAmount: 45, tier: "recurring", next: { tier: "silver", threshold: 50, gap: 5 } }))!;
    expect(d).toMatchObject({ type: "N17", params: { nextTier: "silver", gapUsd: 5 }, dedupeKey: "N17:D1:silver" });
  });

  it("is silent when too far, not active, not recurring or at the top", () => {
    expect(nudge(summary("active", { monthlyAmount: 44, next: { tier: "silver", threshold: 50, gap: 6 } }))).toBeNull();
    expect(nudge(summary("grace", { monthlyAmount: 45, next: { tier: "silver", threshold: 50, gap: 5 } }))).toBeNull();
    expect(nudge(summary("none", { monthlyAmount: 0, next: { tier: "recurring", threshold: 20, gap: 20 } }))).toBeNull();
    expect(nudge(summary("active", { monthlyAmount: 600, next: null }))).toBeNull();
  });
});

// ---------- badges ----------

describe("badgeDrafts", () => {
  const defs = new Map<string, BadgeDef>(
    BADGE_SEEDS.map((b) => [b.id, { id: b.id, rule: b.rule, repeatable: !!b.repeatable, manualOnly: !!b.manualOnly, active: true }]),
  );
  const award = (badgeId: string, periodKey = "", meta?: Record<string, number>): AwardCandidate => ({
    donorId: "D1", badgeId, periodKey, awardedAt: "2026-08-10", ...(meta ? { meta } : {}),
  });
  const make = (...awards: AwardCandidate[]) => badgeDrafts("D1", awards, defs, "2026-08-10");
  const summarize = (drafts: ReturnType<typeof make>) => drafts.map((d) => d.type).sort();

  it("an ordinary badge is an N1", () => {
    const [d] = make(award("B-S2"));
    expect(d).toMatchObject({ type: "N1", params: { badgeId: "B-S2", periodKey: "" }, dedupeKey: "N1:D1:B-S2:" });
  });

  it("several recurring tiers at once become a single N16 for the highest tier", () => {
    const drafts = make(award("B-R1"), award("B-R2"), award("B-R3"), award("B-R4"), award("B-R5"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ type: "N16", params: { tier: "diamond", badgeIds: ["B-R1", "B-R2", "B-R3", "B-R4", "B-R5"] } });
  });

  it("several money clubs at once notify only the highest club", () => {
    const drafts = make(award("B-M2"), award("B-M3"), award("B-M4"));
    expect(drafts.map((d) => d.params.badgeId)).toEqual(["B-M4"]);
  });

  it("winner and anniversary badges use their specific notifications", () => {
    const drafts = make(
      award("B-C2", "2026-07", { amountUsd: 2000 }),
      award("B-C1", "2026-W30", { amountUsd: 1500 }),
      award("B-C5", "2026-07", { gained: 340 }),
      award("B-L4", "2026", { years: 10 }),
    );
    expect(summarize(drafts)).toEqual(["N10", "N20", "N9", "N9"].sort());
    expect(drafts.find((d) => d.type === "N10")!.params).toEqual({ month: "2026-07", gained: 340 });
    expect(drafts.find((d) => d.type === "N20")!.params).toEqual({ years: 10 });
    expect(drafts.filter((d) => d.type === "N9").map((d) => d.params.amountUsd).sort()).toEqual([1500, 2000]);
  });

  it("badges announced by N22 / N24 / N26 do not also get an N1", () => {
    expect(make(award("B-G1", "2026"), award("B-SO1"), award("B-SO5"), award("B-SO9"))).toEqual([]);
    // but their sibling badges still do
    expect(summarize(make(award("B-G2"), award("B-SO6"), award("B-SO10")))).toEqual(["N1", "N1", "N1"]);
  });

  it("repeatable badges get a distinct key per period", () => {
    const keys = make(award("B-C3", "2026-07"), award("B-C3", "2026-08")).map((d) => d.dedupeKey);
    expect(new Set(keys).size).toBe(2);
  });
});
