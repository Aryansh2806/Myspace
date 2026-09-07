type SpringOpts = {
  response?: number; damping?: number; reduced?: boolean;
  onUpdate?: (v: number) => void; onRest?: () => void;
};
export class Spring {
  x: number; v: number; target: number;
  response: number; damping: number; reduced: boolean;
  onUpdate: (v: number) => void; onRest: () => void;
  constructor(value: number, opts?: SpringOpts);
  set(x: number): void;
  to(target: number, velocity?: number): void;
  halt(): void;
  step(dt: number): boolean;
}
export function project(velocity: number, decel?: number): number;
export function rubberband(overshoot: number, dimension: number, c?: number): number;
export function velocityFrom(history: { p: number; t: number }[], now: number, windowMs?: number): number;
