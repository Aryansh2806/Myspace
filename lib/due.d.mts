type Dueable = { status: string; due_at: string | null };
export function selectDue<T extends Dueable>(tasks: T[], cutoff: Date | string | number): T[];
export function endOfDay(now?: Date, tz?: string): Date;
export function nowLabel(now?: Date, tz?: string): string;
