import { test } from "node:test";
import assert from "node:assert/strict";
import { levelFromWaveform } from "./audio.mjs";

const flat = (v, n = 256) => new Uint8Array(n).fill(v);
const tone = (amp, n = 256) =>
  Uint8Array.from({ length: n }, (_, i) => 128 + Math.round(Math.sin((i / n) * Math.PI * 8) * amp));

test("silence reads zero", () => {
  // 128 is the zero line, not 0 — a buffer of 0s would be full negative swing.
  assert.equal(levelFromWaveform(flat(128)), 0);
});

test("a full-scale signal clamps to 1 rather than overflowing", () => {
  assert.equal(levelFromWaveform(tone(127)), 1);
});

test("louder input reads higher", () => {
  assert.ok(levelFromWaveform(tone(10)) < levelFromWaveform(tone(40)));
});

test("speech-level input lands in a visible middle band", () => {
  // ~0.12 RMS is ordinary speech; it must not read as near-silent.
  const level = levelFromWaveform(tone(22));
  assert.ok(level > 0.2 && level < 0.9, `got ${level}`);
});

test("a constant offset is not mistaken for loudness", () => {
  // A DC-biased buffer has no oscillation; only the deviation counts.
  assert.ok(levelFromWaveform(flat(128)) < 0.01);
});

test("an empty buffer is zero, not NaN", () => {
  assert.equal(levelFromWaveform(new Uint8Array(0)), 0);
  assert.equal(levelFromWaveform(undefined), 0);
});
