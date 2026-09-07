type Schedulable = { scheduled_at?: string | null; anchor_date?: string | null; status?: string };
export function atHour(day: string, hour?: number, tz?: string): string;
export function daysBetween(start: string | Date, end: string | Date): string[];
export function spread<T extends Schedulable>(
  posts: T[],
  opts?: { start: string | Date; end: string | Date; hour?: number; tz?: string },
): (T & { scheduled_at: string })[];
export function weekStart(day: string): string;
export function weeksOf<T extends Schedulable>(
  posts: T[],
  tz?: string,
): { weeks: { weekStart: string; days: { day: string; posts: T[] }[] }[]; unscheduled: T[] };
export function sortQueue<T extends Schedulable>(posts: T[]): T[];
