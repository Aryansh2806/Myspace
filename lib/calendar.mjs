// Scheduling and grouping for the post queue.
// The model never picks dates — it is poor at spreading N items across a range
// and burns output tokens doing it. This code owns the calendar.

import { dayKey, addDays } from "./streak.mjs";

const TZ = "Asia/Kolkata";

/**
 * The instant at `hour` local time on a YYYY-MM-DD day, as an ISO string.
 * Built by measuring the zone's offset at that moment rather than assuming
 * +05:30, so the maths survives being pointed at another timezone.
 */
export function atHour(day, hour = 11, tz = TZ) {
  const naive = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  const asUTC = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  const asTZ = new Date(naive.toLocaleString("en-US", { timeZone: tz }));
  return new Date(naive.getTime() - (asTZ.getTime() - asUTC.getTime())).toISOString();
}

/** Whole days from `start` to `end` inclusive, as day keys. Never empty. */
export function daysBetween(start, end) {
  const from = dayKey(start);
  const to = dayKey(end);
  if (to < from) return [from]; // a backwards range collapses rather than vanishing
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Give every post a scheduled_at. A post carrying `anchor_date` keeps that day
 * — it is pegged to a festival or a launch. The rest spread evenly across the
 * remaining span, endpoints included.
 */
export function spread(posts, { start, end, hour = 11, tz = TZ } = {}) {
  if (!posts?.length) return [];
  const days = daysBetween(start, end);

  const free = posts.filter((p) => !p.anchor_date);
  const step = free.length > 1 ? (days.length - 1) / (free.length - 1) : 0;

  let i = 0;
  return posts.map((p) => {
    if (p.anchor_date) {
      return { ...p, scheduled_at: atHour(p.anchor_date, hour, tz) };
    }
    // Round-robin past the end so more posts than days wraps instead of piling
    // everything onto day one.
    const idx = free.length > days.length ? i % days.length : Math.round(i * step);
    i++;
    return { ...p, scheduled_at: atHour(days[Math.min(idx, days.length - 1)], hour, tz) };
  });
}

/** The Monday on or before a given day key. */
export function weekStart(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // Sunday(0) is 6 days after Monday
  return addDays(day, -back);
}

/**
 * Group posts into Monday-start local weeks. A day with no posts is still
 * emitted — a quiet Wednesday is a visible empty row, not a missing one, the
 * same rule history() follows for its zero bars.
 */
export function weeksOf(posts, tz = TZ) {
  const unscheduled = [];
  const byDay = new Map();
  for (const p of posts ?? []) {
    if (!p.scheduled_at) {
      unscheduled.push(p);
      continue;
    }
    const k = dayKey(p.scheduled_at, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  const weeks = new Map();
  for (const k of [...byDay.keys()].sort()) {
    const ws = weekStart(k);
    weeks.set(ws, (weeks.get(ws) ?? new Set()).add(k));
  }
  return {
    weeks: [...weeks.keys()].sort().map((ws) => ({
      weekStart: ws,
      days: Array.from({ length: 7 }, (_, i) => {
        const day = addDays(ws, i);
        return { day, posts: byDay.get(day) ?? [] };
      }),
    })),
    unscheduled,
  };
}

const STATUS_RANK = { draft: 0, approved: 1, posted: 2 };

/** Unfinished work first, then soonest scheduled, then undated. Non-mutating. */
export function sortQueue(posts) {
  return [...(posts ?? [])].sort((a, b) => {
    const s = (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
    if (s) return s;
    if (!a.scheduled_at && !b.scheduled_at) return 0;
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    return new Date(a.scheduled_at) - new Date(b.scheduled_at);
  });
}
