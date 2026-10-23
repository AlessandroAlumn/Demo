import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkI18n } from "./lib/i18n-check";

const dir = mkdtempSync(join(tmpdir(), "alumnusb-i18n-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function project(files: Record<string, string>, en: object, es: object) {
  const root = mkdtempSync(join(dir, "p-"));
  mkdirSync(join(root, "messages"), { recursive: true });
  writeFileSync(join(root, "messages/en.json"), JSON.stringify(en));
  writeFileSync(join(root, "messages/es.json"), JSON.stringify(es));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(root, "src", name.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(join(root, "src", name), content);
  }
  return root;
}

const messages = { Page: { title: "Hi", columns: { a: "A", b: "B" }, previewEs: "x", previewEn: "y" }, Other: { ok: "ok" } };

describe("checkI18n", () => {
  it("passes for the real project: every key the code uses exists in English and Spanish", () => {
    const report = checkI18n(process.cwd());
    expect(report.problems).toEqual([]);
    expect(report.checkedCalls).toBeGreaterThan(300);
  });

  it("accepts correct literal, grouped and partial dynamic keys", () => {
    const root = project(
      {
        "a.tsx": `
          const t = await getTranslations("Page");
          const c = t("title");
          const d = t(\`columns.\${x}\`);
          const e = t(\`preview\${lang}\`);
        `,
      },
      messages,
      messages,
    );
    expect(checkI18n(root).problems).toEqual([]);
  });

  it("finds a key that does not exist, a missing Spanish text and an unknown namespace", () => {
    const es = { Page: { title: "Hola", columns: { a: "A", b: "B" }, previewEs: "x", previewEn: "y" }, Other: {} };
    const root = project(
      {
        "a.tsx": `
          const t = await getTranslations("Page");
          t("titel");
          const o = await getTranslations("Other");
          o("ok");
          const bad = await getTranslations("Nope");
        `,
      },
      messages,
      es,
    );
    const text = checkI18n(root).problems.map((p) => p.message).join("\n");
    expect(text).toContain("missing in English: Page.titel");
    expect(text).toContain("missing in Spanish: Other.ok");
    expect(text).toContain('unknown namespace "Nope"');
  });

  it("finds a dynamic key whose group or prefix does not exist", () => {
    const root = project(
      { "a.tsx": `const t = await getTranslations("Page"); t(\`rows.\${i}\`); t(\`nothing\${i}\`);` },
      messages,
      messages,
    );
    const text = checkI18n(root).problems.map((p) => p.message).join("\n");
    expect(text).toContain('no message group "Page.rows"');
    expect(text).toContain('no message starts with "Page.nothing"');
  });

  it("follows translators created in a Promise.all and passed with a locale object", () => {
    const root = project(
      {
        "a.tsx": `
          const [t, o] = await Promise.all([getTranslations({ locale, namespace: "Page" }), getTranslations("Other")]);
          t("title"); o("ok"); o("missing");
        `,
      },
      messages,
      messages,
    );
    expect(checkI18n(root).problems.map((p) => p.message)).toEqual(["missing in English: Other.missing", "missing in Spanish: Other.missing"]);
  });

  it("reports when the two catalogs differ", () => {
    const root = project({ "a.tsx": "export {}" }, messages, { Page: { title: "Hola" } });
    const text = checkI18n(root).problems.map((p) => p.message).join("\n");
    expect(text).toContain("missing in Spanish: Page.columns.a");
  });

  it("reports the line of a problem", () => {
    const root = project({ "a.tsx": `const t = await getTranslations("Page");\n\n\nt("nope");` }, messages, messages);
    expect(checkI18n(root).problems.find((p) => p.message.includes("Page.nope"))?.line).toBe(4);
  });
});
