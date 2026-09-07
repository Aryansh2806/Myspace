// Guards the palette in app/globals.css. Change a token, this tells you if it
// stopped being readable — in either theme. The old design shipped a delete
// button at 1.92:1 and completed-task text at 2.32:1; this is why.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function tokens(startMarker) {
  const from = css.indexOf(startMarker);
  assert.notEqual(from, -1, `missing block: ${startMarker}`);
  const block = css.slice(from, css.indexOf("}", from));
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  for (const m of block.matchAll(/--([\w-]+):\s*rgba\(([^)]+)\)/gi)) {
    const [r, g, b, a] = m[2].split(",").map((n) => parseFloat(n));
    out[m[1]] = { r, g, b, a };
  }
  for (const m of block.matchAll(/--([\w-]+):\s*(0?\.\d+|\d+(?:\.\d+)?)\s*;/gi)) {
    if (!(m[1] in out)) out[m[1]] = parseFloat(m[2]);
  }
  return out;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = ([r, g, b]) =>
  "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");

/** Paint `over` (rgba object, or a hex at `alpha`) onto solid `base`. */
function composite(over, base, alpha) {
  const b = rgb(base);
  const o = typeof over === "string" ? rgb(over) : [over.r, over.g, over.b];
  const a = typeof over === "string" ? alpha : over.a;
  return hex(o.map((c, i) => c * a + b[i] * (1 - a)));
}

const luminance = (hex) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum]. 4.5 for body text, 3.0 for UI chrome
// and large text, per WCAG 2.1 AA (1.4.3 / 1.4.11).
const PAIRS = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["muted", "bg", 4.5],
  ["muted", "surface", 4.5],
  ["muted", "sunk", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "danger-bg", 4.5],
  ["warn", "surface", 4.5],
  ["warn", "warn-bg", 4.5],
  ["ok", "surface", 4.5],
  ["line", "surface", 1.4], // a divider only needs to be visible, not readable
  ["on-accent", "accent", 4.5],
];

for (const [theme, marker] of [
  ["light", ":root {"],
  ["dark", ':root[data-theme="dark"] {'],
]) {
  const t = tokens(marker);
  test(`${theme} theme meets contrast minimums`, () => {
    const failures = [];
    for (const [fg, bg, min] of PAIRS) {
      assert.ok(t[fg], `${theme}: --${fg} is not defined`);
      assert.ok(t[bg], `${theme}: --${bg} is not defined`);
      const r = ratio(t[fg], t[bg]);
      if (r < min) failures.push(`--${fg} on --${bg} = ${r.toFixed(2)}:1 (need ${min})`);
    }
    assert.deepEqual(failures, []);
  });
}

test("both themes define the same tokens", () => {
  assert.deepEqual(
    Object.keys(tokens(":root {")).sort(),
    Object.keys(tokens(':root[data-theme="dark"] {')).sort(),
  );
});


/* ---------- glass ----------
   Translucent chrome only works if text still reads through it. The worst case
   is not glass over the plain ground — it is glass over an aurora blob at full
   strength, which is what sits behind the cards. */
for (const [theme, marker] of [
  ["light", ":root {"],
  ["dark", ':root[data-theme="dark"] {'],
]) {
  const t = tokens(marker);
  test(`${theme}: text reads through glass over every aurora colour`, () => {
    const failures = [];
    for (const blob of ["aurora-a", "aurora-b", "aurora-c"]) {
      const lit = composite(t[blob], t.bg, t["aurora-op"]);   // aurora over ground
      const surface = composite(t.glass, lit);                // glass over that
      for (const [fg, min] of [["text", 4.5], ["muted", 4.5], ["accent", 3], ["danger", 3]]) {
        const r = ratio(t[fg], surface);
        if (r < min) failures.push(`--${fg} on glass over --${blob} = ${r.toFixed(2)}:1 (need ${min})`);
      }
    }
    assert.deepEqual(failures, []);
  });

  test(`${theme}: the aurora never overwhelms the plain ground`, () => {
    for (const blob of ["aurora-a", "aurora-b", "aurora-c"]) {
      const lit = composite(t[blob], t.bg, t["aurora-op"]);
      // Body text sits directly on the ground in places (headings, hints).
      assert.ok(ratio(t.muted, lit) >= 4.5,
        `--muted on --${blob} over ground = ${ratio(t.muted, lit).toFixed(2)}:1`);
    }
  });
}
