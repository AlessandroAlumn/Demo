// Sanity report for the mock data: `npm run data:stats`.
// Checks the calibration targets from PLAN.md section 4.4 and the persona timelines.

import { generateMockData } from "./generate-mock-data";
import { LAUNCH_DATE } from "./lib/mock-helpers";

const data = generateMockData();
const ok = data.donations.filter((d) => d.status === "succeeded");
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// Active donors per month (>=1 succeeded donation)
const activeByMonth = new Map<string, Set<string>>();
const sumByMonth = new Map<string, number>();
for (const d of ok) {
  const m = d.date.slice(0, 7);
  if (!activeByMonth.has(m)) activeByMonth.set(m, new Set());
  activeByMonth.get(m)!.add(d.donorId);
  sumByMonth.set(m, (sumByMonth.get(m) ?? 0) + d.amountUsd);
}
console.log("\nMonth     active donors   raised    top donor by $ (month)");
for (const m of [...activeByMonth.keys()].sort().filter((m) => m >= "2025-10")) {
  const per = new Map<string, number>();
  for (const d of ok.filter((x) => x.date.startsWith(m))) {
    per.set(d.donorId, (per.get(d.donorId) ?? 0) + d.amountUsd);
  }
  const [topId, topAmt] = [...per.entries()].sort((a, b) => b[1] - a[1])[0];
  console.log(
    `${m}   ${String(activeByMonth.get(m)!.size).padStart(5)}        ${money(sumByMonth.get(m)!).padStart(9)}   ${topId} ${money(topAmt)}`,
  );
}

// Organisation running total
let running = 0;
let before = 0;
let crossed1M = "";
for (const d of ok) {
  running += d.amountUsd;
  if (d.date < LAUNCH_DATE) before = running;
  if (!crossed1M && running >= 1_000_000) crossed1M = d.date;
}
console.log(`\nOrg total before launch: ${money(before)} | end of data: ${money(running)} | first reaches $1M on: ${crossed1M || "never"}`);

// Persona lifetime and threshold crossings inside the demo window
const clubs = [100, 250, 500, 1000, 2500, 5000, 10000];
console.log("\nPersona   lifetime@launch  threshold crossings in window");
for (let n = 1; n <= 20; n++) {
  const id = `D${String(n).padStart(4, "0")}`;
  let total = 0;
  let atLaunch = 0;
  const crossings: string[] = [];
  for (const d of ok.filter((x) => x.donorId === id)) {
    const prev = total;
    total += d.amountUsd;
    if (d.date < LAUNCH_DATE) atLaunch = total;
    else for (const c of clubs) if (prev < c && total >= c) crossings.push(`$${c}@${d.date}`);
  }
  console.log(`User${String(n).padEnd(2)}    ${money(atLaunch).padStart(8)}        ${crossings.join(", ")}`);
}

// Counts
const methods = new Map<string, number>();
for (const d of data.donations) methods.set(d.method, (methods.get(d.method) ?? 0) + 1);
const failed = data.donations.filter((d) => d.status === "failed").length;
const referred = data.donations.filter((d) => d.referredBy).length;
const campaign = data.donations.filter((d) => d.campaign).length;
console.log(
  `\nRows ${data.donations.length} (failed ${failed}, campaign ${campaign}, referred ${referred}) | donors ${data.donors.length} | subs ${data.subscriptions.length}`,
);
console.log("Methods:", Object.fromEntries(methods));
const subStatus = new Map<string, number>();
for (const s of data.subscriptions) subStatus.set(s.status, (subStatus.get(s.status) ?? 0) + 1);
console.log("Subscription status:", Object.fromEntries(subStatus));
console.log("Active recurring at launch:", data.subscriptions.filter((s) => s.startDate < LAUNCH_DATE && (!s.endDate || s.endDate >= LAUNCH_DATE)).length);
