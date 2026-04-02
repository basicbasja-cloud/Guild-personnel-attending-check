import { addDays, getDay, startOfDay } from 'date-fns';

export function getUpcomingSaturday(date: Date) {
  const normalizedDate = startOfDay(date);
  const dayOfWeek = getDay(normalizedDate);
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;

  return addDays(normalizedDate, daysUntilSaturday);
}