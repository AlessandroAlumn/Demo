// `npm test`: runs Vitest. If, and only if, EVERY test file fails to load and no test ran (a rare, intermittent
// failure seen a few times, probably when the dev server rewrites generated files at the same moment), it saves
// the output to .vitest-failure.log and retries once. Any real test failure is reported as it is, with no retry.

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const vitest = join("node_modules", "vitest", "vitest.mjs");
const args = ["run", ...process.argv.slice(2)];

function run() {
  const result = spawnSync(process.execPath, [vitest, ...args], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { status: result.status ?? 1, output };
}

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const neverLoaded = (output) => {
  const text = stripAnsi(output);
  const files = /Test Files\s+(\d+) failed \((\d+)\)/.exec(text);
  return /Tests\s+no tests/.test(text) && files !== null && files[1] === files[2];
};

let { status, output } = run();
if (status !== 0 && neverLoaded(output)) {
  writeFileSync(".vitest-failure.log", output);
  console.warn("\n⚠ Every test file failed to load (no test ran). Output saved to .vitest-failure.log. Retrying once…\n");
  ({ status, output } = run());
}
process.stdout.write(output);
process.exit(status);
