// Creates the login accounts: `admin` and User1..User20 (linked to donors D0001..D0020).
// Run after the import (the donors must exist). Idempotent.
//
// There are no passwords in the prototype: the login form's password field is a placeholder.

import { PrismaClient } from "@prisma/client";
import { PERSONA_COUNT, donorIdForUser } from "./personas";
import { SETTING_DEFAULTS } from "../src/lib/settings-defaults";

const db = new PrismaClient();

async function main() {
  const donorIds = new Set((await db.donor.findMany({ select: { id: true } })).map((d) => d.id));
  const missing = Array.from({ length: PERSONA_COUNT }, (_, i) => donorIdForUser(i + 1)).filter(
    (id) => !donorIds.has(id),
  );
  if (missing.length > 0) {
    throw new Error(`Donors not found (${missing.join(", ")}). Run "npm run import" first.`);
  }

  let created = 0;
  const ensure = async (data: Parameters<typeof db.user.create>[0]["data"]) => {
    const existing = await db.user.findUnique({ where: { username: data.username } });
    if (existing) return;
    await db.user.create({ data });
    created++;
  };

  await ensure({ username: "admin", role: "admin" });
  for (let n = 1; n <= PERSONA_COUNT; n++) {
    await ensure({
      username: `User${n}`,
      role: "donor",
      donorId: donorIdForUser(n),
      referralCode: `USER${n}`,
    });
  }

  // User15 is the local ambassador: a manual badge, so "Reset demo" keeps it.
  const launch = SETTING_DEFAULTS.launchDate;
  await db.badgeAward.upsert({
    where: {
      donorId_badgeId_periodKey: { donorId: donorIdForUser(15), badgeId: "B-SO8", periodKey: "" },
    },
    update: {},
    create: {
      donorId: donorIdForUser(15),
      badgeId: "B-SO8",
      awardedAt: launch,
      periodKey: "",
      source: "manual",
    },
  });

  console.log(`Users: ${await db.user.count()} total (+${created}). Ambassador badge awarded to User15.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
