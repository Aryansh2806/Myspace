import { test } from "node:test";
import assert from "node:assert/strict";
import { atHour, daysBetween, spread, weekStart, weeksOf, sortQueue } from "./calendar.mjs";
import { dayKey } from "./streak.mjs";

const p = (n, extra = {}) => ({ id: String(n), ...extra });
const keys = (out) => out.map((x) => dayKey(x.scheduled_at));

// --- atHour: the bug class lib/streak.mjs exists to warn about ---

test("11:00 IST lands on the intended IST day", () => {
  const iso = atHour("2026-09-08", 11);
  assert.equal(dayKey(iso), "2026-09-08");
  assert.equal(iso, "2026-09-08T05:30:00.000Z"); // 11:00 IST is 05:30Z
});

test("23:00 IST is still that IST day, though it is 17:30Z", () => {
  const iso = atHour("2026-09-08", 23);
  assert.equal(iso, "2026-09-08T17:30:00.000Z");
  assert.equal(dayKey(iso), "2026-09-08");
});

test("00:30 IST is the previous day in UTC but the right day locally", () => {
  const iso = atHour("2026-09-08", 0);
  assert.ok(iso.startsWith("2026-09-07T18:30"), `got ${iso}`);
  assert.equal(dayKey(iso), "2026-09-08");
});

// --- daysBetween ---

test("an inclusive range spans both endpoints", () => {
  assert.deepEqual(daysBetween("2026-09-07", "2026-09-10"), [
    "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
  ]);
});

test("a backwards range collapses to the start rather than vanishing", () => {
  assert.deepEqual(daysBetween("2026-09-10", "2026-09-07"), ["2026-09-10"]);
});

test("a range crossing a month boundary is continuous", () => {
  const d = daysBetween("2026-08-30", "2026-09-02");
  assert.deepEqual(d, ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
});

// --- spread ---

test("no posts is an empty list, not a throw", () => {
  assert.deepEqual(spread([], { start: "2026-09-07", end: "2026-09-14" }), []);
});

test("a single-day range puts every post on that day", () => {
  const out = spread([p(1), p(2), p(3), p(4), p(5)], { start: "2026-09-07", end: "2026-09-07" });
  assert.equal(out.length, 5);
  assert.deepEqual(new Set(keys(out)), new Set(["2026-09-07"]));
});

test("more posts than days wraps instead of piling onto day one", () => {
  const out = spread(Array.from({ length: 10 }, (_, i) => p(i)), {
    start: "2026-09-07", end: "2026-09-09",
  });
  const counts = {};
  for (const k of keys(out)) counts[k] = (counts[k] ?? 0) + 1;
  assert.deepEqual(Object.keys(counts).sort(), ["2026-09-07", "2026-09-08", "2026-09-09"]);
  assert.deepEqual(Object.values(counts).sort(), [3, 3, 4]);
});

test("fewer posts than days uses both endpoints, not just the front", () => {
  const out = spread([p(1), p(2), p(3)], { start: "2026-09-01", end: "2026-09-30" });
  const k = keys(out);
  assert.equal(k[0], "2026-09-01");
  assert.equal(k[2], "2026-09-30");
  assert.ok(k[1] > k[0] && k[1] < k[2], `middle ${k[1]} should sit between`);
});

test("a single post lands on the start, not somewhere arbitrary", () => {
  assert.deepEqual(keys(spread([p(1)], { start: "2026-09-07", end: "2026-09-30" })), ["2026-09-07"]);
});

test("an anchored post keeps its date and the rest spread around it", () => {
  const out = spread([p(1), p(2, { anchor_date: "2026-10-20" }), p(3)], {
    start: "2026-09-07", end: "2026-09-09",
  });
  assert.equal(dayKey(out[1].scheduled_at), "2026-10-20", "the festival date must survive");
  assert.equal(dayKey(out[0].scheduled_at), "2026-09-07");
  assert.equal(dayKey(out[2].scheduled_at), "2026-09-09");
});

test("spread does not mutate its input", () => {
  const input = [p(1)];
  spread(input, { start: "2026-09-07", end: "2026-09-08" });
  assert.equal(input[0].scheduled_at, undefined);
});

// --- weekStart / weeksOf ---

test("a Sunday belongs to the previous Monday's week", () => {
  // 2026-09-13 is a Sunday; its week begins Monday the 7th.
  assert.equal(weekStart("2026-09-13"), "2026-09-07");
  assert.equal(weekStart("2026-09-07"), "2026-09-07"); // a Monday is its own start
});

test("weeks carry all seven days, including quiet ones", () => {
  const { weeks } = weeksOf([{ scheduled_at: atHour("2026-09-09", 11) }]);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].weekStart, "2026-09-07");
  assert.equal(weeks[0].days.length, 7);
  const wed = weeks[0].days.find((d) => d.day === "2026-09-09");
  assert.equal(wed.posts.length, 1);
  assert.equal(weeks[0].days.find((d) => d.day === "2026-09-10").posts.length, 0);
});

test("a post just after IST midnight groups with that IST day", () => {
  const { weeks } = weeksOf([{ scheduled_at: "2026-09-07T19:00:00.000Z" }]); // 00:30 IST on the 8th
  const day = weeks[0].days.find((d) => d.posts.length);
  assert.equal(day.day, "2026-09-08");
});

test("undated posts are set aside, never dropped", () => {
  const input = [
    { id: "a", scheduled_at: atHour("2026-09-09", 11) },
    { id: "b", scheduled_at: null },
    { id: "c" },
  ];
  const { weeks, unscheduled } = weeksOf(input);
  const inWeeks = weeks.flatMap((w) => w.days.flatMap((d) => d.posts)).length;
  assert.equal(unscheduled.length, 2);
  assert.equal(inWeeks + unscheduled.length, input.length, "count in must equal count out");
});

test("no posts gives no weeks", () => {
  assert.deepEqual(weeksOf([]), { weeks: [], unscheduled: [] });
  assert.deepEqual(weeksOf(undefined), { weeks: [], unscheduled: [] });
});

test("posts in different weeks produce separate weeks, in order", () => {
  const { weeks } = weeksOf([
    { scheduled_at: atHour("2026-09-16", 11) },
    { scheduled_at: atHour("2026-09-08", 11) },
  ]);
  assert.deepEqual(weeks.map((w) => w.weekStart), ["2026-09-07", "2026-09-14"]);
});

// --- sortQueue ---

test("unfinished work outranks a scheduled post already posted", () => {
  const out = sortQueue([
    { id: "posted", status: "posted", scheduled_at: atHour("2026-09-01", 11) },
    { id: "draft", status: "draft", scheduled_at: null },
  ]);
  assert.deepEqual(out.map((x) => x.id), ["draft", "posted"]);
});

test("within a status, soonest scheduled comes first and undated sinks", () => {
  const out = sortQueue([
    { id: "undated", status: "draft" },
    { id: "later", status: "draft", scheduled_at: atHour("2026-09-20", 11) },
    { id: "sooner", status: "draft", scheduled_at: atHour("2026-09-08", 11) },
  ]);
  assert.deepEqual(out.map((x) => x.id), ["sooner", "later", "undated"]);
});

test("sortQueue does not mutate its input", () => {
  const input = [{ id: "b", status: "posted" }, { id: "a", status: "draft" }];
  sortQueue(input);
  assert.deepEqual(input.map((x) => x.id), ["b", "a"]);
});
