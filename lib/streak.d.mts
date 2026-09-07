type Doneable = { status: string; done_at?: string | null };
export function dayKey(iso: string | Date, tz?: string): string;
export function addDays(key: string, n: number): string;
export function completionsByDay(tasks: Doneable[], tz?: string): Map<string, number>;
export function streakLength(tasks: Doneable[], now?: Date, tz?: string): number;
export function history(tasks: Doneable[], now?: Date, days?: number, tz?: string): { day: string; count: number }[];
