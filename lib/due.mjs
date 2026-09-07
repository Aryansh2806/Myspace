// Which open tasks are due by a given cutoff. Shared by the browser notifier
// (cutoff = now + 2h) and the morning digest (cutoff = end of today, IST).

/**
 * @param {{status: string, due_at: string|null}[]} tasks
 * @param {Date|string|number} cutoff
 */
export function selectDue(tasks, cutoff) {
  const c = new Date(cutoff).getTime();
  return tasks
    .filter((t) => t.status === "open" && t.due_at && new Date(t.due_at).getTime() <= c)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
}

/** End of the current day in a timezone, as a Date. */
export function endOfDay(now = new Date(), tz = "Asia/Kolkata") {
  // en-CA gives YYYY-MM-DD, so no locale date-order guessing.
  const ymd = now.toLocaleDateString("en-CA", { timeZone: tz });
  // Offset of that tz right now, derived by comparing the same instant both ways.
  const asUTC = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const asTZ = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const offsetMs = asTZ.getTime() - asUTC.getTime();
  return new Date(new Date(`${ymd}T23:59:59.999Z`).getTime() - offsetMs);
}
