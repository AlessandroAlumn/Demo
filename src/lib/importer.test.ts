import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runImport } from "./importer";

// A throwaway SQLite database built from the real migrations.
const dir = mkdtempSync(join(tmpdir(), "alumnusb-importer-"));
const db = new PrismaClient({ datasourceUrl: `file:${join(dir, "test.db").replace(/\\/g, "/")}` });

async function applyMigrations() {
  const root = join(__dirname, "../../prisma/migrations");
  for (const name of readdirSync(root).filter((n) => /^\d/.test(n)).sort()) {
    const sql = readFileSync(join(root, name, "migration.sql"), "utf8");
    for (const statement of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }
  }
}

beforeAll(applyMigrations);

beforeEach(async () => {
  await db.subscription.deleteMany();
  await db.donation.deleteMany();
  await db.donor.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const DON_HEADER =
  "donation_id,donor_id,email,name,date,amount_usd,method,program,campaign,status,subscription_id,referred_by";
const SUB_HEADER = "subscription_id,donor_id,amount_usd,frequency,start_date,end_date,status";

const donationsCsv = [
  DON_HEADER,
  "DON-1,D1,ana@example.org,Ana Pérez,2026-01-10,25,card,becas,,succeeded,SUB-1,",
  "DON-2,D1,ana@example.org,Ana Pérez,2026-02-10,25,card,becas,,failed,SUB-1,",
  "DON-3,D2,luis@example.org,Luis Gómez,2025-12-01,100.5,zelle,transporte,camp-x,succeeded,,D1",
].join("\n");
const subscriptionsCsv = [SUB_HEADER, "SUB-1,D1,25,monthly,2026-01-10,,failed"].join("\n");

describe("importer", () => {
  it("imports rows, derives donors and subscriptions", async () => {
    const report = await runImport(db, { donationsCsv, subscriptionsCsv });
    expect(report.donations).toMatchObject({ total: 3, valid: 3, new: 3, updated: 0, unchanged: 0 });
    expect(report.subscriptions).toMatchObject({ new: 1, updated: 0, unchanged: 0, removed: 0 });
    expect(report.donors).toEqual({ new: 2, updated: 0 });

    const luis = await db.donor.findUniqueOrThrow({ where: { id: "D2" } });
    expect(luis).toMatchObject({ name: "Luis Gómez", firstDonationDate: "2025-12-01", referredBy: "D1" });
    expect(await db.donation.count()).toBe(3);
    expect((await db.donation.findUniqueOrThrow({ where: { id: "DON-3" } })).amountUsd).toBe(100.5);
  });

  it("is idempotent: importing the same files again changes nothing", async () => {
    await runImport(db, { donationsCsv, subscriptionsCsv });
    const again = await runImport(db, { donationsCsv, subscriptionsCsv });
    expect(again.donations).toMatchObject({ new: 0, updated: 0, unchanged: 3 });
    expect(again.subscriptions).toMatchObject({ new: 0, updated: 0, unchanged: 1, removed: 0 });
    expect(again.donors).toEqual({ new: 0, updated: 0 });
    expect(await db.donation.count()).toBe(3);
  });

  it("updates a changed row (e.g. a failed charge later fixed) without duplicating it", async () => {
    await runImport(db, { donationsCsv });
    const fixed = donationsCsv.replace("2026-02-10,25,card,becas,,failed", "2026-02-10,25,card,becas,,succeeded");
    const report = await runImport(db, { donationsCsv: fixed });
    expect(report.donations).toMatchObject({ new: 0, updated: 1, unchanged: 2 });
    expect((await db.donation.findUniqueOrThrow({ where: { id: "DON-2" } })).status).toBe("succeeded");
    expect(await db.donation.count()).toBe(3);
  });

  it("accepts a file with only the newest rows and keeps the earlier history", async () => {
    await runImport(db, { donationsCsv });
    const delta = [
      DON_HEADER,
      "DON-4,D2,luis@example.org,Luis G. Gómez,2026-03-05,40,card,becas,,succeeded,,",
    ].join("\n");
    const report = await runImport(db, { donationsCsv: delta });
    expect(report.donations).toMatchObject({ new: 1, updated: 0 });
    expect(await db.donation.count()).toBe(4);
    const luis = await db.donor.findUniqueOrThrow({ where: { id: "D2" } });
    expect(luis.name).toBe("Luis G. Gómez"); // latest row wins
    expect(luis.firstDonationDate).toBe("2025-12-01"); // earlier history kept
  });

  it("replaces the whole subscriptions snapshot", async () => {
    await runImport(db, { donationsCsv, subscriptionsCsv });
    const snapshot = [SUB_HEADER, "SUB-9,D2,50,annual,2026-03-01,,active"].join("\n");
    const report = await runImport(db, { subscriptionsCsv: snapshot });
    expect(report.subscriptions).toMatchObject({ new: 1, removed: 1 });
    expect((await db.subscription.findMany()).map((s) => s.id)).toEqual(["SUB-9"]);
  });

  it("reports invalid rows with line numbers and imports the valid ones", async () => {
    const bad = [
      DON_HEADER,
      "DON-1,D1,ana@example.org,Ana,2026-01-10,25,card,becas,,succeeded,,", // ok (line 2)
      "DON-2,D1,not-an-email,Ana,2026-13-40,-5,bitcoin,nowhere,,pending,,", // 5 problems (line 3)
      "DON-1,D1,ana@example.org,Ana,2026-01-11,10,card,becas,,succeeded,,", // duplicate id (line 4)
      ",D1,ana@example.org,Ana,2026-01-12,10,card,becas,,succeeded,,", // missing id (line 5)
    ].join("\n");
    const report = await runImport(db, { donationsCsv: bad });
    expect(report.donations).toMatchObject({ total: 4, valid: 1, new: 1 });
    const byRow = (row: number) => report.donations.issues.filter((i) => i.row === row).map((i) => i.field);
    expect(byRow(3)).toEqual(["email", "date", "amount_usd", "method", "program", "status"]);
    expect(byRow(4)).toEqual(["donation_id"]);
    expect(byRow(5)).toEqual(["donation_id"]);
    expect(await db.donation.count()).toBe(1);
  });

  it("rejects a file with missing columns", async () => {
    const report = await runImport(db, { donationsCsv: "donation_id,donor_id\nDON-1,D1" });
    expect(report.donations.valid).toBe(0);
    expect(report.donations.issues[0].message).toMatch(/Missing columns/);
  });

  it("flags subscriptions of unknown donors", async () => {
    const snapshot = [SUB_HEADER, "SUB-1,D404,25,monthly,2026-01-10,,active"].join("\n");
    const report = await runImport(db, { subscriptionsCsv: snapshot });
    expect(report.subscriptions.valid).toBe(0);
    expect(report.subscriptions.issues[0]).toMatchObject({ row: 2, field: "donor_id" });
  });

  it("dry run reports the same counts and writes nothing", async () => {
    const preview = await runImport(db, { donationsCsv, subscriptionsCsv }, { dryRun: true });
    expect(preview).toMatchObject({ dryRun: true });
    expect(preview.donations.new).toBe(3);
    expect(await db.donation.count()).toBe(0);
    expect(await db.donor.count()).toBe(0);
    const real = await runImport(db, { donationsCsv, subscriptionsCsv });
    expect(real.donations.new).toBe(preview.donations.new);
    expect(real.donors).toEqual(preview.donors);
  });

  it("imports the generated mock data and a second import is a no-op", async () => {
    const files = {
      donationsCsv: readFileSync(join(__dirname, "../../data/donations.csv"), "utf8"),
      subscriptionsCsv: readFileSync(join(__dirname, "../../data/subscriptions.csv"), "utf8"),
    };
    const first = await runImport(db, files);
    expect(first.donations.issues).toEqual([]);
    expect(first.subscriptions.issues).toEqual([]);
    expect(first.donations.new).toBe(first.donations.total);
    expect(first.donors.new).toBe(2525);

    const second = await runImport(db, files);
    expect(second.donations).toMatchObject({ new: 0, updated: 0, unchanged: first.donations.total });
    expect(second.subscriptions).toMatchObject({ new: 0, updated: 0, removed: 0 });
    expect(second.donors).toEqual({ new: 0, updated: 0 });
    expect(await db.donation.count()).toBe(first.donations.total);
  }, 120_000);
});
