// `npm run check:case`: Windows and macOS ignore the capitalization of file names, Linux (where this will be
// hosted) does not. This finds every import (and every /brand/... image reference) whose file exists only with
// different capitalization: it works on this machine and breaks the build on the server.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = process.cwd();
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", ".json", ".css", "/index.ts", "/index.tsx", "/index.js"];

/** True if every segment of the path exists with exactly this capitalization. */
function existsExact(path) {
  const parts = relative(root, path).split(sep);
  let current = root;
  for (const part of parts) {
    if (!existsSync(current) || !readdirSync(current).includes(part)) return false;
    current = join(current, part);
  }
  return existsSync(current) && statSync(current).isFile();
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx|mjs)$/.test(name) ? [path] : [];
  });
}

const problems = [];
let checked = 0;

for (const file of [...walk(join(root, "src")), ...walk(join(root, "scripts")), ...walk(join(root, "prisma"))]) {
  const text = readFileSync(file, "utf8");
  const specifiers = [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
  for (const spec of specifiers) {
    let base;
    if (spec.startsWith("@/")) base = join(root, "src", spec.slice(2));
    else if (spec.startsWith(".")) base = resolve(dirname(file), spec);
    else continue; // a package
    checked++;
    const candidates = EXTENSIONS.map((ext) => base + ext);
    if (candidates.some(existsExact)) continue;
    if (candidates.some((c) => existsSync(c) && statSync(c).isFile())) {
      problems.push(`${relative(root, file)}: "${spec}" exists only with different capitalization`);
    } else if (!spec.includes("${") && !spec.endsWith(".json")) {
      // Not found at all (a dynamic path or a generated file): report only if it is a plain source import.
      if (!candidates.some((c) => existsSync(c))) problems.push(`${relative(root, file)}: "${spec}" does not resolve`);
    }
  }
  for (const m of text.matchAll(/["'`](\/brand\/[^"'`]+)["'`]/g)) {
    checked++;
    if (!existsExact(join(root, "public", m[1]))) problems.push(`${relative(root, file)}: ${m[1]} not found in public/ with this capitalization`);
  }
}

console.log(`Checked ${checked} imports and image references.`);
if (problems.length) {
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log("OK: every import matches its file name exactly, so a Linux server will find them.");
