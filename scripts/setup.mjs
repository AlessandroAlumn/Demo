// `npm run setup`: prepares a fresh clone for `npm run dev`.

import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

if (!existsSync("data/donations.csv") || !existsSync("data/subscriptions.csv")) {
  run("npm run generate-data");
}

run("npx prisma migrate deploy");
run("npx prisma generate");
run("npm run db:seed");
run("npm run import");
run("npm run seed:users");
run("npm run demo -- reset");

console.log("\nSetup finished.");
