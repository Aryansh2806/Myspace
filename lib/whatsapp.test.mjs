import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsApp, chunk, detectDateOrder } from "./whatsapp.mjs";

const ios = `[07/09/26, 2:14:33 PM] Aryan: Hi
[07/09/26, 2:15:01 PM] Rahul Sharma: Need the logo files by Friday
[07/09/26, 2:15:40 PM] Rahul Sharma: <Media omitted>
[07/09/26, 2:16:00 PM] Aryan: also send
the invoice`;

const android = `07/09/2026, 14:14 - Aryan: Hi
07/09/2026, 14:15 - Rahul: Need the logo files by Friday
07/09/2026, 14:16 - Aryan: ok
07/09/2026, 14:17 - Messages and calls are end-to-end encrypted.`;

test("parses iOS export, keeps sender, drops media noise", () => {
  const m = parseWhatsApp(ios);
  assert.equal(m.length, 3);
  assert.equal(m[1].sender, "Rahul Sharma");
  assert.equal(m[1].text, "Need the logo files by Friday");
});

test("joins continuation lines into the previous message", () => {
  const m = parseWhatsApp(ios);
  assert.equal(m[2].text, "also send\nthe invoice");
});

test("parses Android export and drops the encryption notice", () => {
  const m = parseWhatsApp(android);
  assert.equal(m.length, 3);
  assert.equal(m[0].sender, "Aryan");
});

test("returns null for a pasted email — not an export", () => {
  assert.equal(
    parseWhatsApp("Hi Aryan,\n\nCan you send the deck by 15th?\n\nThanks\nPriya"),
    null,
  );
});

test("returns null for a single stray timestamped line", () => {
  assert.equal(parseWhatsApp("[07/09/26, 2:14:33 PM] Aryan: hi"), null);
});

test("chunk splits and keeps every message", () => {
  const msgs = Array.from({ length: 350 }, (_, i) => ({ sender: "a", text: String(i) }));
  const c = chunk(msgs, 150);
  assert.deepEqual(c.map((x) => x.length), [150, 150, 50]);
});

test("stamps each message with an unambiguous ISO-ish timestamp", () => {
  const m = parseWhatsApp(ios);
  assert.equal(m[0].when, "2026-09-07T14:14"); // 2:14 PM, day-first
});

test("detects month-first exports from a day component over 12", () => {
  assert.equal(detectDateOrder("[09/25/26, 2:14:33 PM] A: x"), "MDY");
  assert.equal(detectDateOrder("[25/09/26, 2:14:33 PM] A: x"), "DMY");
  assert.equal(detectDateOrder("[05/09/26, 2:14:33 PM] A: x"), "DMY"); // ambiguous -> day-first
});

test("month-first export resolves to the same calendar day", () => {
  const m = parseWhatsApp(`[09/25/26, 9:00:00 AM] A: one
[09/26/26, 9:00:00 AM] A: two
[09/27/26, 9:00:00 AM] A: three`);
  assert.equal(m[0].when, "2026-09-25T09:00");
});

test("midnight and noon do not collide in 12-hour exports", () => {
  const m = parseWhatsApp(`[07/09/26, 12:30:00 AM] A: midnight
[07/09/26, 12:30:00 PM] A: noon
[07/09/26, 1:00:00 PM] A: one`);
  assert.deepEqual(m.map((x) => x.when), [
    "2026-09-07T00:30",
    "2026-09-07T12:30",
    "2026-09-07T13:00",
  ]);
});
