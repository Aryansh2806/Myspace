// Spring physics, ported from the Studio Deck prototype.
// A spring animates from its CURRENT value, which is the whole reason a
// gesture can be interrupted: re-targeting mid-flight keeps both position
// and velocity, so grabbing a moving row does not make it jump.

const springs = new Set();
let ticking = false;
let last = 0;

const raf =
  typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;

function frame(t) {
  const dt = Math.min((t - last) / 1000, 1 / 30) || 1 / 60;
  last = t;
  for (const s of [...springs]) if (!s.step(dt)) springs.delete(s);
  if (springs.size && raf) raf(frame);
  else ticking = false;
}

export class Spring {
  /**
   * @param {number} value
   * @param {{response?: number, damping?: number, reduced?: boolean,
   *          onUpdate?: (v: number) => void, onRest?: () => void}} opts
   *   response — seconds to reach the target. Not a duration; a spring has none.
   *   damping  — 1 is critically damped (no overshoot). ~0.8 bounces.
   */
  constructor(value, opts = {}) {
    this.x = value;
    this.v = 0;
    this.target = value;
    this.response = opts.response ?? 0.4;
    this.damping = opts.damping ?? 1;
    this.reduced = opts.reduced ?? false;
    this.onUpdate = opts.onUpdate ?? (() => {});
    this.onRest = opts.onRest ?? (() => {});
  }

  /** Jump, no animation. */
  set(x) {
    this.x = x;
    this.v = 0;
    this.target = x;
    springs.delete(this);
    this.onUpdate(x);
  }

  /** Re-target. Passing velocity carries a gesture's momentum into the spring. */
  to(target, velocity) {
    this.target = target;
    if (velocity !== undefined) this.v = velocity;
    if (this.reduced || !raf) {
      this.x = target;
      this.v = 0;
      this.onUpdate(this.x);
      this.onRest();
      return;
    }
    springs.add(this);
    if (!ticking) {
      ticking = true;
      last = performance.now();
      raf(frame);
    }
  }

  /** Stop where it is — how a gesture grabs a moving element. */
  halt() {
    springs.delete(this);
  }

  /** One integration step. Returns false once it has settled. */
  step(dt) {
    const w = (2 * Math.PI) / this.response;
    const a = -(w * w) * (this.x - this.target) - 2 * this.damping * w * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    if (Math.abs(this.x - this.target) < 0.08 && Math.abs(this.v) < 0.6) {
      this.x = this.target;
      this.v = 0;
      this.onUpdate(this.x);
      this.onRest();
      return false;
    }
    this.onUpdate(this.x);
    return true;
  }
}

/**
 * Where a flick coasts to. This is the exponential-decay form iOS uses —
 * NOT the textbook v^2/(2a), which decelerates far too aggressively.
 */
export function project(velocity, decel = 0.998) {
  return ((velocity / 1000) * decel) / (1 - decel);
}

/** Progressive resistance past a boundary. Real things slow before they stop. */
export function rubberband(overshoot, dimension, c = 0.55) {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

/** Velocity in px/s from a short pointer history, ignoring stale samples. */
export function velocityFrom(history, now, windowMs = 110) {
  if (history.length < 2) return 0;
  const first = history.find((p) => now - p.t < windowMs) ?? history[0];
  const lastP = history[history.length - 1];
  const dt = Math.max(lastP.t - first.t, 1);
  return ((lastP.p - first.p) / dt) * 1000;
}
