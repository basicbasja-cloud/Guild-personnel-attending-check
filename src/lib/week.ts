import { addDays, getDay, startOfDay } from 'date-fns';

export function getUpcomingSaturday(date: Date) {
  const normalizedDate = startOfDay(date);
  const dayOfWeek = getDay(normalizedDate);
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;

  return addDays(normalizedDate, daysUntilSaturday);
}

// ── Double-war week detection ─────────────────────────────────────────────────
// May 30 2026 is the reference double-war Saturday (week 0 = double).
// Pattern alternates: double, single, double, single …
const DOUBLE_WAR_REF_MS = new Date('2026-05-30T00:00:00').getTime();

export function isDoubleWarWeek(saturdayDateStr: string): boolean {
  const sat = new Date(saturdayDateStr + 'T00:00:00').getTime();
  const weeksSinceRef = Math.round((sat - DOUBLE_WAR_REF_MS) / (7 * 24 * 60 * 60 * 1000));
  return weeksSinceRef % 2 === 0;
}