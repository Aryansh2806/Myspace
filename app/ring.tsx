"use client";

import { useEffect, useRef } from "react";
import { Spring } from "@/lib/spring.mjs";

/**
 * Completion ring.
 *
 * Every dimension derives from `size`, and the box is sized from the same
 * number the SVG uses. The previous version hardcoded the CSS box (104px) and
 * the SVG (84px) separately; resizing one left the circle centred at 42,42
 * inside a box whose label centred at 52,52, so the caption sat across the
 * stroke. One source of truth means that cannot happen again.
 */
export default function Ring({
  done,
  total,
  size = 104,
  stroke = 8,
}: {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2; // stroke's outer edge lands exactly on the box
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;

  const arc = useRef<SVGCircleElement>(null);
  const label = useRef<HTMLElement>(null);
  const fill = useRef<Spring | null>(null);
  const count = useRef<Spring | null>(null);

  useEffect(() => {
    const reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!fill.current) {
      // First paint is at rest: a reload must never be caught counting up.
      fill.current = new Spring(pct, {
        response: 0.55,
        reduced,
        onUpdate: (v) =>
          arc.current?.setAttribute("stroke-dashoffset", String(circumference * (1 - v))),
      });
      count.current = new Spring(done, {
        response: 0.5,
        reduced,
        onUpdate: (v) => {
          if (label.current) label.current.textContent = String(Math.round(v));
        },
      });
      fill.current.set(pct);
      count.current.set(done);
    } else {
      fill.current.to(pct);
      count.current!.to(done);
    }
  }, [pct, done, circumference]);

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          ref={arc}
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <p className="cap">
        <b ref={label}>{done}</b>
        <span>of {total}</span>
      </p>
      <span className="sr-only">
        {done} of {total} done
      </span>
    </div>
  );
}
