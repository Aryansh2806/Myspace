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
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
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
