// Seeds reference data: default settings and the badge definitions.
// Idempotent: existing rows (e.g. settings or badge texts edited in the backoffice) are left untouched.
// Users are created after the donors exist (step 5), and mock data comes from the importer.

import { PrismaClient } from "@prisma/client";
import { BADGE_SEEDS } from "../src/lib/badge-definitions";
import { SETTING_DEFAULTS } from "../src/lib/settings-defaults";

const db = new PrismaClient();

async function main() {
  let settingsCreated = 0;
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    const existing = await db.setting.findUnique({ where: { key } });
    if (!existing) {
      await db.setting.create({ data: { key, value: value as never } });
      settingsCreated++;
    }
  }

  let badgesCreated = 0;
  for (const [index, b] of BADGE_SEEDS.entries()) {
    const existing = await db.badgeDefinition.findUnique({ where: { id: b.id } });
    if (existing) continue;
    await db.badgeDefinition.create({
      data: {
        id: b.id,
        category: b.category,
        nameEs: b.nameEs,
        nameEn: b.nameEn,
        descEs: b.descEs,
        descEn: b.descEn,
        rule: b.rule as never,
        icon: b.icon,
        tier: b.tier ?? null,
        repeatable: b.repeatable ?? false,
        manualOnly: b.manualOnly ?? false,
        sortOrder: index,
      },
    });
    badgesCreated++;
  }

  const [settings, badges] = await Promise.all([db.setting.count(), db.badgeDefinition.count()]);
  console.log(
    `Seed done: settings ${settings} (+${settingsCreated}), badge definitions ${badges} (+${badgesCreated}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
