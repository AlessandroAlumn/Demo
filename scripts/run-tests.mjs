// `npm test`: runs Vitest. If, and only if, EVERY test file fails to load and no test ran, it waits and retries
// (after 4 s, then 8 s), keeping the failing output in .vitest-failure.log.
//
// Why: now and then (five times while this project was built, never on demand) every test file fails at once with
// "Vitest failed to find the current suite", the symptom of Vitest being loaded twice. A moment later the same run
// passes. The root cause is unknown, so this only gets around it and records the evidence. Any real test failure
// is reported exactly as it is, with no retry.

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const vitest = join("node_modules", "vitest", "vitest.mjs");
const args = ["run", ...process.argv.slice(2)];
const sleep = (seconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);

function run() {
  const result = spawnSync(process.execPath, [vitest, ...args], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const neverLoaded = (output) => {
  const text = stripAnsi(output);
  const files = /Test Files\s+(\d+) failed \((\d+)\)/.exec(text);
  return /Tests\s+no tests/.test(text) && files !== null && files[1] === files[2];
};

let { status, output } = run();
for (const wait of [4, 8]) {
  if (status === 0 || !neverLoaded(output)) break;
  writeFileSync(".vitest-failure.log", output);
  console.warn(`\n⚠ Every test file failed to load (no test ran). Output saved to .vitest-failure.log. Retrying in ${wait}s…`);
  sleep(wait);
  ({ status, output } = run());
}
process.stdout.write(output);
process.exit(status);
