import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsApp, chunk } from "./whatsapp.mjs";

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
