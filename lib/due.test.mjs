import { test } from "node:test";
import assert from "node:assert/strict";
import { selectDue, endOfDay, nowLabel, sortTasks, nextPriority, sortManual, positionFor } from "./due.mjs";

const now = new Date("2026-09-07T12:00:00+05:30");
const tasks = [
  { id: "overdue", status: "open", due_at: "2026-09-05T18:00:00+05:30" },
  { id: "soon", status: "open", due_at: "2026-09-07T13:00:00+05:30" },
  { id: "tonight", status: "open", due_at: "2026-09-07T22:00:00+05:30" },
  { id: "tomorrow", status: "open", due_at: "2026-09-08T10:00:00+05:30" },
  { id: "nodate", status: "open", due_at: null },
  { id: "finished", status: "done", due_at: "2026-09-01T10:00:00+05:30" },
];

test("2h window catches overdue and imminent, not tonight", () => {
  const due = selectDue(tasks, now.getTime() + 2 * 3600_000);
  assert.deepEqual(due.map((t) => t.id), ["overdue", "soon"]);
});

test("skips done tasks and tasks with no date", () => {
  const ids = selectDue(tasks, "2027-01-01").map((t) => t.id);
  assert.ok(!ids.includes("finished"));
  assert.ok(!ids.includes("nodate"));
});

test("results are sorted earliest first", () => {
  const due = selectDue(tasks, "2027-01-01");
  assert.deepEqual(due.map((t) => t.id), ["overdue", "soon", "tonight", "tomorrow"]);
});

test("endOfDay covers everything due today in IST but not tomorrow", () => {
  const due = selectDue(tasks, endOfDay(now));
  assert.deepEqual(due.map((t) => t.id), ["overdue", "soon", "tonight"]);
});

test("endOfDay at 23:00 IST still means tonight, not tomorrow", () => {
  // 23:00 IST on the 7th is 17:30 UTC — a naive UTC day-end would roll over.
  const late = new Date("2026-09-07T23:00:00+05:30");
  assert.equal(endOfDay(late).toISOString(), endOfDay(now).toISOString());
});

test("endOfDay just after midnight IST rolls to the new day", () => {
  const justAfter = new Date("2026-09-08T00:30:00+05:30");
  assert.notEqual(endOfDay(justAfter).toISOString(), endOfDay(now).toISOString());
});

test("nowLabel spells the month out — a numeric date silently shifts due dates", () => {
  const label = nowLabel(new Date("2026-09-07T15:04:00+05:30"));
  assert.match(label, /Monday/);
  assert.match(label, /September/);
  assert.match(label, /2026/);
  assert.match(label, /15:04/);
  // The bug this exists to prevent: no bare D/M or M/D anywhere.
  assert.doesNotMatch(label, /\d+\/\d+/);
});

test("nowLabel renders in IST, not the host timezone", () => {
  // 20:00 UTC on the 7th is 01:30 IST on the 8th.
  assert.match(nowLabel(new Date("2026-09-07T20:00:00Z")), /Tuesday, 8 September/);
});

// --- priority ordering ---
const P = (id, priority, due_at = null) => ({ id, priority, due_at });

test("high priority outranks an earlier due date", () => {
  const out = sortTasks([
    P("soon-normal", "normal", "2026-09-08T10:00:00+05:30"),
    P("later-high", "high", "2026-09-20T10:00:00+05:30"),
  ]);
  assert.deepEqual(out.map((t) => t.id), ["later-high", "soon-normal"]);
});

test("within a priority, soonest due comes first", () => {
  const out = sortTasks([
    P("b", "high", "2026-09-20T10:00:00+05:30"),
    P("a", "high", "2026-09-08T10:00:00+05:30"),
  ]);
  assert.deepEqual(out.map((t) => t.id), ["a", "b"]);
});

test("a dated task outranks an undated one at the same priority", () => {
  const out = sortTasks([P("undated", "normal"), P("dated", "normal", "2027-01-01T10:00:00+05:30")]);
  assert.deepEqual(out.map((t) => t.id), ["dated", "undated"]);
});

test("low priority sinks below undated normal work", () => {
  const out = sortTasks([P("low", "low", "2026-09-08T10:00:00+05:30"), P("normal", "normal")]);
  assert.deepEqual(out.map((t) => t.id), ["normal", "low"]);
});

test("a missing priority is treated as normal, not as last", () => {
  // Rows written before the migration have no priority field at all.
  const out = sortTasks([P("low", "low"), { id: "legacy", due_at: null }, P("high", "high")]);
  assert.deepEqual(out.map((t) => t.id), ["high", "legacy", "low"]);
});

test("sortTasks does not mutate its input", () => {
  const input = [P("b", "low"), P("a", "high")];
  sortTasks(input);
  assert.deepEqual(input.map((t) => t.id), ["b", "a"]);
});

test("nextPriority cycles normal -> high -> low -> normal", () => {
  assert.equal(nextPriority("normal"), "high");
  assert.equal(nextPriority("high"), "low");
  assert.equal(nextPriority("low"), "normal");
  assert.equal(nextPriority(undefined), "high"); // legacy rows start the cycle
});

// --- manual ordering ---
const M = (id, position) => ({ id, position });

test("sortManual orders by position, unpositioned rows last", () => {
  const out = sortManual([M("c", 30), M("new", null), M("a", 10), M("b", 20)]);
  assert.deepEqual(out.map((t) => t.id), ["a", "b", "c", "new"]);
});

test("positionFor lands a row between its new neighbours", () => {
  const list = [M("a", 100), M("b", 200), M("c", 300)];
  // move "a" (index 0) to index 1 -> between b(200) and c(300)
  const p = positionFor(list, 0, 1);
  assert.ok(p > 200 && p < 300, `expected 200 < ${p} < 300`);
});

test("moving to the top goes below nothing", () => {
  const list = [M("a", 100), M("b", 200), M("c", 300)];
  assert.ok(positionFor(list, 2, 0) < 100);
});

test("moving to the bottom goes above everything", () => {
  const list = [M("a", 100), M("b", 200), M("c", 300)];
  assert.ok(positionFor(list, 0, 2) > 300);
});

test("a drag actually reorders when the new position is applied", () => {
  const list = [M("a", 100), M("b", 200), M("c", 300)];
  const moved = { ...list[0], position: positionFor(list, 0, 2) };
  const after = sortManual([moved, list[1], list[2]]);
  assert.deepEqual(after.map((t) => t.id), ["b", "c", "a"]);
});

test("reordering a single-item list is a no-op, not a crash", () => {
  assert.equal(typeof positionFor([M("only", 100)], 0, 0), "number");
});

test("unpositioned neighbours do not produce NaN", () => {
  const p = positionFor([M("a", null), M("b", null)], 0, 1);
  assert.ok(Number.isFinite(p), `got ${p}`);
});
