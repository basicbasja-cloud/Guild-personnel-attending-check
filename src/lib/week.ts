import { addDays, getDay, startOfDay } from 'date-fns';

export function getUpcomingSaturday(date: Date) {
  const normalizedDate = startOfDay(date);
  const dayOfWeek = getDay(normalizedDate);
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;

  return addDays(normalizedDate, daysUntilSaturday);
}

/**
 * Returns the most recent Saturday on or before `date`.
 * Use this as the default 'war week' -- war stats are entered after
 * Saturday's battle, so viewing on Monday should still show last Saturday.
 */
export function getLastSaturday(date: Date): Date {
  const d = startOfDay(date);
  const dayOfWeek = getDay(d);           // 0=Sun ... 6=Sat
  const daysSince = (dayOfWeek + 1) % 7; // Sat->0, Sun->1, Mon->2 ...
  return addDays(d, -daysSince);
}
