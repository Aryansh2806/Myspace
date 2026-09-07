import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, addDays, completionsByDay, streakLength, history } from "./streak.mjs";

const done = (iso) => ({ status: "done", done_at: iso });
const NOW = new Date("2026-09-07T15:00:00+05:30"); // Monday afternoon, IST

test("a completion just after midnight IST belongs to that IST day", () => {
  // 01:00 on the 8th IST is 19:30 on the 7th UTC. Grouping by UTC would file
  // it under the wrong day and break the streak.
  assert.equal(dayKey("2026-09-08T01:00:00+05:30"), "2026-09-08");
  assert.equal(dayKey("2026-09-07T19:30:00Z"), "2026-09-08");
});

test("a completion just before midnight IST stays on that day", () => {
  assert.equal(dayKey("2026-09-07T23:59:00+05:30"), "2026-09-07");
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-09-01", -1), "2026-08-31");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("counts group by local day", () => {
  const c = completionsByDay([
    done("2026-09-07T10:00:00+05:30"),
    done("2026-09-07T22:00:00+05:30"),
    done("2026-09-06T10:00:00+05:30"),
  ]);
  assert.equal(c.get("2026-09-07"), 2);
  assert.equal(c.get("2026-09-06"), 1);
});

test("open tasks and completed tasks with no timestamp are ignored", () => {
  const c = completionsByDay([
    { status: "open", done_at: "2026-09-07T10:00:00+05:30" },
    { status: "done", done_at: null },
  ]);
  assert.equal(c.size, 0);
});

test("consecutive days count", () => {
  const tasks = ["2026-09-07", "2026-09-06", "2026-09-05"].map((d) => done(d + "T10:00:00+05:30"));
  assert.equal(streakLength(tasks, NOW), 3);
});

test("a gap ends the streak", () => {
  const tasks = ["2026-09-07", "2026-09-06", "2026-09-04"].map((d) => done(d + "T10:00:00+05:30"));
  assert.equal(streakLength(tasks, NOW), 2);
});

test("nothing shipped today yet — yesterday's streak still stands", () => {
  // The whole point: an unfinished morning must not read as a lost streak.
  const tasks = ["2026-09-06", "2026-09-05"].map((d) => done(d + "T10:00:00+05:30"));
  assert.equal(streakLength(tasks, NOW), 2);
});

test("a full missed day does end it", () => {
  const tasks = ["2026-09-05", "2026-09-04"].map((d) => done(d + "T10:00:00+05:30"));
  assert.equal(streakLength(tasks, NOW), 0);
});

test("several completions in one day still count as one day", () => {
  const tasks = [
    done("2026-09-07T09:00:00+05:30"),
    done("2026-09-07T13:00:00+05:30"),
    done("2026-09-07T20:00:00+05:30"),
  ];
  assert.equal(streakLength(tasks, NOW), 1);
});

test("no completions at all is a streak of zero", () => {
  assert.equal(streakLength([], NOW), 0);
  assert.equal(streakLength([{ status: "open", done_at: null }], NOW), 0);
});

test("history returns the requested span, oldest first, ending today", () => {
  const h = history([done("2026-09-07T10:00:00+05:30"), done("2026-09-03T10:00:00+05:30")], NOW);
  assert.equal(h.length, 7);
  assert.equal(h[0].day, "2026-09-01");
  assert.equal(h[6].day, "2026-09-07");
  assert.equal(h[6].count, 1);
  assert.equal(h[2].day, "2026-09-03");
  assert.equal(h[2].count, 1);
  assert.equal(h[1].count, 0); // a quiet day is a zero, not a missing bar
});

test("history counts nothing outside the window", () => {
  const h = history([done("2026-08-01T10:00:00+05:30")], NOW);
  assert.equal(h.reduce((a, d) => a + d.count, 0), 0);
});
