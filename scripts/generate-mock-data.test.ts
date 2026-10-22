import { beforeAll, describe, expect, it } from "vitest";
import {
  DONATION_STATUSES,
  FREQUENCIES,
  PAYMENT_METHODS,
  PROGRAMS,
  SUBSCRIPTION_STATUSES,
} from "../src/lib/constants";
import { generateMockData, type MockData } from "./generate-mock-data";
import { DATA_END, DATA_START, LAUNCH_DATE } from "./lib/mock-helpers";

let data: MockData;
beforeAll(() => {
  data = generateMockData();
});

const rowsOf = (n: number) => data.donations.filter((d) => d.donorId === `D${String(n).padStart(4, "0")}`);

describe("mock data: shape", () => {
  it("is deterministic (same seed, same data)", () => {
    expect(generateMockData()).toEqual(data);
  });

  it("has ~2,500 background donors plus the 20 personas and 5 referred donors", () => {
    expect(data.donors).toHaveLength(2525);
    expect(new Set(data.donors.map((d) => d.id)).size).toBe(2525);
  });

  it("uses unique donation ids and valid values everywhere", () => {
    expect(new Set(data.donations.map((d) => d.id)).size).toBe(data.donations.length);
    const donorIds = new Set(data.donors.map((d) => d.id));
    for (const d of data.donations) {
      expect(donorIds.has(d.donorId)).toBe(true);
      expect(PAYMENT_METHODS).toContain(d.method);
      expect(PROGRAMS).toContain(d.program);
      expect(DONATION_STATUSES).toContain(d.status);
      expect(d.amountUsd).toBeGreaterThan(0);
      expect(d.date >= DATA_START && d.date <= DATA_END).toBe(true);
    }
  });

  it("links every recurring charge to an existing subscription of the same donor", () => {
    const subs = new Map(data.subscriptions.map((s) => [s.id, s]));
    expect(subs.size).toBe(data.subscriptions.length);
    for (const s of data.subscriptions) {
      expect(FREQUENCIES).toContain(s.frequency);
      expect(SUBSCRIPTION_STATUSES).toContain(s.status);
    }
    for (const d of data.donations.filter((x) => x.subscriptionId)) {
      expect(subs.get(d.subscriptionId)?.donorId).toBe(d.donorId);
    }
  });

  it("has rows before and after the demo launch, so the time machine has something to reveal", () => {
    expect(data.donations.some((d) => d.date < LAUNCH_DATE)).toBe(true);
    expect(data.donations.filter((d) => d.date >= LAUNCH_DATE).length).toBeGreaterThan(2000);
  });

  it("raises roughly what the site reports before launch and crosses $1M during the demo", () => {
    let total = 0;
    let before = 0;
    let crossed = "";
    for (const d of data.donations) {
      if (d.status !== "succeeded") continue;
      total += d.amountUsd;
      if (d.date < LAUNCH_DATE) before = total;
      if (!crossed && total >= 1_000_000) crossed = d.date;
    }
    expect(before).toBeGreaterThan(850_000);
    expect(before).toBeLessThan(1_000_000);
    expect(crossed >= LAUNCH_DATE && crossed <= DATA_END).toBe(true);
  });

  it("keeps ordinary background gifts below the persona-sized gifts", () => {
    const background = data.donations.filter(
      (d) => !d.subscriptionId && Number(d.donorId.slice(1)) > 20 && d.date >= LAUNCH_DATE,
    );
    expect(Math.max(...background.map((d) => d.amountUsd))).toBeLessThanOrEqual(1000);
  });
});

describe("mock data: persona timelines", () => {
  it("User3: July charge fails on the 15th and succeeds on the 19th", () => {
    const july = rowsOf(3).filter((d) => d.date.startsWith("2026-07"));
    expect(july.map((d) => [d.date, d.status])).toEqual([
      ["2026-07-15", "failed"],
      ["2026-07-19", "succeeded"],
    ]);
  });

  it("User4: August charge fails and nothing is charged until the new $100 plan on 10-05", () => {
    const after = rowsOf(4).filter((d) => d.date >= "2026-08-01");
    expect(after[0]).toMatchObject({ date: "2026-08-03", status: "failed", amountUsd: 50 });
    expect(after[1]).toMatchObject({ date: "2026-10-05", status: "succeeded", amountUsd: 100 });
  });

  it("User6: matching gifts in 2024, 2025 and 2026", () => {
    const years = rowsOf(6)
      .filter((d) => d.method === "matching_gift")
      .map((d) => d.date.slice(0, 4));
    expect(years).toEqual(["2024", "2025", "2026"]);
  });

  it("User14 refers 5 donors through referred_by on their first gift", () => {
    const referred = data.donations.filter((d) => d.referredBy === "D0014");
    expect(referred).toHaveLength(5);
    expect(referred.map((d) => d.date.slice(0, 7))).toEqual([
      "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
    ]);
  });

  it("User8 starts the demo at $235 lifetime", () => {
    const before = rowsOf(8)
      .filter((d) => d.date < LAUNCH_DATE && d.status === "succeeded")
      .reduce((s, d) => s + d.amountUsd, 0);
    expect(before).toBe(235);
  });

  it("User10 is lapsed: nothing in 2026", () => {
    expect(rowsOf(10).some((d) => d.date >= "2026-01-01")).toBe(false);
    expect(rowsOf(10).at(-1)?.date).toBe("2025-12-10");
  });

  it("User16 gave in 9 different years before 2026, then again in August", () => {
    const years = new Set(rowsOf(16).map((d) => d.date.slice(0, 4)));
    expect([...years].filter((y) => y < "2026")).toHaveLength(9);
    expect(rowsOf(16).some((d) => d.date === "2026-08-18")).toBe(true);
  });

  it("User19 has a single annual $600 subscription starting in September", () => {
    const sub = data.subscriptions.find((s) => s.donorId === "D0019");
    expect(sub).toMatchObject({ frequency: "annual", amountUsd: 600, startDate: "2026-09-15" });
  });

  it("User12 gives to the earthquake campaign in August", () => {
    const row = rowsOf(12).find((d) => d.campaign === "emergencia-sismo-2026");
    expect(row).toMatchObject({ date: "2026-08-10", amountUsd: 500, program: "fondo_general_emergencia" });
  });

  it("Users 17 and 18 start within $2 of each other and give alternately each month", () => {
    const lifetime = (n: number) =>
      rowsOf(n).filter((d) => d.date < LAUNCH_DATE).reduce((s, d) => s + d.amountUsd, 0);
    expect(Math.abs(lifetime(17) - lifetime(18))).toBeLessThanOrEqual(2);
    for (const n of [17, 18]) {
      expect(rowsOf(n).filter((d) => d.date >= LAUNCH_DATE)).toHaveLength(24);
    }
  });

  it("User1 wins the largest monthly total in July, August, October and December", () => {
    for (const month of ["2026-07", "2026-08", "2026-10", "2026-12"]) {
      const totals = new Map<string, number>();
      for (const d of data.donations) {
        if (d.status === "succeeded" && d.date.startsWith(month)) {
          totals.set(d.donorId, (totals.get(d.donorId) ?? 0) + d.amountUsd);
        }
      }
      const winner = [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0];
      expect(winner, month).toBe("D0001");
    }
  });
});
