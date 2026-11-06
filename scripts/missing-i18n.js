#!/usr/bin/env node
/**
 * Lists the French strings passed to t("...") / tr("...") (and the label fields of a few
 * constant tables) in the given files that have no translation yet for EN, DE or ES.
 * Usage: node scripts/missing-i18n.js src/app/login.tsx src/components ...
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
function load(file, name) {
  const src = fs.readFileSync(path.join(root, "src/i18n", file), "utf8");
  const out = {};
  const re = new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`);
  const m = src.match(re);
  if (m) Object.assign(out, new Function(`return (${m[1]});`)());
  return out;
}
const dicts = {
  en: { ...load("base/en.ts", "BASE_EN"), ...load("foundation.ts", "FOUNDATION_EN"), ...load("screens.ts", "SCREENS_EN") },
  de: { ...load("base/de.ts", "BASE_DE"), ...load("foundation.ts", "FOUNDATION_DE"), ...load("screens.ts", "SCREENS_DE") },
  es: { ...load("base/es.ts", "BASE_ES"), ...load("foundation.ts", "FOUNDATION_ES"), ...load("screens.ts", "SCREENS_ES") },
};

function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).flatMap((f) => walk(path.join(p, f)));
  return /\.(tsx?|js)$/.test(p) ? [p] : [];
}
const files = process.argv.slice(2).flatMap((p) => walk(path.resolve(p)));
const strings = new Set();
const patterns = [/\btr?\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g, /\blabel:\s*"((?:[^"\\]|\\.)*)"/g];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const re of patterns) for (const m of src.matchAll(re)) strings.add(JSON.parse(`"${m[1]}"`));
}
const missing = [...strings].filter((s) => !dicts.en[s] || !dicts.de[s] || !dicts.es[s]);
for (const s of missing) {
  const langs = ["en", "de", "es"].filter((l) => !dicts[l][s]).join(",");
  console.log(`${JSON.stringify(s)}  [missing: ${langs}]`);
}
console.error(`${missing.length} missing / ${strings.size} strings`);
