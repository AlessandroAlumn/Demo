// `npm run verify-coverage`: runs the whole demo (2026-07-01 -> 2026-12-31) on a TEMPORARY COPY of the
// dev database and checks that every badge (B-*) and every notification type (N*) appears at least once.
// Things that normally come from the UI (a first login, a share, social-follow claims and their review)
// are simulated here through the same functions the real screens use. Your own demo state is untouched.
//
// Exit code 1 if anything is missing.

import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SOCIAL_NETWORKS } from "../src/lib/constants";
import { recordFirstLogin, recordShare, reviewSocialClaim, submitSocialClaim } from "../src/lib/demo-actions";
import { NOTIFICATION_META, STORED_TYPES } from "../src/lib/notification-types";
import { DEMO_END_DATE, processUntil, resetDemo } from "../src/lib/pipeline";

async function main() {
  const source = join("prisma", "dev.db");
  if (!existsSync(source)) throw new Error('prisma/dev.db not found. Run "npm run setup" first.');

  const dir = mkdtempSync(join(tmpdir(), "alumnusb-coverage-"));
  const copy = join(dir, "coverage.db");
  copyFileSync(source, copy);
  const db = new PrismaClient({ datasourceUrl: `file:${copy.replace(/\\/g, "/")}` });

  try {
    const started = Date.now();
    const userId = async (username: string) => (await db.user.findUniqueOrThrow({ where: { username } })).id;
    const [user3, user13, user20] = await Promise.all([userId("User3"), userId("User13"), userId("User20")]);

    console.log("Resetting the demo (baseline day)…");
    await resetDemo(db);

    console.log("Simulating UI actions on the way…");
    await processUntil(db, "2026-07-05");
    await recordFirstLogin(db, user3, { refresh: false }); //            Welcome + Early Adopter
    await recordShare(db, user13, "B-M0", "whatsapp", { refresh: false }); // Proud Supporter

    await processUntil(db, "2026-07-06");
    const claims: Record<string, string> = {};
    for (const network of SOCIAL_NETWORKS) {
      const r = await submitSocialClaim(db, user13, network);
      if (r.ok) claims[network] = r.claimId;
    }
    const rejected = await submitSocialClaim(db, user20, "instagram");

    await processUntil(db, "2026-07-07");
    for (const network of ["instagram", "tiktok", "x", "youtube"]) {
      await reviewSocialClaim(db, claims[network], "approved", { refresh: false });
    }
    if (rejected.ok) await reviewSocialClaim(db, rejected.claimId, "rejected", { refresh: false });

    await processUntil(db, "2026-07-08");
    await reviewSocialClaim(db, claims.facebook, "approved", { refresh: false }); // completes Fully Connected

    console.log(`Running to ${DEMO_END_DATE}…`);
    const result = await processUntil(db, DEMO_END_DATE);
    console.log(`  ${result.days} days, ${result.awards} awards and ${result.notifications} notifications since 07-09`);

    // ---- badges ----
    const definitions = await db.badgeDefinition.findMany({ orderBy: { sortOrder: "asc" } });
    const awarded = await db.badgeAward.groupBy({ by: ["badgeId"], _count: { _all: true } });
    const awardCount = new Map(awarded.map((a) => [a.badgeId, a._count._all]));
    const missingBadges = definitions.filter((d) => !awardCount.get(d.id)).map((d) => d.id);

    // ---- notifications ----
    const stored = await db.notification.groupBy({ by: ["type"], _count: { _all: true } });
    const typeCount = new Map(stored.map((s) => [s.type, s._count._all]));
    const missingTypes = STORED_TYPES.filter((t) => !typeCount.get(t));

    console.log(`\nBadges: ${definitions.length - missingBadges.length}/${definitions.length} awarded at least once`);
    console.log(definitions.map((d) => `${d.id}:${awardCount.get(d.id) ?? 0}`).join("  "));
    console.log(`\nNotification types: ${STORED_TYPES.length - missingTypes.length}/${STORED_TYPES.length} stored at least once`);
    console.log(
      STORED_TYPES.map((t) => `${t}:${typeCount.get(t) ?? 0}`).join("  ") +
        `\n(UI-only, never stored: ${Object.entries(NOTIFICATION_META).filter(([, m]) => m.uiOnly).map(([t]) => t).join(", ")})`,
    );

    console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s.`);
    if (missingBadges.length || missingTypes.length) {
      console.error(`\nMISSING badges: ${missingBadges.join(", ") || "none"}`);
      console.error(`MISSING notification types: ${missingTypes.join(", ") || "none"}`);
      process.exitCode = 1;
    } else {
      console.log("\nOK: every badge and every notification type was produced.");
    }
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
