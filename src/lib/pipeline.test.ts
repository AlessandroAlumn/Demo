// End-to-end test of the daily pipeline on a throwaway SQLite database built from the real migrations,
// the generated mock CSVs, and the real seeding code. One file, sequential steps sharing the same demo run.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordFirstLogin, recordShare, reviewSocialClaim, submitSocialClaim } from "./demo-actions";
import { computeRankings } from "./engine/rankings";
import { referralEvents } from "./engine/points";
import { buildHistories, type DonationRec, type EngagementEvent, type SubscriptionRec } from "./engine/types";
import { runImport } from "./importer";
import { getDemoState, processUntil, refreshToday, resetDemo } from "./pipeline";
import { seedReferenceData, seedUsers } from "./seeding";
import { loadSettings, toEngineSettings } from "./settings";

const dir = mkdtempSync(join(tmpdir(), "alumnusb-pipeline-"));
const db = new PrismaClient({ datasourceUrl: `file:${join(dir, "test.db").replace(/\\/g, "/")}` });

const username = async (name: string) => (await db.user.findUniqueOrThrow({ where: { username: name } })).id;
const feed = async (name: string) =>
  db.notification.findMany({ where: { userId: await username(name) }, orderBy: [{ createdAt: "asc" }, { seq: "asc" }] });
const typesOf = (rows: { type: string }[]) => rows.map((r) => r.type);
const counts = async () => ({
  awards: await db.badgeAward.count(),
  notifications: await db.notification.count(),
  snapshots: await db.rankSnapshot.count(),
});

beforeAll(async () => {
  const root = join(__dirname, "../../prisma/migrations");
  for (const name of readdirSync(root).filter((n) => /^\d/.test(n)).sort()) {
    const sql = readFileSync(join(root, name, "migration.sql"), "utf8");
    for (const statement of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }
  }
  await seedReferenceData(db);
  const report = await runImport(db, {
    donationsCsv: readFileSync(join(__dirname, "../../data/donations.csv"), "utf8"),
    subscriptionsCsv: readFileSync(join(__dirname, "../../data/subscriptions.csv"), "utf8"),
  });
  expect(report.donations.issues).toEqual([]);
  await seedUsers(db);
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("baseline day", () => {
  it("stores everything already earned silently: no notifications", async () => {
    const result = await resetDemo(db);
    expect(result).toMatchObject({ from: "2026-07-01", to: "2026-07-01", days: 1, notifications: 0 });
    expect(result.awards).toBeGreaterThan(1_500);
    expect(await db.notification.count()).toBe(0);
    expect(await getDemoState(db)).toMatchObject({ today: "2026-07-01", lastProcessed: "2026-07-01" });
  }, 120_000);

  it("keeps the manual Ambassador award and snapshots the users' ranks", async () => {
    const ambassador = await db.badgeAward.findFirst({ where: { badgeId: "B-SO8" } });
    expect(ambassador).toMatchObject({ donorId: "D0015", source: "manual" });
    // Snapshots exist only for rankings the donor is eligible for: User1 has not given in 2026 yet (all-time
    // only); User3 gave Jan-Jun (yearly + all-time) but nothing on Jul 1 (no monthly rank).
    const rankings = async (donorId: string) =>
      (await db.rankSnapshot.findMany({ where: { donorId } })).map((s) => s.ranking).sort();
    expect(await rankings("D0001")).toEqual(["alltime"]);
    expect(await rankings("D0003")).toEqual(["alltime", "yearly"]);
  });

  it("does not invent past winners or anniversaries (eventsFrom = launch)", async () => {
    const winners = await db.badgeAward.count({ where: { badgeId: { in: ["B-C1", "B-C2", "B-C3", "B-C4", "B-C5", "B-C6"] } } });
    expect(winners).toBe(0);
  });
});

describe("day by day", () => {
  it("first week: User1 becomes Diamond on Jul 5 and gets one N16, not five N1s", async () => {
    const result = await processUntil(db, "2026-07-05");
    expect(result.days).toBe(4);
    const award = await db.badgeAward.findFirstOrThrow({ where: { donorId: "D0001", badgeId: "B-R5" } });
    expect(award.awardedAt).toBe("2026-07-05");
    const rows = await feed("User1");
    const tier = rows.filter((r) => r.type === "N16");
    expect(tier).toHaveLength(1);
    expect(tier[0]).toMatchObject({ createdAt: "2026-07-05", params: { tier: "diamond" } });
    expect(rows.filter((r) => r.type === "N1" && String((r.params as { badgeId: string }).badgeId).startsWith("B-R"))).toEqual([]);
  }, 120_000);

  it("is idempotent: reprocessing a day or refreshing today changes nothing", async () => {
    const before = await counts();
    expect((await processUntil(db, "2026-07-05")).days).toBe(0);
    const refreshed = await refreshToday(db);
    expect(refreshed).toMatchObject({ awards: 0, notifications: 0 });
    expect(await counts()).toEqual(before);
  }, 120_000);

  it("User3: N12 on Jul 15 (grace starts), N15 on Jul 19 (recovered in time), never N14", async () => {
    await processUntil(db, "2026-07-20");
    const rows = await feed("User3");
    const n12 = rows.find((r) => r.type === "N12")!;
    const n15 = rows.find((r) => r.type === "N15")!;
    expect(n12).toMatchObject({ createdAt: "2026-07-15", params: { tier: "gold", streak: 6, monthlyAmount: 100 } });
    expect(n15).toMatchObject({ createdAt: "2026-07-19", params: { streakRestored: true, streak: 7 } });
    expect(typesOf(rows)).not.toContain("N14");
  }, 120_000);

  it("rankings stored by the cached pipeline equal a from-scratch recomputation", async () => {
    const settings = toEngineSettings(await loadSettings(db));
    const donations: DonationRec[] = (await db.donation.findMany()).map((d) => ({
      id: d.id, donorId: d.donorId, date: d.date, amountUsd: d.amountUsd, method: d.method,
      program: d.program, campaign: d.campaign, status: d.status, subscriptionId: d.subscriptionId,
    }));
    const subscriptions: SubscriptionRec[] = (await db.subscription.findMany()).map((s) => ({
      id: s.id, donorId: s.donorId, amountUsd: s.amountUsd, frequency: s.frequency, startDate: s.startDate, endDate: s.endDate,
    }));
    const histories = buildHistories(donations, subscriptions);
    const referred = await db.donor.findMany({ where: { referredBy: { not: null } }, select: { id: true, referredBy: true } });
    const events: EngagementEvent[] = referralEvents(referred, histories);
    const fresh = computeRankings(histories, events, "2026-07-20", settings);

    for (const donorId of ["D0001", "D0003", "D0017", "D0018", "D0020"]) {
      for (const ranking of ["monthly", "yearly", "alltime"] as const) {
        const stored = await db.rankSnapshot.findFirst({ where: { donorId, ranking }, orderBy: { periodKey: "desc" } });
        const expected = fresh[ranking].byDonor.get(donorId);
        if (!expected) {
          expect(stored, `${donorId} ${ranking}`).toBeNull();
          continue;
        }
        expect({ rank: stored!.rank, total: stored!.totalRanked, points: stored!.points }, `${donorId} ${ranking}`).toEqual({
          rank: expected.rank, total: expected.totalRanked, points: expected.points,
        });
      }
    }
  }, 120_000);

  it("'someone passed you' is throttled: at least a week between N5s of the same ranking", async () => {
    for (const name of ["User3", "User17", "User18"]) {
      const downs = (await feed(name)).filter((r) => r.type === "N5");
      const byRanking = new Map<string, string[]>();
      for (const d of downs) {
        const ranking = (d.params as { ranking: string }).ranking;
        byRanking.set(ranking, [...(byRanking.get(ranking) ?? []), d.createdAt]);
      }
      for (const [ranking, dates] of byRanking) {
        for (let i = 1; i < dates.length; i++) {
          const gap = (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86_400_000;
          expect(gap, `${name} ${ranking}`).toBeGreaterThanOrEqual(7);
        }
      }
    }
  });

  it("everyone gets the admin post (N27) and welcome-week content", async () => {
    const users = await db.user.findMany({ where: { role: "donor" } });
    for (const u of users) {
      const rows = await db.notification.findMany({ where: { userId: u.id, type: "N27" } });
      expect(rows.length, u.username).toBe(1);
      expect(rows[0].createdAt).toBe("2026-07-02");
    }
  });
});

describe("UI-driven events", () => {
  it("first login stamps today, adds the welcome (N31) and Early Adopter, once", async () => {
    const user5 = await username("User5");
    expect(await recordFirstLogin(db, user5)).toBe(true);
    expect(await recordFirstLogin(db, user5)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: user5 } })).firstLoginAt).toBe("2026-07-20");
    const rows = await feed("User5");
    expect(rows.filter((r) => r.type === "N31")).toHaveLength(1);
    expect(rows.find((r) => r.type === "N1" && (r.params as { badgeId: string }).badgeId === "B-X2")).toBeDefined();
  }, 120_000);

  it("a social-follow claim: pending, duplicates refused, approval gives N24, the badge and +5 points", async () => {
    const user13 = await username("User13");
    const claim = await submitSocialClaim(db, user13, "instagram");
    expect(claim.ok).toBe(true);
    expect(await submitSocialClaim(db, user13, "instagram")).toEqual({ ok: false, reason: "already_claimed" });
    expect(await submitSocialClaim(db, user13, "myspace")).toEqual({ ok: false, reason: "invalid_network" });
    if (!claim.ok) return;

    expect(await reviewSocialClaim(db, claim.claimId, "approved")).toBe(true);
    expect(await reviewSocialClaim(db, claim.claimId, "approved")).toBe(false); // already reviewed
    const rows = await feed("User13");
    expect(rows.find((r) => r.type === "N24")?.params).toEqual({ network: "instagram", badgeId: "B-SO1" });
    expect(rows.filter((r) => r.type === "N1" && (r.params as { badgeId: string }).badgeId === "B-SO1")).toEqual([]);
    expect(await db.badgeAward.findFirst({ where: { donorId: "D0013", badgeId: "B-SO1" } })).not.toBeNull();
  }, 120_000);

  it("a rejected claim sends N25 and no badge", async () => {
    const user20 = await username("User20");
    const claim = await submitSocialClaim(db, user20, "tiktok");
    if (!claim.ok) throw new Error("claim failed");
    await reviewSocialClaim(db, claim.claimId, "rejected");
    expect(typesOf(await feed("User20"))).toContain("N25");
    expect(await db.badgeAward.findFirst({ where: { donorId: "D0020", badgeId: "B-SO2" } })).toBeNull();
  }, 120_000);

  it("a share earns Proud Supporter", async () => {
    expect(await recordShare(db, await username("User13"), "B-M0", "whatsapp")).toBe(true);
    expect(await recordShare(db, await username("User13"), "B-M0", "myspace")).toBe(false);
    expect(await db.badgeAward.findFirst({ where: { donorId: "D0013", badgeId: "B-SO7" } })).not.toBeNull();
    expect(await db.shareEvent.count()).toBe(1);
  }, 120_000);
});

describe("later in the demo", () => {
  it("User4's lapse: N12 on Aug 3, N13 on Aug 8 (2 days left), N14 on Aug 10 (streak reset)", async () => {
    await processUntil(db, "2026-08-12");
    const rows = (await feed("User4")).filter((r) => ["N12", "N13", "N14"].includes(r.type));
    expect(rows.map((r) => [r.type, r.createdAt])).toEqual([
      ["N12", "2026-08-03"], ["N13", "2026-08-08"], ["N14", "2026-08-10"],
    ]);
    expect(rows[1].params).toEqual({ daysLeft: 2, streak: 16 });
    expect(rows[2].params).toMatchObject({ tier: "silver", streak: 16 });
  }, 180_000);

  it("the campaign launch reaches every user (N28 on Aug 1)", async () => {
    const users = await db.user.findMany({ where: { role: "donor" } });
    for (const u of users) {
      const rows = await db.notification.findMany({ where: { userId: u.id } });
      expect(rows.find((r) => r.type === "N28")?.createdAt, `${u.username} N28`).toBe("2026-08-01");
    }
  });

  it("the +1 month jump stays fast (the pipeline caches closed months)", async () => {
    const started = Date.now();
    const result = await processUntil(db, "2026-09-12");
    const seconds = (Date.now() - started) / 1000;
    console.log(`+1 month (${result.days} days): ${seconds.toFixed(1)}s`);
    expect(result.days).toBe(31);
    expect(seconds).toBeLessThan(15);

    // The organisation passed $200K on Sep 9: everyone is told (N30).
    for (const u of await db.user.findMany({ where: { role: "donor" } })) {
      const milestone = (await db.notification.findMany({ where: { userId: u.id, type: "N30" } }))[0];
      expect(milestone, `${u.username} N30`).toMatchObject({ createdAt: "2026-09-09", params: { milestoneUsd: 200_000 } });
    }

    // Campaign progress: 50% of the $1,800 goal was reached in August, 75% is not there yet.
    const user1 = await feed("User1");
    const progress = user1.filter((r) => r.type === "N29").map((r) => (r.params as { pct: number }).pct);
    expect(progress).toEqual([50]);
  }, 180_000);

  it("never processes past the end of the demo data", async () => {
    const result = await processUntil(db, "2027-03-01");
    expect(result.to).toBe("2026-12-31");
    expect((await getDemoState(db)).today).toBe("2026-12-31");
    expect(await db.notification.count({ where: { type: "N8" } })).toBeGreaterThan(0); // year close
  }, 300_000);
});

describe("reset", () => {
  it("wipes derived data, keeps manual awards and posts, and returns to the baseline", async () => {
    const result = await resetDemo(db);
    expect(result).toMatchObject({ from: "2026-07-01", days: 1, notifications: 0 });
    expect(await db.notification.count()).toBe(0);
    expect(await db.socialClaim.count()).toBe(0);
    expect(await db.shareEvent.count()).toBe(0);
    expect(await db.user.count({ where: { firstLoginAt: { not: null } } })).toBe(0);
    expect(await db.post.count()).toBe(4);
    expect(await db.badgeAward.count({ where: { source: "manual" } })).toBe(1);
    expect(await db.badgeAward.count({ where: { badgeId: "B-SO1" } })).toBe(0);
    expect(await getDemoState(db)).toMatchObject({ today: "2026-07-01", lastProcessed: "2026-07-01" });
  }, 180_000);

  it("replays to exactly the same result (the demo is deterministic)", async () => {
    await processUntil(db, "2026-07-20");
    const first = (await feed("User3")).map((r) => [r.type, r.createdAt, JSON.stringify(r.params)]);
    await resetDemo(db);
    await processUntil(db, "2026-07-20");
    const second = (await feed("User3")).map((r) => [r.type, r.createdAt, JSON.stringify(r.params)]);
    expect(second).toEqual(first);
  }, 300_000);
});
