// Parsing a WhatsApp `_chat.txt` export into messages, and chunking it for the model.
// Plain .mjs so `node --test` runs the sibling test with no build step.

// iOS:     [07/09/26, 2:14:33 PM] Aryan: text
// Android: 07/09/2026, 14:14 - Aryan: text
const LINE =
  /^\[?(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap]\.?[Mm]\.?)?)\]?\s*(?:-\s*)?([^:\n]{1,64}?):\s?([\s\S]*)$/;

// A dated line that has no "Sender:" is a system notice, not a continuation.
const DATED = /^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}/;

const NOISE = [
  /end-to-end encrypted/i,
  /^<Media omitted>$/i,
  /^image omitted$/i,
  /^video omitted$/i,
  /^sticker omitted$/i,
  /^This message was deleted/i,
  /^You deleted this message/i,
  /^Missed (voice|video) call/i,
  /(created group|added you|joined using this group|left$|changed the subject)/i,
];

/**
 * Which way round the numeric dates are. WhatsApp writes them in the exporting
 * phone's locale, so the file itself is ambiguous: "05/09/26" is 5 Sep to an
 * Indian phone and 9 May to an American one. A component >12 settles it; if
 * nothing in the file exceeds 12 we assume day-first (most of the world).
 * @returns {"DMY" | "MDY"}
 */
export function detectDateOrder(raw) {
  for (const m of raw.matchAll(/^\[?(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4},?\s+\d{1,2}:\d{2}/gm)) {
    if (+m[1] > 12) return "DMY";
    if (+m[2] > 12) return "MDY";
  }
  return "DMY";
}

/** "05/09/26" + "10:04:15 AM" -> "2026-09-05T10:04", so the model never guesses. */
function isoish(date, time, order) {
  const [a, b, y] = date.split(/[/.-]/).map(Number);
  const [day, month] = order === "DMY" ? [a, b] : [b, a];
  const year = y < 100 ? 2000 + y : y;

  const t = time.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([APap])?/);
  if (!t) return null;
  let hour = Number(t[1]);
  if (t[3]) hour = (hour % 12) + (/[Pp]/.test(t[3]) ? 12 : 0);

  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${t[2]}`;
}

/**
 * @returns {{when: string|null, sender: string, text: string}[] | null}
 *   null when the text is not a WhatsApp export.
 */
export function parseWhatsApp(raw) {
  const order = detectDateOrder(raw);
  const lines = raw.split(/\r?\n/);
  const msgs = [];
  let matched = 0;

  for (const line of lines) {
    const m = line.match(LINE);
    if (m) {
      matched++;
      msgs.push({ when: isoish(m[1], m[2], order), sender: m[3].trim(), text: m[4] });
    } else if (DATED.test(line)) {
      matched++; // a system notice: counts as export evidence, but is not a message
    } else if (msgs.length && line.trim()) {
      // continuation of a multi-line message
      msgs[msgs.length - 1].text += "\n" + line;
    }
  }

  // A pasted email or note will match ~nothing. Require a real export.
  if (matched < 3 || matched / lines.filter((l) => l.trim()).length < 0.5) return null;

  return msgs.filter((m) => {
    const t = m.text.trim();
    return t && !NOISE.some((re) => re.test(t));
  });
}

/** Split messages into model-sized batches. */
export function chunk(msgs, size = 150) {
  const out = [];
  for (let i = 0; i < msgs.length; i += size) out.push(msgs.slice(i, i + size));
  return out;
}
