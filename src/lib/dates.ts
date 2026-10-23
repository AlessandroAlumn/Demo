// ISO-date helpers ("YYYY-MM-DD" and "YYYY-MM" strings, UTC). Shared by the engine and the
// mock-data scripts. No function here reads the real clock.

const pad = (n: number) => String(n).padStart(2, "0");

export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Whole days from a to b (negative if b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Adds `n` months, keeping `day` (default: the date's own day) clamped to the month length. */
export function addMonths(s: string, n: number, day?: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(day ?? d, daysInMonth(ny, nm)))}`;
}

/** "2026-08-14" -> "2026-08" */
export const monthKey = (date: string) => date.slice(0, 7);

/** "2026-08" + n months -> "2026-07" etc. */
export function addMonthKey(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export const firstDayOfMonth = (ym: string) => `${ym}-01`;

export function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${pad(daysInMonth(y, m))}`;
}

/** ISO week key "2026-W31" (Monday-Sunday weeks), for Donor of the Week. */
export function isoWeekKey(date: string): string {
  const d = toDate(date);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week decides the year
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${pad(week)}`;
}

/** Monday and Sunday of an ISO week key ("2026-W30" -> 2026-07-20 .. 2026-07-26), or null if malformed. */
export function isoWeekRange(key: string): { from: string; to: string } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const jan4 = toDate(`${m[1]}-01-04`);
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const from = new Date(mondayOfWeek1);
  from.setUTCDate(mondayOfWeek1.getUTCDate() + (Number(m[2]) - 1) * 7);
  return { from: toIso(from), to: addDays(toIso(from), 6) };
}
