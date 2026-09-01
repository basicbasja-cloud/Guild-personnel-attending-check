import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import type { AttendanceStatus, Profile } from '../types';

// ── Module-level cache ──────────────────────────────────────────────────────
// One shared copy for every hook instance; preloadAttendanceLog() warms it
// right after login so the manager-only tab opens instantly with no spinner.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let memCache: { at: number; entries: AttendanceLogEntry[] } | null = null;

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
  'id,discord_id,username,avatar_url,character_name,character_class,main_skill_name,main_skill_level,sub_skill_name,sub_skill_level,is_management,is_admin,created_at';

async function fetchEntries(): Promise<AttendanceLogEntry[]> {
  const { data, error } = await withDbTiming('GET', 'attendance.response_log', () =>
    supabase
      .from('attendance')
      .select(
        `id,user_id,week_start,status,created_at,updated_at,set_by,
         profile:user_id(${PROFILE_COLUMNS}),
         set_by_profile:set_by(${PROFILE_COLUMNS})`
      )
      .order('week_start', { ascending: false })
      .order('created_at', { ascending: true })
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
  memCache = { at: Date.now(), entries };
  return entries;
}

/**
 * Eagerly warm the response-log cache. Call once after login for managers
 * so the tab renders instantly.
 */
export async function preloadAttendanceLog(): Promise<void> {
  if (memCache && Date.now() - memCache.at < CACHE_TTL_MS) return;
  await fetchEntries().catch((err) => {
    console.error('[preloadAttendanceLog]', err);
  });
}

/**
 * Full response log across all weeks — who pressed join / not join / maybe
 * and exactly when. Manager-only data (tab is gated client-side by
 * `is_management`; the underlying table is readable by all authenticated
 * users, same as the rest of attendance).
 */
export function useAttendanceResponseLog(enabled = true) {
  const [entries, setEntries] = useState<AttendanceLogEntry[]>(() => memCache?.entries ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchEntries();
      setEntries(rows);
      setError(null);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Failed to fetch response log');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const isFresh = memCache !== null && Date.now() - memCache.at < CACHE_TTL_MS;
    if (isFresh) return;

    let cancelled = false;
    if (!memCache || memCache.entries.length === 0) setLoading(true);
    fetchEntries()
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? 'Failed to fetch response log');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { entries, loading, error, refreshing, refresh };
}
