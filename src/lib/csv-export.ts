import Papa from "papaparse";

/**
 * Spreadsheet programs run cells that start with = + - @ as formulas. Donor names and emails come from
 * outside, so such cells are prefixed with an apostrophe in exports.
 */
export const safeCell = (value: unknown): string | number => {
  if (typeof value === "number") return value;
  const text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  return (
    Papa.unparse(
      { fields: columns, data: rows.map((r) => columns.map((c) => safeCell(r[c]))) },
      { newline: "\n" },
    ) + "\n"
  );
}
