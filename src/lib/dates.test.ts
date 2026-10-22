import { describe, expect, it } from "vitest";
import { addDays, addMonthKey, addMonths, daysBetween, isoWeekKey, lastDayOfMonth, monthKey } from "./dates";

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("measures whole days between dates", () => {
    expect(daysBetween("2026-07-15", "2026-07-22")).toBe(7);
    expect(daysBetween("2026-07-22", "2026-07-15")).toBe(-7);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("adds months keeping the day, clamped to the month length", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2016-02-29", 12)).toBe("2017-02-28");
  });

  it("works with month keys", () => {
    expect(monthKey("2026-08-14")).toBe("2026-08");
    expect(addMonthKey("2026-01", -1)).toBe("2025-12");
    expect(addMonthKey("2026-11", 3)).toBe("2027-02");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
  });

  it("computes ISO week keys (Monday-Sunday weeks, week 1 holds the first Thursday)", () => {
    expect(isoWeekKey("2026-07-20")).toBe("2026-W30"); // Monday
    expect(isoWeekKey("2026-07-26")).toBe("2026-W30"); // Sunday of the same week
    expect(isoWeekKey("2026-07-27")).toBe("2026-W31");
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01"); // Thursday
    expect(isoWeekKey("2025-12-29")).toBe("2026-W01"); // Monday of 2026's first week
    expect(isoWeekKey("2027-01-03")).toBe("2026-W53"); // 2026 has 53 weeks
    expect(isoWeekKey("2027-01-04")).toBe("2027-W01");
  });
});
