// Seeds reference data: default settings and the badge definitions.
// Idempotent: existing rows (e.g. settings or badge texts edited in the backoffice) are left untouched.
// Users are created after the donors exist (scripts/seed-users.ts); mock data comes from the importer.

import { PrismaClient } from "@prisma/client";
import { seedReferenceData } from "../src/lib/seeding";

const db = new PrismaClient();

seedReferenceData(db)
  .then(async (added) => {
    const [settings, badges] = await Promise.all([db.setting.count(), db.badgeDefinition.count()]);
    console.log(`Seed done: settings ${settings} (+${added.settings}), badge definitions ${badges} (+${added.badges}).`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
