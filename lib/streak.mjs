// Streak and completion history. All of it hinges on which LOCAL day a
// completion falls in — a task finished at 01:00 IST is 19:30 UTC the previous
// day, so grouping by UTC date would put it on the wrong day and silently
// break the streak.

const TZ = "Asia/Kolkata";

/** The local calendar day a timestamp belongs to, as YYYY-MM-DD. */
export function dayKey(iso, tz = TZ) {
  // en-CA formats as YYYY-MM-DD, so there is no locale date-order guessing.
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
}

/** Shift a day key by n days. Works on the key itself, so no DST drift. */
export function addDays(key, n) {
  const d = new Date(key + "T12:00:00Z"); // midday avoids any boundary case
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** How many completions fell on each local day. */
export function completionsByDay(tasks, tz = TZ) {
  const counts = new Map();
  for (const t of tasks) {
    if (t.status !== "done" || !t.done_at) continue;
    const k = dayKey(t.done_at, tz);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/**
 * Consecutive days ending today. Today counts once you ship something; until
 * then the streak is measured to yesterday, so an unfinished morning does not
 * show yesterday's work already lost.
 */
export function streakLength(tasks, now = new Date(), tz = TZ) {
  const counts = completionsByDay(tasks, tz);
  if (!counts.size) return 0;

  const today = dayKey(now, tz);
  let cursor = counts.has(today) ? today : addDays(today, -1);
  if (!counts.has(cursor)) return 0;

  let n = 0;
  while (counts.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Completions for the last `days` local days, oldest first. */
export function history(tasks, now = new Date(), days = 7, tz = TZ) {
  const counts = completionsByDay(tasks, tz);
  const today = dayKey(now, tz);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(today, -i);
    out.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return out;
}
