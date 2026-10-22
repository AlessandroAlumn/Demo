// The 20 demo personas (User1-User20 <-> donors D0001-D0020), plus the 5 donors User14 refers.
//
// Every persona is timed so that stepping the demo clock from 2026-07-01 (launch) to 2026-12-31
// triggers specific badges and notifications. See PLAN.md section 5.
//
// Notes on thresholds (so the numbers below are not "magic"):
// - Points: one-time $1 = 1 pt, recurring $1 = 1.5 pts, streak bonus +5/month (max 60).
// - Recurring tier = current monthly amount: >=20 Recurring, >=50 Silver, >=100 Gold, >=250 Platinum, >=500 Diamond.
// - Lifetime clubs: $100, $250, $500, $1K, $2.5K, $5K, $10K.

import type { PaymentMethod, Program } from "../src/lib/constants";
import {
  generateCharges,
  type ChargeOptions,
  type DonationRow,
  type DonorInfo,
  type SubRow,
} from "./lib/mock-helpers";

export type PersonaData = {
  donors: DonorInfo[];
  donations: DonationRow[];
  /** Subscriptions with temporary ids ("tmp:..."); the generator renumbers them. */
  subscriptions: SubRow[];
};

export const PERSONA_COUNT = 20;
export const REFERRED_BY_USER14 = ["D2521", "D2522", "D2523", "D2524", "D2525"];

export const donorIdForUser = (n: number) => `D${String(n).padStart(4, "0")}`;

export function buildPersonas(): PersonaData {
  const donors: DonorInfo[] = [];
  const donations: DonationRow[] = [];
  const subscriptions: SubRow[] = [];

  for (let n = 1; n <= PERSONA_COUNT; n++) {
    donors.push({
      id: donorIdForUser(n),
      name: `User${n}`,
      email: `user${n}@demo.alumnusb.test`,
    });
  }

  const gift = (
    userN: number,
    date: string,
    amountUsd: number,
    program: Program = "becas",
    extra: Partial<Pick<DonationRow, "campaign" | "method">> & { method?: PaymentMethod } = {},
  ) => {
    donations.push({
      donorId: donorIdForUser(userN),
      date,
      amountUsd,
      method: extra.method ?? "card",
      program,
      campaign: extra.campaign ?? "",
      status: "succeeded",
      subscriptionId: "",
      referredBy: "",
    });
  };

  const sub = (
    userN: number,
    tag: string,
    opts: Omit<ChargeOptions, "subId" | "donorId" | "program"> & { program?: Program },
  ) => {
    const subId = `tmp:user${userN}:${tag}`;
    const result = generateCharges({
      ...opts,
      subId,
      donorId: donorIdForUser(userN),
      program: opts.program ?? "becas",
    });
    donations.push(...result.rows);
    subscriptions.push({
      id: subId,
      donorId: donorIdForUser(userN),
      amountUsd: opts.amount,
      frequency: opts.frequency,
      startDate: opts.start,
      endDate: result.endDate,
      status: "active", // overwritten by the generator
    });
  };

  // User1: big donor. $500/month from launch week, large one-time gifts, crosses $10K lifetime in July.
  [
    ["2018-11-20", 1000, "becas"],
    ["2019-12-10", 1200, "premio_planchart"],
    ["2020-12-05", 800, "becas"],
    ["2021-12-12", 1000, "infraestructura"],
    ["2022-12-08", 900, "becas"],
    ["2023-12-06", 1100, "transporte"],
    ["2024-12-10", 1200, "becas"],
    ["2025-12-09", 1600, "becas"], // lifetime before launch: $8,800
  ].forEach(([d, a, p]) => gift(1, d as string, a as number, p as Program));
  sub(1, "A", { start: "2026-07-05", frequency: "monthly", amount: 500 });
  gift(1, "2026-07-20", 1500); // lifetime passes $10K here; Donor of the Month (July)
  gift(1, "2026-08-18", 1800, "infraestructura"); // Donor of the Month (August)
  gift(1, "2026-10-09", 2000); // Donor of the Month (October)
  gift(1, "2026-12-14", 2500); // Donor of the Month (December)

  // User2: loyal $25/month since 2024-09-10. The 24-month streak lands on 2026-08-10.
  sub(2, "A", { start: "2024-09-10", frequency: "monthly", amount: 25 });

  // User3: $100/month (Gold). July charge fails on the 15th and is fixed on the 19th (inside grace).
  sub(3, "A", {
    start: "2026-01-15",
    frequency: "monthly",
    amount: 100,
    overrides: { "2026-07": { fail: true, retryDate: "2026-07-19" } },
  });

  // User4: $50/month. August charge fails and is never fixed (grace expires), reactivates at $100 on 10-05.
  sub(4, "A", {
    start: "2025-04-03",
    frequency: "monthly",
    amount: 50,
    end: "2026-10-05",
    overrides: { "2026-08": { fail: true, stop: true } },
  });
  sub(4, "B", { start: "2026-10-05", frequency: "monthly", amount: 100 });

  // User5: brand new. First gift 2026-07-10, $20/month (3-month streak in Sept, 6-month in Dec).
  sub(5, "A", { start: "2026-07-10", frequency: "monthly", amount: 20 });

  // User6: employer matching in 2024, 2025 and 2026 (the 2026 match lands in September).
  gift(6, "2024-05-14", 200);
  gift(6, "2024-06-03", 200, "becas", { method: "matching_gift" });
  gift(6, "2025-05-12", 200);
  gift(6, "2025-06-02", 200, "becas", { method: "matching_gift" });
  gift(6, "2026-09-10", 150);
  gift(6, "2026-09-20", 150, "becas", { method: "matching_gift" });

  // User7: low-ranked, then a $1,200 gift in September (biggest climber, passes $1K) and $250/month in October.
  gift(7, "2021-12-05", 50);
  gift(7, "2023-12-08", 50);
  gift(7, "2025-12-10", 50);
  gift(7, "2026-09-09", 1200); // Donor of the Month (September)
  sub(7, "A", { start: "2026-10-01", frequency: "monthly", amount: 250 });

  // User8: lifetime $235 (6% short of the $250 Club). A $20 gift in August crosses it and makes 5 giving years.
  gift(8, "2022-12-10", 50);
  gift(8, "2023-11-20", 60);
  gift(8, "2024-12-05", 60);
  gift(8, "2025-12-12", 65);
  gift(8, "2026-08-20", 20, "transporte");

  // User9: $45/month (10% short of Silver), raises to $50 in October. Passes $500 in November.
  sub(9, "A", { start: "2026-01-15", frequency: "monthly", amount: 45, end: "2026-10-15" });
  sub(9, "B", { start: "2026-10-15", frequency: "monthly", amount: 50 });

  // User10: lapsed. Gave every December 2019-2025, nothing in 2026.
  for (let y = 2019; y <= 2025; y++) gift(10, `${y}-12-10`, 40);

  // User11: gave to 3 of the 4 permanent programs; infrastructure in August completes them and passes $5K.
  gift(11, "2021-03-15", 2000, "becas");
  gift(11, "2023-05-20", 1500, "premio_planchart");
  gift(11, "2025-04-10", 1000, "transporte");
  gift(11, "2026-08-12", 600, "infraestructura");

  // User12: lifetime $2,100, then the earthquake appeal in August (passes $2.5K, Campaign Hero).
  gift(12, "2020-12-08", 700);
  gift(12, "2022-12-06", 700);
  gift(12, "2024-12-05", 700);
  gift(12, "2026-08-10", 500, "fondo_general_emergencia", {
    campaign: "emergencia-sismo-2026",
    method: "zelle",
  });

  // User13: small donor, 2 giving years so far; August gift to a new program makes the 3rd year.
  gift(13, "2024-11-12", 25);
  gift(13, "2025-11-11", 25);
  gift(13, "2026-08-14", 30, "premio_planchart");

  // User14: $30/month; refers 5 donors (Recruiter in August, Super Recruiter in December).
  sub(14, "A", { start: "2025-06-08", frequency: "monthly", amount: 30 });

  // User15: local ambassador (badge awarded by hand in the seed).
  sub(15, "A", { start: "2025-03-05", frequency: "monthly", amount: 25 });

  // User16: gave every August 18th since 2016 except 2022 (9 giving years), the 2026 gift makes 10.
  for (const y of [2016, 2017, 2018, 2019, 2020, 2021, 2023, 2024, 2025, 2026]) {
    gift(16, `${y}-08-18`, 50);
  }

  // Users 17 & 18: near-identical lifetime totals ($640 vs $638) who leapfrog in the monthly ranking.
  gift(17, "2023-12-05", 300);
  gift(17, "2025-12-05", 340);
  gift(18, "2023-12-06", 300);
  gift(18, "2025-12-06", 338);
  const earlyDays = [3, 10, 17, 24];
  const lateDays = [6, 13, 20, 27];
  const earlyAmounts = [20, 10, 10, 10];
  const lateAmounts = [25, 10, 10, 10];
  for (let j = 0; j < 6; j++) {
    const month = `2026-${String(7 + j).padStart(2, "0")}`;
    // Even months User17 gives first; odd months User18 does, so the lead keeps changing hands.
    const [earlyUser, lateUser] = j % 2 === 0 ? [17, 18] : [18, 17];
    for (let k = 0; k < 4; k++) {
      const day = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
      const lateProgram: Program = month === "2026-10" && lateUser === 17 && k === 0 ? "eventos" : "becas";
      const earlyProgram: Program = month === "2026-10" && earlyUser === 17 && k === 0 ? "eventos" : "becas";
      gift(earlyUser, day(earlyDays[k]), earlyAmounts[k], earlyProgram);
      gift(lateUser, day(lateDays[k]), lateAmounts[k], lateProgram);
    }
  }

  // User19: $600 once a year (= $50/month, Silver through annual normalisation), first charge in September.
  sub(19, "A", { start: "2026-09-15", frequency: "annual", amount: 600 });

  // User20: occasional $10 gifts, an honest low rank. A September gift goes to a new program.
  gift(20, "2023-05-10", 10);
  gift(20, "2024-05-12", 10);
  gift(20, "2025-06-02", 10);
  gift(20, "2026-09-18", 10, "concurso_proyectos");

  // The 5 donors User14 refers: one first gift each, flagged with referred_by.
  const referredGifts: [string, number][] = [
    ["2026-08-05", 40],
    ["2026-09-12", 50],
    ["2026-10-08", 35],
    ["2026-11-14", 60],
    ["2026-12-06", 45],
  ];
  referredGifts.forEach(([date, amount], i) => {
    const id = REFERRED_BY_USER14[i];
    donors.push({
      id,
      name: `Referred Donor ${i + 1}`,
      email: `referred${i + 1}@example.org`,
    });
    donations.push({
      donorId: id,
      date,
      amountUsd: amount,
      method: "card",
      program: "becas",
      campaign: "",
      status: "succeeded",
      subscriptionId: "",
      referredBy: "D0014",
    });
  });

  return { donors, donations, subscriptions };
}
