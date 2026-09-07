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

/**
 * Current time as an unambiguous label for the prompt.
 * Never use a numeric locale date here: "7/9/2026" reads as DD/MM to us and
 * M/D to the model, which silently shifts every extracted due date.
 * The weekday matters too — "by Friday" can't be resolved without it.
 */
export function nowLabel(now = new Date(), tz = "Asia/Kolkata") {
  return now.toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** High first, then soonest due, then undated. Ties keep insertion order. */
export const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const p = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    if (p) return p;
    // A task with a deadline outranks one without, whatever the date.
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at) - new Date(b.due_at);
  });
}

/** normal -> high -> low -> normal */
export function nextPriority(p) {
  return p === "high" ? "low" : p === "low" ? "normal" : "high";
}
