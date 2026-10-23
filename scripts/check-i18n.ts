// `npm run check:i18n`: fails if the code uses a translation key that is missing in English or Spanish,
// or if the two message catalogs differ.

import { checkI18n } from "./lib/i18n-check";

const report = checkI18n(process.cwd());
console.log(`Scanned ${report.filesScanned} files, checked ${report.checkedCalls} translation calls.`);

if (report.problems.length > 0) {
  for (const p of report.problems) console.error(`  ${p.file}${p.line ? `:${p.line}` : ""}  ${p.message}`);
  console.error(`\n${report.problems.length} i18n problem(s).`);
  process.exitCode = 1;
} else {
  console.log("OK: every key the code uses exists in English and Spanish, and the catalogs match.");
}
if (process.argv.includes("--unused") && report.unusedKeys.length) {
  console.log(`\n${report.unusedKeys.length} message(s) not referenced by a literal key (may be used dynamically):`);
  for (const key of report.unusedKeys) console.log(`  ${key}`);
}
