// Static i18n check: every translation key the code uses must exist in BOTH message catalogs, and the two
// catalogs must have the same keys. It finds `getTranslations("Ns")` / `useTranslations("Ns")` bindings,
// then every `name("key")` / name(`prefix.${x}`) call on them.
//
//   - a literal key must exist as a message (leaf);
//   - a key with ${...} must at least have an existing group in front of it (e.g. `columns.${c}`);
//   - a namespace must exist.
//
// It cannot follow keys built entirely at run time; those are covered by the rendering tests.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type I18nProblem = { file: string; line: number; message: string };
export type I18nReport = {
  problems: I18nProblem[];
  checkedCalls: number;
  filesScanned: number;
  /** Messages never referenced by a literal or prefixed call (informational: many are used dynamically). */
  unusedKeys: string[];
};

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`)));
}

function groups(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [] : [`${prefix}${k}`, ...groups(v, `${prefix}${k}.`)]));
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Splits `a, b(c, d), e` at the commas that are not inside brackets. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

const TRANSLATOR_CALL = /(?:getTranslations|useTranslations)\(\s*(?:\{[^}]*?namespace:\s*)?["']([\w.]+)["']/;

/** Files where the translator arrives through a parameter instead of getTranslations(...). */
const OVERRIDES: Record<string, Record<string, string>> = {
  "src/lib/render-notification.ts": { t: "Notifications" },
};

export function checkI18n(root: string): I18nReport {
  const en = JSON.parse(readFileSync(join(root, "messages/en.json"), "utf8")) as Tree;
  const es = JSON.parse(readFileSync(join(root, "messages/es.json"), "utf8")) as Tree;
  const enLeaves = new Set(leaves(en));
  const esLeaves = new Set(leaves(es));
  const enGroups = new Set(groups(en));
  const esGroups = new Set(groups(es));
  const problems: I18nProblem[] = [];
  const used = new Set<string>();
  const usedPrefixes = new Set<string>();
  let checkedCalls = 0;

  for (const key of enLeaves) if (!esLeaves.has(key)) problems.push({ file: "messages/es.json", line: 0, message: `missing in Spanish: ${key}` });
  for (const key of esLeaves) if (!enLeaves.has(key)) problems.push({ file: "messages/en.json", line: 0, message: `missing in English: ${key}` });

  const files = walk(join(root, "src"));
  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    const bindings = new Map<string, string>(Object.entries(OVERRIDES[rel] ?? {}));
    const lineOf = (index: number) => text.slice(0, index).split("\n").length;

    // const t = await getTranslations("Ns")  /  const t = (await getTranslations({ locale, namespace: "Ns" })) as ...
    for (const m of text.matchAll(/const (\w+) = \(?(?:await )?(?:getTranslations|useTranslations)\(/g)) {
      const ns = TRANSLATOR_CALL.exec(text.slice(m.index!, m.index! + 200));
      bindings.set(m[1], ns ? ns[1] : "");
    }
    // const [t, tX] = await Promise.all([getTranslations("A"), getTranslations("B")])
    for (const m of text.matchAll(/const \[([^\]]+)\] = await Promise\.all\(\[/g)) {
      const start = m.index! + m[0].length;
      let depth = 1;
      let end = start;
      while (end < text.length && depth > 0) {
        if ("([{".includes(text[end])) depth++;
        if (")]}".includes(text[end])) depth--;
        end++;
      }
      const elements = splitTopLevel(text.slice(start, end - 1));
      const names = m[1].split(",").map((n) => n.trim());
      names.forEach((name, i) => {
        const ns = elements[i] ? TRANSLATOR_CALL.exec(elements[i]) : null;
        if (ns) bindings.set(name, ns[1]);
      });
    }

    // namespaces must exist
    for (const m of text.matchAll(/(?:getTranslations|useTranslations)\(\s*(?:\{[^}]*?namespace:\s*)?["']([\w.]+)["']/g)) {
      const ns = m[1];
      if (!enGroups.has(ns) || !esGroups.has(ns)) problems.push({ file: rel, line: lineOf(m.index!), message: `unknown namespace "${ns}"` });
      usedPrefixes.add(`${ns}.`);
    }

    for (const [name, ns] of bindings) {
      const call = new RegExp(`(?<![\\w.])${name}\\(\\s*(["'\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "g");
      for (const m of text.matchAll(call)) {
        checkedCalls++;
        const raw = m[2];
        const full = (key: string) => (ns ? `${ns}.${key}` : key);
        if (raw.includes("${")) {
          const prefix = raw.slice(0, raw.indexOf("${"));
          usedPrefixes.add(full(prefix));
          if (prefix.endsWith(".")) {
            // `columns.${c}`: the group "columns" must exist in both catalogs
            const group = full(prefix.slice(0, -1));
            if (!enGroups.has(group) || !esGroups.has(group)) {
              problems.push({ file: rel, line: lineOf(m.index!), message: `no message group "${group}" for \`${raw}\`` });
            }
          } else if (prefix) {
            // `preview${lang}`: some message must start with "preview"
            const start = full(prefix);
            if (![...enLeaves].some((k) => k.startsWith(start)) || ![...esLeaves].some((k) => k.startsWith(start))) {
              problems.push({ file: rel, line: lineOf(m.index!), message: `no message starts with "${start}" for \`${raw}\`` });
            }
          }
        } else {
          const key = full(raw);
          used.add(key);
          if (!enLeaves.has(key)) problems.push({ file: rel, line: lineOf(m.index!), message: `missing in English: ${key}` });
          if (!esLeaves.has(key)) problems.push({ file: rel, line: lineOf(m.index!), message: `missing in Spanish: ${key}` });
        }
      }
    }
  }

  const unusedKeys = [...enLeaves].filter(
    (key) => !used.has(key) && ![...usedPrefixes].some((p) => key.startsWith(p) && p.endsWith(".") && (p.split(".").length > 2 || p.length > 0)),
  );
  return { problems, checkedCalls, filesScanned: files.length, unusedKeys };
}
