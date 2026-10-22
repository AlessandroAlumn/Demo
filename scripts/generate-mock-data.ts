// Deterministic mock-data generator: writes data/donations.csv, data/subscriptions.csv and
// data/companies.json. Same seed, same files.
//
//   npm run generate-data
//
// Layout: 20 hand-built personas (scripts/personas.ts) + ~2,500 anonymous background donors
// across 2016-01-01 .. 2026-12-31. Rows dated after the demo launch (2026-07-01) are intended:
// they "appear" as the simulated date advances.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import type { PaymentMethod, Program } from "../src/lib/constants";
import {
  DATA_END,
  DATA_START,
  addDays,
  createRng,
  daysBetween,
  deriveSubStatus,
  generateCharges,
  roundTo,
  type DonationRow,
  type DonorInfo,
  type Rng,
  type SubRow,
} from "./lib/mock-helpers";
import { buildPersonas } from "./personas";

export const SEED = 20260701;
export const BACKGROUND_DONORS = 2500;
export const EARTHQUAKE_CAMPAIGN = "emergencia-sismo-2026";

const FIRST_NAMES = [
  "María", "José", "Luis", "Carmen", "Carlos", "Ana", "Jorge", "Rosa", "Miguel", "Laura",
  "Pedro", "Elena", "Juan", "Patricia", "Andrés", "Gabriela", "Rafael", "Daniela", "Víctor", "Sofía",
  "Alejandro", "Valentina", "Ricardo", "Isabel", "Fernando", "Mariana", "Eduardo", "Claudia", "Gustavo", "Verónica",
  "Héctor", "Adriana", "Manuel", "Beatriz", "Sergio", "Lucía", "Diego", "Teresa", "Francisco", "Carolina",
  "Roberto", "Natalia", "Oscar", "Paola", "Raúl", "Silvia", "Alberto", "Cristina", "Enrique", "Mónica",
];
const LAST_NAMES = [
  "García", "Rodríguez", "Martínez", "Hernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres",
  "Flores", "Rivera", "Gómez", "Díaz", "Reyes", "Morales", "Cruz", "Ortiz", "Gutiérrez", "Chávez",
  "Ramos", "Vargas", "Castillo", "Jiménez", "Moreno", "Romero", "Herrera", "Medina", "Aguilar", "Rojas",
  "Mendoza", "Guerrero", "Salazar", "Paredes", "Silva", "Pacheco", "Blanco", "Núñez", "Peña", "Marín",
  "Contreras", "Fuentes", "Navarro", "Montes", "Alvarado", "Bello", "Linares", "Quintero", "Urdaneta", "Zambrano",
  "Arismendi", "Betancourt", "Carvajal", "Delgado", "Escalona", "Figueroa", "Graterol", "Hurtado", "Ibarra", "Lezama",
];

const PROGRAM_WEIGHTS: readonly (readonly [Program, number])[] = [
  ["becas", 40],
  ["premio_planchart", 10],
  ["transporte", 10],
  ["infraestructura", 10],
  ["fondo_general_emergencia", 15],
  ["concurso_proyectos", 10],
  ["eventos", 5],
];
const ONE_TIME_METHODS: readonly (readonly [PaymentMethod, number])[] = [
  ["card", 52],
  ["paypal", 13],
  ["zelle", 27],
  ["check", 5],
  ["crypto", 3],
];
const RECURRING_AMOUNTS: readonly (readonly [number, number])[] = [
  [20, 42],
  [25, 29],
  [30, 8],
  [50, 14],
  [100, 6],
  [250, 1],
];
/** 1 = uniform over 2016-2026, higher = more first gifts in recent years. */
const FIRST_GIFT_SKEW = 3.1;
/** Annual plans are capped at this monthly equivalent (a $250/month plan would be a $3,000 charge). */
const ANNUAL_MAX_MONTHLY = 50;
/** Share of background donors on a recurring plan. */
const RECURRING_SHARE = 0.36;
/** Chance a one-time donor keeps giving in each following year. */
const REPEAT_PROBABILITY = 0.68;
const COMMON_GIFTS = [10, 20, 25, 30, 50, 100, 150, 200, 250, 500];
/** Giving is heavier in Nov/Dec. */
const MONTH_WEIGHTS = [0.8, 0.8, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1.0, 1.0, 1.3, 2.2];

/** Scales one-time background gifts so the organisation's running total passes $1M during the demo. */
export const ONE_TIME_SCALE = 0.55;
const MAX_BACKGROUND_GIFT = 1000;

function oneTimeAmount(rng: Rng): number {
  const raw = rng.chance(0.5)
    ? rng.pick(COMMON_GIFTS)
    : roundTo(rng.logNormal(60, 0.9), 5);
  const scaled = roundTo(raw * ONE_TIME_SCALE, 5);
  return Math.min(MAX_BACKGROUND_GIFT, Math.max(10, scaled));
}

function randomDateInYear(rng: Rng, year: number): string {
  const month = rng.weighted(MONTH_WEIGHTS.map((w, i) => [i + 1, w] as const));
  const day = rng.int(1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstDonationDate(rng: Rng): string {
  const total = daysBetween(DATA_START, DATA_END);
  // A power curve skews first gifts towards recent years: the donor base grows over time.
  return addDays(DATA_START, Math.floor(Math.pow(rng.next(), 1 / FIRST_GIFT_SKEW) * total));
}

export type MockData = {
  donors: DonorInfo[];
  donations: (DonationRow & { id: string })[];
  subscriptions: SubRow[];
  companies: { name: string; matches: boolean; platform: string | null }[];
};

export function generateMockData(seed = SEED): MockData {
  const rng = createRng(seed);
  const persona = buildPersonas();

  const donors: DonorInfo[] = [...persona.donors];
  const rows: DonationRow[] = [...persona.donations];
  const subs: SubRow[] = [...persona.subscriptions];
  let tmpSub = 0;

  const backgroundIds: string[] = [];
  const recurringIds = new Set<string>();

  // ---- background donors ----
  for (let i = 0; i < BACKGROUND_DONORS; i++) {
    const id = `D${String(21 + i).padStart(4, "0")}`;
    backgroundIds.push(id);
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    donors.push({
      id,
      name: `${first} ${last}`,
      email: `${first}.${last}${21 + i}@example.org`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase(),
    });

    const start = firstDonationDate(rng);
    const startYear = Number(start.slice(0, 4));
    const program = rng.weighted(PROGRAM_WEIGHTS);

    if (rng.chance(RECURRING_SHARE)) {
      // recurring donor
      recurringIds.add(id);
      const annual = rng.chance(0.12);
      let monthlyAmount = rng.weighted(RECURRING_AMOUNTS);
      if (annual) monthlyAmount = Math.min(monthlyAmount, ANNUAL_MAX_MONTHLY);
      const subId = `tmp:bg:${tmpSub++}`;
      const result = generateCharges({
        subId,
        donorId: id,
        start,
        frequency: annual ? "annual" : "monthly",
        amount: annual ? monthlyAmount * 12 : monthlyAmount,
        program,
        method: rng.chance(0.8) ? "card" : "paypal",
        random: {
          rng,
          churnPerPeriod: annual ? 0.1 : 0.012,
          failProb: annual ? 0.03 : 0.012,
        },
      });
      rows.push(...result.rows);
      subs.push({
        id: subId,
        donorId: id,
        amountUsd: annual ? monthlyAmount * 12 : monthlyAmount,
        frequency: annual ? "annual" : "monthly",
        startDate: start,
        endDate: result.endDate,
        status: "active",
      });
      // some recurring donors also give extra one-time gifts
      for (let y = startYear; y <= 2026; y++) {
        if (rng.chance(0.12)) {
          const date = randomDateInYear(rng, y);
          if (date >= start && date <= DATA_END) {
            rows.push(oneTimeRow(rng, id, date, program));
          }
        }
      }
    } else {
      // one-time donor: each year after the first they give again with some probability
      let active = true;
      for (let y = startYear; y <= 2026; y++) {
        if (y > startYear) active = rng.chance(REPEAT_PROBABILITY) ? true : active && rng.chance(0.75);
        if (!active && y > startYear && !rng.chance(0.2)) continue;
        const gifts = 1 + (rng.chance(0.3) ? 1 : 0) + (rng.chance(0.1) ? 1 : 0);
        for (let g = 0; g < gifts; g++) {
          let date = y === startYear && g === 0 ? start : randomDateInYear(rng, y);
          if (date < start) date = start;
          if (date > DATA_END) continue;
          rows.push(oneTimeRow(rng, id, date, rng.chance(0.7) ? program : rng.weighted(PROGRAM_WEIGHTS)));
        }
      }
    }
  }

  // ---- earthquake campaign: ~5% of background donors, Aug-Nov 2026, front-loaded ----
  for (const id of pickMany(rng, backgroundIds, Math.round(BACKGROUND_DONORS * 0.05))) {
    const offset = Math.floor(Math.pow(rng.next(), 1.6) * 122); // Aug 1 .. Nov 30
    rows.push({
      ...oneTimeRow(rng, id, addDays("2026-08-01", offset), "fondo_general_emergencia"),
      campaign: EARTHQUAKE_CAMPAIGN,
    });
  }

  // ---- employer matching: ~3% of donors, matched one-time gifts (yearly) ----
  const oneTimeByDonorYear = new Map<string, DonationRow>();
  for (const r of rows) {
    if (r.subscriptionId || r.status !== "succeeded" || r.method === "matching_gift") continue;
    if (!backgroundIds.includes(r.donorId)) continue;
    const key = `${r.donorId}:${r.date.slice(0, 4)}`;
    const existing = oneTimeByDonorYear.get(key);
    if (!existing || r.date < existing.date) oneTimeByDonorYear.set(key, r);
  }
  for (const id of pickMany(rng, backgroundIds, Math.round(BACKGROUND_DONORS * 0.03))) {
    for (let y = 2019; y <= 2026; y++) {
      const gift = oneTimeByDonorYear.get(`${id}:${y}`);
      if (!gift || !rng.chance(0.8)) continue;
      const date = addDays(gift.date, rng.int(7, 30));
      if (date > DATA_END) continue;
      rows.push({ ...gift, date, method: "matching_gift", referredBy: "" });
    }
  }

  // ---- referrals: ~3% of background donors were referred by another background donor ----
  const referrerPool = backgroundIds.filter((id) => !recurringIds.has(id));
  const referred = new Map<string, string>();
  for (const id of pickMany(rng, backgroundIds, Math.round(BACKGROUND_DONORS * 0.03))) {
    const referrer = rng.pick(referrerPool);
    if (referrer !== id) referred.set(id, referrer);
  }
  const firstRowIndex = new Map<string, number>();
  rows.forEach((r, idx) => {
    if (!referred.has(r.donorId)) return;
    const current = firstRowIndex.get(r.donorId);
    if (current === undefined || r.date < rows[current].date) firstRowIndex.set(r.donorId, idx);
  });
  for (const [donorId, idx] of firstRowIndex) rows[idx].referredBy = referred.get(donorId)!;

  // ---- renumber subscriptions, then assign stable donation ids ----
  const subRemap = new Map<string, string>();
  subs
    .sort((a, b) => a.donorId.localeCompare(b.donorId) || a.startDate.localeCompare(b.startDate))
    .forEach((s, i) => subRemap.set(s.id, `SUB-${String(i + 1).padStart(4, "0")}`));
  for (const r of rows) if (r.subscriptionId) r.subscriptionId = subRemap.get(r.subscriptionId)!;
  for (const s of subs) {
    const finalId = subRemap.get(s.id)!;
    s.status = deriveSubStatus(
      s.endDate,
      rows.filter((r) => r.subscriptionId === finalId),
    );
    s.id = finalId;
  }

  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.donorId.localeCompare(b.donorId) ||
      a.subscriptionId.localeCompare(b.subscriptionId) ||
      a.amountUsd - b.amountUsd,
  );
  const donations = rows.map((r, i) => ({ ...r, id: `DON-${String(i + 1).padStart(6, "0")}` }));

  return { donors, donations, subscriptions: subs, companies: buildCompanies(rng) };
}

function oneTimeRow(rng: Rng, donorId: string, date: string, program: Program): DonationRow {
  return {
    donorId,
    date,
    amountUsd: oneTimeAmount(rng),
    method: rng.weighted(ONE_TIME_METHODS),
    program,
    campaign: "",
    status: "succeeded",
    subscriptionId: "",
    referredBy: "",
  };
}

function pickMany<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  return out;
}

/** ~50 fictional employers (fictional on purpose: no claims about real companies). */
function buildCompanies(rng: Rng): MockData["companies"] {
  const names = [
    "Orinoco Tech", "Andes Energy Partners", "Caribe Logistics", "Avila Software", "Guaire Financial Group",
    "Tepuy Aerospace", "Morrocoy Hospitality", "Roraima Mining", "Libertador Insurance", "Cumbre Pharma",
    "Sabana Foods", "Maracay Motors", "Altamira Consulting", "Lago Telecom", "Paria Shipping",
    "Canaima Outdoor", "Merida Biotech", "Los Roques Travel", "Valencia Steelworks", "Barlovento Cacao",
    "Zulia Petrochemicals", "Margarita Resorts", "Aragua Agritech", "Falcon Wind Energy", "Bolivar Capital",
    "Cordillera Analytics", "Delta Water Systems", "Esequibo Marine", "Fundacion Norte Bank", "Gran Sabana Media",
    "Hato Verde Dairy", "Isla Azul Cruises", "Jirajara Textiles", "Kavanayen Labs", "Llanero Cattle Co",
    "Mirador Health", "Naiguata Robotics", "Oriente Gas", "Pico Naiguata Gear", "Quebrada Seca Brewing",
    "Rio Caroni Power", "Sierra Nevada Coffee", "Tacarigua Cement", "Urbana Real Estate", "Vigia Security",
    "Yaracuy Sugar", "Zamora Legal Partners", "Alfa Medios", "Beta Soluciones", "Gamma Ingenieria",
  ];
  return names.map((name) => {
    const matches = rng.chance(0.6);
    return {
      name,
      matches,
      platform: matches ? rng.weighted([["Double the Donation", 55], ["Benevity", 35], ["Other", 10]] as const) : null,
    };
  });
}

// ---------- CLI ----------

function writeFiles(data: MockData) {
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const donorById = new Map(data.donors.map((d) => [d.id, d]));

  const donationsCsv = Papa.unparse(
    {
      fields: [
        "donation_id", "donor_id", "email", "name", "date", "amount_usd", "method",
        "program", "campaign", "status", "subscription_id", "referred_by",
      ],
      data: data.donations.map((r) => {
        const d = donorById.get(r.donorId)!;
        return [
          r.id, r.donorId, d.email, d.name, r.date, r.amountUsd, r.method,
          r.program, r.campaign, r.status, r.subscriptionId, r.referredBy,
        ];
      }),
    },
    { newline: "\n" },
  );
  const subsCsv = Papa.unparse(
    {
      fields: ["subscription_id", "donor_id", "amount_usd", "frequency", "start_date", "end_date", "status"],
      data: data.subscriptions.map((s) => [
        s.id, s.donorId, s.amountUsd, s.frequency, s.startDate, s.endDate, s.status,
      ]),
    },
    { newline: "\n" },
  );

  writeFileSync(join(dir, "donations.csv"), donationsCsv + "\n");
  writeFileSync(join(dir, "subscriptions.csv"), subsCsv + "\n");
  writeFileSync(join(dir, "companies.json"), JSON.stringify(data.companies, null, 2) + "\n");
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/generate-mock-data.ts");
if (isMain) {
  const data = generateMockData();
  writeFiles(data);
  console.log(
    `Wrote data/donations.csv (${data.donations.length} rows), data/subscriptions.csv (${data.subscriptions.length} rows), ` +
      `data/companies.json (${data.companies.length}) for ${data.donors.length} donors.`,
  );
}
