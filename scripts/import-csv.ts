// `npm run import` imports data/donations.csv and data/subscriptions.csv into the local database.
//
//   npm run import                                   # both default files
//   npm run import -- --dry-run                      # validate and report only
//   npm run import -- --donations path.csv --subscriptions path.csv

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { formatReport, runImport } from "../src/lib/importer";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const donationsPath = arg("donations") ?? join("data", "donations.csv");
  const subscriptionsPath = arg("subscriptions") ?? join("data", "subscriptions.csv");

  const input: { donationsCsv?: string; subscriptionsCsv?: string } = {};
  if (existsSync(donationsPath)) input.donationsCsv = readFileSync(donationsPath, "utf8");
  else console.warn(`Skipping donations: ${donationsPath} not found`);
  if (existsSync(subscriptionsPath)) input.subscriptionsCsv = readFileSync(subscriptionsPath, "utf8");
  else console.warn(`Skipping subscriptions: ${subscriptionsPath} not found`);

  const db = new PrismaClient();
  try {
    const started = Date.now();
    const report = await runImport(db, input, { dryRun });
    console.log(formatReport(report));
    console.log(`(${((Date.now() - started) / 1000).toFixed(1)}s)`);
    const problems = report.donations.issues.length + report.subscriptions.issues.length;
    if (problems > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
