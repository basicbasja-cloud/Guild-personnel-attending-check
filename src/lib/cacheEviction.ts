import { formatISO, subDays } from 'date-fns';
import { getUpcomingSaturday } from './week';

/** Keep roughly two months of weekly caches; older keys are removed. */
const MAX_CACHED_WEEKS = 8;

// Week-keyed caches whose suffix is an ISO date (training caches use event IDs
// and are pruned by useTrainingAttendance).
const WEEK_CACHE_PREFIXES = [
  'gwm_att_v1_',
  'gwm_war_v1_',
  'gwm_kpi_board_v1_',
  'gwm_kpi_entries_v4_',
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Drop weekly localStorage snapshots older than MAX_CACHED_WEEKS.
 * Runs once per app load before data hooks mount.
 */
export function evictOldWeekCaches(now = new Date()): void {
  if (typeof localStorage === 'undefined') return;
  const cutoff = formatISO(
    subDays(getUpcomingSaturday(now), (MAX_CACHED_WEEKS - 1) * 7),
    { representation: 'date' }
  );

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }

    for (const key of keys) {
      const prefix = WEEK_CACHE_PREFIXES.find((candidate) => key.startsWith(candidate));
      if (!prefix) continue;
      const week = key.slice(prefix.length);
      // Skip any non-date suffix (e.g. per-user or per-event keys).
      if (!ISO_DATE_RE.test(week)) continue;
      if (week < cutoff) localStorage.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable (private mode / disabled storage).
  }
}
