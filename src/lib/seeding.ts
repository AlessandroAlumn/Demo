// Seeding shared by the scripts (prisma/seed.ts, scripts/seed-users.ts) and the tests, so a test
// database is built exactly like the real one.

import type { PrismaClient } from "@prisma/client";
import { BADGE_SEEDS } from "./badge-definitions";
import { seedDemoPosts } from "./demo-posts";
import { SETTING_DEFAULTS } from "./settings-defaults";

/** Donors D0001..D0020 are the User1..User20 personas (see scripts/personas.ts). */
export const PERSONA_COUNT = 20;
export const donorIdForUser = (n: number) => `D${String(n).padStart(4, "0")}`;

/** Inserts the settings and badge definitions that are missing; existing rows (admin edits) are kept. */
export async function seedReferenceData(db: PrismaClient): Promise<{ settings: number; badges: number }> {
  let settings = 0;
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    if (await db.setting.findUnique({ where: { key } })) continue;
    await db.setting.create({ data: { key, value: value as never } });
    settings++;
  }

  let badges = 0;
  for (const [index, b] of BADGE_SEEDS.entries()) {
    if (await db.badgeDefinition.findUnique({ where: { id: b.id } })) continue;
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
    badges++;
  }
  return { settings, badges };
}

/**
 * Creates `admin` and User1..User20 (linked to donors D0001..D0020), the demo posts, and gives User15 the
 * Ambassador badge as a manual award (so "Reset demo" keeps it). Needs the donors to exist (import first).
 */
export async function seedUsers(db: PrismaClient): Promise<{ users: number; created: number; posts: number }> {
  const donorIds = new Set((await db.donor.findMany({ select: { id: true } })).map((d) => d.id));
  const missing = Array.from({ length: PERSONA_COUNT }, (_, i) => donorIdForUser(i + 1)).filter((id) => !donorIds.has(id));
  if (missing.length > 0) throw new Error(`Donors not found (${missing.join(", ")}). Run "npm run import" first.`);

  let created = 0;
  const ensure = async (data: Parameters<typeof db.user.create>[0]["data"]) => {
    if (await db.user.findUnique({ where: { username: data.username } })) return;
    await db.user.create({ data });
    created++;
  };
  await ensure({ username: "admin", role: "admin" });
  for (let n = 1; n <= PERSONA_COUNT; n++) {
    await ensure({ username: `User${n}`, role: "donor", donorId: donorIdForUser(n), referralCode: `USER${n}` });
  }

  await db.badgeAward.upsert({
    where: { donorId_badgeId_periodKey: { donorId: donorIdForUser(15), badgeId: "B-SO8", periodKey: "" } },
    update: {},
    create: {
      donorId: donorIdForUser(15),
      badgeId: "B-SO8",
      awardedAt: SETTING_DEFAULTS.launchDate,
      periodKey: "",
      source: "manual",
    },
  });

  const posts = await seedDemoPosts(db);
  return { users: await db.user.count(), created, posts };
}
