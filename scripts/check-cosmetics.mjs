/**
 * Guard rail: two cosmetics in the same slot must never look identical.
 * Season rewards must not reuse shop art, or the season pass would be
 * advertising something the shop already sells.
 * Run with: bun scripts/check-cosmetics.mjs
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/cosmetics.ts", import.meta.url), "utf8");

function mapOf(name) {
  const start = src.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`missing map ${name}`);
  const body = src.slice(start, src.indexOf("\n};", start));
  const out = {};
  for (const m of body.matchAll(/"([\w-]+)":\s*\n?\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

function duplicates(map) {
  const seen = new Map();
  for (const [slug, art] of Object.entries(map)) {
    const key = art.trim().split(/\s+/).sort().join(" ");
    seen.set(key, [...(seen.get(key) ?? []), slug]);
  }
  return [...seen.entries()].filter(([, slugs]) => slugs.length > 1);
}

let bad = 0;
for (const name of ["NAMETAG_CLASS", "BADGE_GLYPH", "FRAME_CLASS", "BANNER_STYLE", "EFFECT_CLASS"]) {
  for (const [art, slugs] of duplicates(mapOf(name))) {
    bad++;
    console.error(`${name}: ${slugs.join(", ")} all use identical art -> ${art}`);
  }
}
if (bad) {
  console.error(`\n${bad} duplicated cosmetic${bad === 1 ? "" : "s"} found.`);
  process.exit(1);
}
console.log("All cosmetics are visually unique.");
