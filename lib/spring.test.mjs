import { test } from "node:test";
import assert from "node:assert/strict";
import { Spring, project, rubberband, velocityFrom } from "./spring.mjs";

/** Run a spring to rest off-clock, returning every value it passed through. */
function run(s, maxSteps = 600) {
  const seen = [s.x];
  for (let i = 0; i < maxSteps; i++) {
    const alive = s.step(1 / 60);
    seen.push(s.x);
    if (!alive) break;
  }
  return seen;
}

test("a critically damped spring reaches its target without overshooting", () => {
  const s = new Spring(0, { damping: 1, response: 0.4 });
  s.target = 100;
  const seen = run(s);
  assert.equal(s.x, 100);
  assert.ok(Math.max(...seen) <= 100.01, `overshot to ${Math.max(...seen)}`);
});

test("an underdamped spring does overshoot — that is the point of bounce", () => {
  const s = new Spring(0, { damping: 0.6, response: 0.4 });
  s.target = 100;
  assert.ok(Math.max(...run(s)) > 100, "expected overshoot at damping 0.6");
});

test("a faster response settles in fewer frames", () => {
  const mk = (response) => {
    const s = new Spring(0, { damping: 1, response });
    s.target = 100;
    return run(s).length;
  };
  assert.ok(mk(0.25) < mk(0.6));
});

test("initial velocity carries the gesture into the animation", () => {
  const slow = new Spring(0, { damping: 1, response: 0.4 });
  slow.target = 100;
  const fast = new Spring(0, { damping: 1, response: 0.4 });
  fast.target = 100;
  fast.v = 400;
  // One frame in, the one that was thrown is further along.
  slow.step(1 / 60);
  fast.step(1 / 60);
  assert.ok(fast.x > slow.x, `${fast.x} should exceed ${slow.x}`);
});

test("re-targeting mid-flight keeps velocity — no jump on interrupt", () => {
  const s = new Spring(0, { damping: 1, response: 0.4 });
  s.target = 200;
  for (let i = 0; i < 10; i++) s.step(1 / 60);
  const x = s.x, v = s.v;
  s.target = 0;             // reverse, as a grab-and-throw-back would
  assert.equal(s.x, x, "position must not jump");
  assert.equal(s.v, v, "velocity must carry through");
});

test("set() jumps and clears velocity", () => {
  const s = new Spring(0, { damping: 1 });
  s.v = 900;
  s.set(42);
  assert.equal(s.x, 42);
  assert.equal(s.v, 0);
});

test("a reduced-motion spring lands on the target immediately", () => {
  let rested = false;
  const s = new Spring(0, { reduced: true, onRest: () => (rested = true) });
  s.to(250);
  assert.equal(s.x, 250);
  assert.ok(rested);
});

test("project scales with velocity and stays signed", () => {
  assert.ok(project(1000) > project(500));
  assert.ok(project(-1000) < 0);
  assert.equal(project(0), 0);
});

test("project uses exponential decay, not v^2/2a", () => {
  // 1000 px/s at deceleration 0.998 coasts ~499px. The textbook form gives
  // a wildly different number; this pins the one iOS actually ships.
  assert.ok(Math.abs(project(1000) - 499) < 1, `got ${project(1000)}`);
});

test("rubberband resists more the further past the edge you pull", () => {
  const r = (o) => rubberband(o, 400);
  assert.ok(r(50) < 50, "must always give less than you pulled");
  assert.ok(r(100) > r(50), "still moves in the right direction");
  // Compare equal 100px pulls at different depths, not unequal intervals.
  assert.ok(r(400) - r(300) < r(150) - r(50), "the same pull moves it less, deeper in");
});

test("rubberband is symmetric and pinned at zero", () => {
  assert.equal(rubberband(0, 400), 0);
  assert.equal(rubberband(-80, 400), -rubberband(80, 400));
});

test("velocityFrom measures px/s and ignores stale samples", () => {
  const now = 1000;
  // 60px over the last 100ms = 600 px/s. The 500ms-old sample is outside the window.
  const v = velocityFrom([{ p: 0, t: 500 }, { p: 40, t: 900 }, { p: 100, t: 1000 }], now);
  assert.ok(Math.abs(v - 600) < 1, `got ${v}`);
});

test("velocityFrom returns 0 for a press with no movement", () => {
  assert.equal(velocityFrom([{ p: 10, t: 1 }], 2), 0);
  assert.equal(velocityFrom([], 2), 0);
});

test("a flick past the commit line projects past it even from short of it", () => {
  // 60px dragged, thrown at 900px/s, line at 96px: momentum should carry it.
  assert.ok(60 + project(900) > 96);
  // the same 60px released dead still should not commit
  assert.ok(60 + project(0) < 96);
});
