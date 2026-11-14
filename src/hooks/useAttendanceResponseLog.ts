import { useState, useEffect, useCallback } from 'react';
import { formatISO, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import { getUpcomingSaturday } from '../lib/week';
import type { AttendanceStatus, Profile } from '../types';

// ── Module-level cache ──────────────────────────────────────────────────────
// Keyed by the selected period so switching between windows does not thrash.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const RESPONSE_LOG_DEFAULT_WEEKS = 4;
export const RESPONSE_LOG_MAX_ROWS = 1000;

interface ResponseLogCache {
  at: number;
  entries: AttendanceLogEntry[];
  truncated: boolean;
}
const memCache = new Map<number, ResponseLogCache>();

/** ISO date of the oldest week included for the selected window. */
export function responseLogCutoff(weeksBack: number): string {
  const weeks = Math.max(1, Math.min(52, Math.trunc(weeksBack)));
  return formatISO(subDays(getUpcomingSaturday(new Date()), (weeks - 1) * 7), {
    representation: 'date',
  });
}

/** A single attendance response across ALL weeks (one row per player/week). */
export interface AttendanceLogEntry {
  id: string;
  user_id: string;
  week_start: string; // ISO date of the war week (Saturday)
  status: AttendanceStatus;
  created_at: string; // when the player FIRST pressed join / not join / maybe
  updated_at: string; // when the status was LAST changed
  set_by: string | null;
  profile: Profile | null;
  set_by_profile: Profile | null; // manager who set it on the player's behalf
}

const PROFILE_COLUMNS =
  'id,username,avatar_url,character_name,character_class,is_management,is_admin';

async function fetchEntries(weeksBack: number): Promise<ResponseLogCache> {
  const cutoff = responseLogCutoff(weeksBack);
  const { data, error } = await withDbTiming(
    'GET',
    `attendance.response_log weeks=${weeksBack}`,
    (signal) =>
      supabase
        .from('attendance')
        .select(
          `id,user_id,week_start,status,created_at,updated_at,set_by,
           profile:user_id(${PROFILE_COLUMNS}),
           set_by_profile:set_by(${PROFILE_COLUMNS})`
        )
        .gte('week_start', cutoff)
        .order('week_start', { ascending: false })
        .order('created_at', { ascending: true })
        .range(0, RESPONSE_LOG_MAX_ROWS - 1)
        .abortSignal(signal)
  );
  if (error) throw error;
  // Supabase returns joined FK data as arrays; normalize to nullable objects.
  const entries = ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    ...r,
    profile: Array.isArray(r.profile) ? (r.profile[0] ?? null) : r.profile,
    set_by_profile: Array.isArray(r.set_by_profile)
      ? (r.set_by_profile[0] ?? null)
      : r.set_by_profile,
  })) as AttendanceLogEntry[];
  const result: ResponseLogCache = {
    at: Date.now(),
    entries,
    truncated: entries.length >= RESPONSE_LOG_MAX_ROWS,
  };
  memCache.set(weeksBack, result);
  // Keep at most two periods in memory while the selector changes.
  if (memCache.size > 2) {
    const oldest = [...memCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) memCache.delete(oldest[0]);
  }
  return result;
}

/**
 * Response log for a bounded window of weeks. Manager-only data (the tab is
 * gated client-side by `is_management`). Loading this on demand instead of at
 * login keeps the startup request count and payload small.
 */
export function useAttendanceResponseLog(
  enabled = true,
  weeksBack = RESPONSE_LOG_DEFAULT_WEEKS
) {
  const initial = memCache.get(weeksBack);
  const [entries, setEntries] = useState<AttendanceLogEntry[]>(initial?.entries ?? []);
  const [truncated, setTruncated] = useState(initial?.truncated ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchEntries(weeksBack);
      setEntries(result.entries);
      setTruncated(result.truncated);
      setError(null);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Failed to fetch response log');
    } finally {
      setRefreshing(false);
    }
  }, [weeksBack]);

  useEffect(() => {
    if (!enabled) return;

    const cached = memCache.get(weeksBack);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setEntries(cached.entries);
      setTruncated(cached.truncated);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTruncated(false);
    fetchEntries(weeksBack)
      .then((result) => {
        if (cancelled) return;
        setEntries(result.entries);
        setTruncated(result.truncated);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? 'Failed to fetch response log');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, weeksBack]);

  return { entries, loading, error, refreshing, refresh, truncated };
}
