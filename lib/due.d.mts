type Dueable = { status: string; due_at: string | null };
export function selectDue<T extends Dueable>(tasks: T[], cutoff: Date | string | number): T[];
export function endOfDay(now?: Date, tz?: string): Date;
export function nowLabel(now?: Date, tz?: string): string;
export const PRIORITY_RANK: Record<string, number>;
export function sortTasks<T extends { priority?: string; due_at: string | null }>(tasks: T[]): T[];
export function nextPriority(p: string): "high" | "normal" | "low";
export function sortManual<T extends { position?: number | null }>(tasks: T[]): T[];
export function positionFor(list: { position?: number | null }[], from: number, to: number): number;
