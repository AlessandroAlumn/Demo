// `npm run setup`: prepares a fresh clone for `npm run dev`.
// Later steps append: generate mock CSVs, import them, seed users, run the pipeline.

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

run("npx prisma migrate deploy");
run("npx prisma generate");
run("npm run db:seed");

console.log("\nSetup finished.");
