// Locale-aware formatting for money, numbers and (UTC) dates.
//
// Spanish uses the US-Spanish conventions ($1,250.50, 20 ago 2026): the platform is in dollars and many
// donors are Spanish speakers living in the US. Whole amounts drop the decimals ("$12", not "$12.00").
// Dates are plain ISO strings from the simulated clock, always formatted in UTC so they never shift.

const TAGS: Record<string, string> = { es: "es-US", en: "en-US" };

export type Formatters = ReturnType<typeof makeFormatters>;

export function makeFormatters(locale: string) {
  const tag = TAGS[locale] ?? "en-US";
  const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

  const money = (amount: number) =>
    new Intl.NumberFormat(tag, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  const number = (n: number) => new Intl.NumberFormat(tag).format(n);
  /** "2026-08-20" -> "Aug 20, 2026" / "20 ago 2026" */
  const date = (iso: string) => new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeZone: "UTC" }).format(utc(iso));
  /** "2026-08" -> "August 2026" / "agosto de 2026" */
  const month = (ym: string) =>
    new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(`${ym}-01`));
  return { money, number, date, month };
}
