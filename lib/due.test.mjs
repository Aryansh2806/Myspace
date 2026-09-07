import { test } from "node:test";
import assert from "node:assert/strict";
import { selectDue, endOfDay } from "./due.mjs";

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
