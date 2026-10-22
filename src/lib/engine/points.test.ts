import { describe, expect, it } from "vitest";
import { monthlyPoints, referralEvents, sumMonths } from "./points";
import {
  buildHistories,
  DEFAULT_ENGINE_SETTINGS as S,
  type DonationRec,
  type EngagementEvent,
  type SubscriptionRec,
} from "./types";

let n = 0;
const don = (date: string, amount: number, extra: Partial<DonationRec> = {}): DonationRec => ({
  id: `d${++n}`, donorId: "D1", date, amountUsd: amount, method: "card", program: "becas",
  campaign: null, status: "succeeded", subscriptionId: null, ...extra,
});
const sub = (id = "S1", start = "2026-01-10"): SubscriptionRec => ({
  id, donorId: "D1", amountUsd: 20, frequency: "monthly", startDate: start, endDate: null,
});
const recurring = (date: string, amount = 20) => don(date, amount, { subscriptionId: "S1" });
const points = (donations: DonationRec[], subs: SubscriptionRec[], asOf: string, events: EngagementEvent[] = []) => {
  const history = buildHistories(donations, subs).get("D1") ?? { donorId: "D1", donations: [], subscriptions: [] };
  return monthlyPoints(history, events, asOf, S);
};
const event = (date: string): EngagementEvent => ({ donorId: "D1", date, kind: "social_claim" });

describe("monthlyPoints: weights", () => {
  it("gives 1 pt per $1 one-time, 1.5 recurring, 1 matching", () => {
    const rows = [
      don("2026-03-02", 100), // 100
      don("2026-03-09", 40, { method: "matching_gift" }), // 40
      recurring("2026-03-10", 20), // 30 (+5 streak bonus, first month)
    ];
    const march = points(rows, [sub()], "2026-03-31").get("2026-03")!;
    expect(march).toMatchObject({ oneTime: 100, matching: 40, recurring: 30, streakBonus: 5, engagement: 0, total: 175 });
  });

  it("ignores failed charges and anything after asOf", () => {
    const rows = [don("2026-03-02", 100, { status: "failed" }), don("2026-03-20", 50), don("2026-03-25", 500)];
    expect(points(rows, [], "2026-03-21").get("2026-03")!.total).toBe(50);
    expect(points(rows, [], "2026-03-31").get("2026-03")!.total).toBe(550);
  });

  it("splits points by calendar month", () => {
    const months = points([don("2026-01-31", 10), don("2026-02-01", 20)], [], "2026-02-28");
    expect([...months.entries()].map(([m, b]) => [m, b.total])).toEqual([["2026-01", 10], ["2026-02", 20]]);
  });

  it("uses the weights from settings", () => {
    const history = buildHistories([don("2026-03-02", 10)], []).get("D1")!;
    const custom = { ...S, points: { ...S.points, oneTimePerDollar: 3 } };
    expect(monthlyPoints(history, [], "2026-03-31", custom).get("2026-03")!.total).toBe(30);
  });
});

describe("monthlyPoints: streak bonus", () => {
  const charges = (count: number) =>
    Array.from({ length: count }, (_, i) => recurring(`2026-${String(i + 1).padStart(2, "0")}-10`));

  it("adds +5 per streak month, only in months with a successful recurring charge", () => {
    const months = points(charges(3), [sub()], "2026-03-31");
    expect(months.get("2026-01")!.streakBonus).toBe(5);
    expect(months.get("2026-02")!.streakBonus).toBe(10);
    expect(months.get("2026-03")!.streakBonus).toBe(15);
  });

  it("caps the bonus at +60 per month", () => {
    const months = points(charges(12), [sub()], "2026-12-31");
    expect(months.get("2026-11")!.streakBonus).toBe(55);
    expect(months.get("2026-12")!.streakBonus).toBe(60);
    // a 24-month streak is still capped
    const long: DonationRec[] = [];
    for (let i = 0; i < 24; i++) {
      const t = 2024 * 12 + 6 + i;
      long.push(recurring(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-10`));
    }
    const m = points(long, [sub("S1", "2024-07-10")], "2026-06-30");
    expect(m.get("2026-06")!.streakBonus).toBe(60);
  });

  it("gives no bonus for one-time giving, and none in a month without a recurring charge", () => {
    const rows = [...charges(2), don("2026-03-05", 50)];
    const months = points(rows, [sub()], "2026-03-31");
    expect(months.get("2026-03")!.streakBonus).toBe(0);
  });

  it("evaluates the streak as of the end of each month (not as of asOf)", () => {
    const months = points(charges(6), [sub()], "2026-06-30");
    expect(months.get("2026-02")!.streakBonus).toBe(10);
  });
});

describe("monthlyPoints: engagement", () => {
  it("gives +5 per action and caps at 20 per calendar month", () => {
    const events = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"].map(event);
    expect(points([don("2026-03-10", 10)], [], "2026-03-31", events).get("2026-03")!.engagement).toBe(20);
    expect(points([don("2026-03-10", 10)], [], "2026-03-31", events.slice(0, 2)).get("2026-03")!.engagement).toBe(10);
  });

  it("applies the cap per month and ignores events after asOf", () => {
    const events = [event("2026-03-30"), event("2026-04-01"), event("2026-04-02")];
    const months = points([don("2026-03-10", 10)], [], "2026-04-01", events);
    expect(months.get("2026-03")!.engagement).toBe(5);
    expect(months.get("2026-04")!.engagement).toBe(5);
  });

  it("creates a month for engagement alone", () => {
    expect(points([], [], "2026-03-31", [event("2026-03-05")]).get("2026-03")!.total).toBe(5);
  });
});

describe("sumMonths and referralEvents", () => {
  it("sums months between two month keys, inclusive", () => {
    const months = points([don("2026-01-05", 10), don("2026-02-05", 20), don("2026-03-05", 40)], [], "2026-03-31");
    expect(sumMonths(months, "2026-02", "2026-03").total).toBe(60);
    expect(sumMonths(months, null, "2026-02").total).toBe(30);
  });

  it("gives the referrer an event on the referred donor's first successful donation", () => {
    const histories = buildHistories(
      [
        { ...don("2026-08-01", 30, { status: "failed" }), donorId: "D9" },
        { ...don("2026-08-05", 40), donorId: "D9" },
        { ...don("2026-09-05", 40), donorId: "D9" },
      ],
      [],
    );
    expect(referralEvents([{ id: "D9", referredBy: "D14" }, { id: "D8", referredBy: null }], histories)).toEqual([
      { donorId: "D14", date: "2026-08-05", kind: "referral" },
    ]);
  });
});
