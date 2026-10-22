import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_SEEDS } from "./badge-definitions";
import { BADGE_CATEGORIES, TIERS } from "./constants";

const spec = readFileSync(
  join(__dirname, "../../BADGES_AND_NOTIFICATIONS.md"),
  "utf8",
);
const specIds = [...spec.matchAll(/^\| (B-[A-Z0-9]+)(?: 🆕)? \|/gm)].map((m) => m[1]);

describe("badge definitions vs BADGES_AND_NOTIFICATIONS.md", () => {
  it("define exactly the badges listed in the spec", () => {
    expect(BADGE_SEEDS.map((b) => b.id).sort()).toEqual([...specIds].sort());
  });

  it("have unique IDs", () => {
    const ids = BADGE_SEEDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("use valid categories and tiers, with texts in both languages", () => {
    for (const b of BADGE_SEEDS) {
      expect(BADGE_CATEGORIES).toContain(b.category);
      if (b.tier) expect(TIERS).toContain(b.tier);
      for (const text of [b.nameEn, b.nameEs, b.descEn, b.descEs]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("make only the Ambassador badge manual-only", () => {
    const manual = BADGE_SEEDS.filter((b) => b.manualOnly).map((b) => b.id);
    expect(manual).toEqual(["B-SO8"]);
    expect(BADGE_SEEDS.find((b) => b.id === "B-SO8")?.rule.type).toBe("manual");
  });
});
