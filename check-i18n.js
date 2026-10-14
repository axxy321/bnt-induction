// QA check: every t("key") used in apps/web/src must exist in BOTH en and pa blocks of i18n.ts
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "apps/web/src");
const i18n = fs.readFileSync(path.join(src, "i18n.ts"), "utf8");

const enStart = i18n.indexOf("en: {");
const paStart = i18n.indexOf("pa: {");
if (enStart === -1 || paStart === -1) {
  console.error("FAIL: cannot find en/pa blocks in i18n.ts");
  process.exit(1);
}
const enBlock = i18n.slice(enStart, paStart);
const paBlock = i18n.slice(paStart);

const keyRx = /^\s{6}([a-zA-Z0-9_]+):/gm;
const enKeys = new Set([...enBlock.matchAll(keyRx)].map((m) => m[1]));
const paKeys = new Set([...paBlock.matchAll(keyRx)].map((m) => m[1]));

const usedKeys = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(full, "utf8");
      const rx = /\bt\(\s*["']([a-zA-Z0-9_]+)["'][^)]*\)/g;
      for (const m of content.matchAll(rx)) {
        const k = m[1];
        if (!usedKeys.has(k)) usedKeys.set(k, new Set());
        usedKeys.get(k).add(path.relative(src, full));
      }
    }
  }
}
walk(src);

let missing = 0;
for (const [k, files] of [...usedKeys].sort()) {
  const missEn = !enKeys.has(k);
  const missPa = !paKeys.has(k);
  if (missEn || missPa) {
    missing++;
    console.log(`MISSING: "${k}" ${missEn ? "[en]" : ""} ${missPa ? "[pa]" : ""}  used in: ${[...files].join(", ")}`);
  }
}

const unusedEn = [...enKeys].filter((k) => !usedKeys.has(k));
console.log(`Used keys: ${usedKeys.size}`);
console.log(`en keys: ${enKeys.size} | pa keys: ${paKeys.size}`);
console.log(`Missing translations: ${missing}`);
console.log(`Defined but unused (en): ${unusedEn.length}`);
if (unusedEn.length) console.log("  " + unusedEn.join(", "));
process.exit(missing ? 1 : 0);
