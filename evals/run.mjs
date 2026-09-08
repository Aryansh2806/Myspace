// Compare prompt variants on a fixed set of brands.
//   node evals/run.mjs                      -> baseline vs objective
//   node evals/run.mjs baseline             -> one variant only
// Every run spends real money. ~6 posts x 3 brands x N variants, plus judging.

import { BRANDS, OBJECTIVES } from "./fixtures.mjs";
import { generate, VARIANTS } from "./generate.mjs";
import { judge, score } from "./judge.mjs";

const variants = process.argv.slice(2).filter((a) => a in VARIANTS);
const run = variants.length ? variants : Object.keys(VARIANTS);
const PER_BRAND = 6;

console.log(`variants: ${run.join(", ")}  |  brands: ${BRANDS.length}  |  ${PER_BRAND} posts each\n`);

const table = {};
for (const variant of run) {
  const verdicts = [];
  for (const brand of BRANDS) {
    const objective = OBJECTIVES[brand.key];
    process.stdout.write(`  ${variant.padEnd(10)} ${brand.name.padEnd(22)} generating…`);
    const posts = await generate(variant, brand, objective, PER_BRAND);
    process.stdout.write(` judging ${posts.length}…`);
    const vs = await Promise.all(posts.map((p) => judge(brand, objective, p)));
    verdicts.push(...vs.filter(Boolean));
    const s = score(vs.filter(Boolean));
    console.log(` would-post ${s.wouldPost}%`);
  }
  table[variant] = score(verdicts);
}

const cols = ["n", "wouldPost", "usesBrandFact", "servesPillar", "hookWorks", "servesObjective", "fillerPerPost"];
console.log("\n" + "variant".padEnd(12) + cols.map((c) => c.padStart(16)).join(""));
for (const [v, s] of Object.entries(table)) {
  console.log(v.padEnd(12) + cols.map((c) => String(s[c]).padStart(16)).join(""));
}
console.log("\nwouldPost is the number that matters. The rest explain why it moved.");
