// Dev helper: summarises stored notifications and prints one or more users' feeds.
//   npm run inspect -- User3 User17

import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  try {
    const rows = await db.notification.findMany({ include: { user: true }, orderBy: [{ createdAt: "asc" }, { seq: "asc" }] });
    const byType = new Map<string, number>();
    for (const r of rows) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    console.log("by type:", [...byType.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([t, n]) => `${t}:${n}`).join(" "));
    const byUser = new Map<string, number>();
    for (const r of rows) byUser.set(r.user.username, (byUser.get(r.user.username) ?? 0) + 1);
    console.log("by user:", [...byUser.entries()].sort((a, b) => b[1] - a[1]).map(([u, n]) => `${u}:${n}`).join(" "));
    for (const name of process.argv.slice(2)) {
      console.log(`\n--- ${name} ---`);
      for (const r of rows.filter((x) => x.user.username === name)) {
        console.log(r.createdAt, r.type.padEnd(3), JSON.stringify(r.params));
      }
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
