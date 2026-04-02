import { useState, useEffect, useCallback, useRef } from 'react';
import { formatISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import { getUpcomingSaturday } from '../lib/week';
import type { Attendance, AttendanceStatus } from '../types';

const WEEK_ATTENDANCE_CACHE_TTL_MS = 30000;
const WEEK_ATTENDANCE_STORAGE_PREFIX = 'gwm_att_v1_';
const weekAttendanceCache = new Map<string, { at: number; rows: Attendance[] }>();

// ── Shared fetch deduplication ─────────────────────────────────────────────
// Multiple hook instances (App, AttendancePage, ManagementPage) watch the
// same week simultaneously. Without this guard each would fire its own DB
// round-trip on every realtime event, stacking 3-4 concurrent queries.
// Now at most ONE fetch per weekStr is in-flight at any time; latecomers
// piggyback on the running promise instead of issuing a second request.
const activeFetches = new Map<string, Promise<Attendance[]>>();

async function fetchWeekRows(weekStartStr: string): Promise<Attendance[]> {
  const existing = activeFetches.get(weekStartStr);
  if (existing) return existing;

  const promise = (async () => {
    const { data: baseData, error: baseErr } = await withDbTiming(
      'GET',
      `attendance.rows week=${weekStartStr}`,
      () =>
        supabase
          .from('attendance')
          .select('id,user_id,week_start,status,created_at,updated_at')
          .eq('week_start', weekStartStr)
          .order('created_at', { ascending: true })
    );

    if (baseErr) throw baseErr;
    const baseRows = (baseData as Attendance[]) ?? [];
    const userIds = Array.from(new Set(baseRows.map((r) => r.user_id).filter(Boolean)));

    let profileById = new Map<string, Attendance['profile']>();
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesErr } = await withDbTiming(
        'GET',
        `profiles.byIds count=${userIds.length}`,
        () =>
          supabase
            .from('profiles')
            .select('id,discord_id,username,avatar_url,character_name,character_class,is_management,is_admin,created_at')
            .in('id', userIds)
      );
      if (!profilesErr) {
        profileById = new Map(
          ((profilesData as Attendance['profile'][] | null) ?? [])
            .filter((p): p is NonNullable<Attendance['profile']> => !!p?.id)
            .map((p) => [p.id, p])
        );
      }
    }

    const rows = baseRows.map((r) => ({ ...r, profile: profileById.get(r.user_id) }));
    const entry = { at: Date.now(), rows };
    weekAttendanceCache.set(weekStartStr, entry);
    persistWeek(weekStartStr, entry);
    return rows;
  })();

  activeFetches.set(weekStartStr, promise);
  promise.finally(() => activeFetches.delete(weekStartStr));
  return promise;
}
// ── End shared fetch deduplication ────────────────────────────────────────

function readPersistedWeek(weekStr: string): { at: number; rows: Attendance[] } | null {
  try {
    const raw = localStorage.getItem(WEEK_ATTENDANCE_STORAGE_PREFIX + weekStr);
    if (!raw) return null;
    return JSON.parse(raw) as { at: number; rows: Attendance[] };
  } catch {
    return null;
  }
}

function persistWeek(weekStr: string, entry: { at: number; rows: Attendance[] }) {
  try {
    localStorage.setItem(WEEK_ATTENDANCE_STORAGE_PREFIX + weekStr, JSON.stringify(entry));
  } catch {
    // Ignore quota errors (private mode / storage full).
  }
}

export function useAttendance(userId: string | null, weekStart?: Date, enabled = true) {
  const currentWeekStart = getUpcomingSaturday(weekStart ?? new Date());
  const weekStartStr = formatISO(currentWeekStart, { representation: 'date' });
  const channelInstanceIdRef = useRef(`att-${Math.random().toString(36).slice(2, 10)}`);

  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [weekAttendances, setWeekAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetches the full week list without toggling the loading flag.
  // Returns the fetched rows so callers can reuse the data (e.g. to update
  // the user's own attendance record without an extra round-trip).
  // Uses the module-level deduplicating fetchWeekRows so concurrent calls
  // from multiple hook instances share a single in-flight DB request.
  const refreshSilent = useCallback(async (): Promise<Attendance[]> => {
    try {
      const rows = await fetchWeekRows(weekStartStr);
      setWeekAttendances(rows);
      return rows;
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Failed to fetch attendance');
      return [];
    }
  }, [weekStartStr]);

  const fetchWeekAttendances = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    await refreshSilent();
    setLoading(false);
  }, [enabled, refreshSilent]);

  // Initial data fetch on mount or when week / user changes.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Seed from in-memory cache first; fall back to localStorage so users
    // always see their last-known data instantly on every page open.
    let cached = weekAttendanceCache.get(weekStartStr);
    if (!cached) {
      const persisted = readPersistedWeek(weekStartStr);
      if (persisted) {
        weekAttendanceCache.set(weekStartStr, persisted);
        cached = persisted;
      }
    }
    const isCacheFresh =
      !!cached && Date.now() - cached.at < WEEK_ATTENDANCE_CACHE_TTL_MS;

    if (cached && cached.rows.length > 0) {
      setWeekAttendances(cached.rows);
      if (userId) {
        setAttendance(cached.rows.find((a) => a.user_id === userId) ?? null);
      } else {
        setAttendance(null);
      }
    }

    setLoading(!isCacheFresh);
    refreshSilent()
      .then((rows) => {
        if (cancelled) return;
        if (userId) {
          setAttendance(rows.find((a) => a.user_id === userId) ?? null);
        } else {
          setAttendance(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshSilent, userId, weekStartStr]);

  // Real-time subscription – updates all open clients the moment any
  // attendance record for the current week is inserted, updated, or deleted.
  useEffect(() => {
    if (!enabled) return;

    // Guard against concurrent fetches triggered by rapid realtime events.
    // If a refresh is already in-flight, we coalesce any subsequent events
    // into a single follow-up fetch instead of stacking unbounded requests.
    let refreshInFlight = false;
    let pendingRefresh = false;

    async function handleRealtimeChange() {
      if (refreshInFlight) {
        pendingRefresh = true;
        return;
      }
      refreshInFlight = true;
      pendingRefresh = false;
      try {
        const allData = await refreshSilent();
        if (userId) {
          const ownRecord = allData.find((a) => a.user_id === userId) ?? null;
          setAttendance(ownRecord);
        }
      } finally {
        refreshInFlight = false;
        if (pendingRefresh) {
          pendingRefresh = false;
          handleRealtimeChange();
        }
      }
    }

    const channelTopic = `attendance-${weekStartStr}-${channelInstanceIdRef.current}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `week_start=eq.${weekStartStr}`,
        },
        () => { handleRealtimeChange(); }
      )
      .subscribe();

    return () => {
      // Unsubscribe first so Supabase closes the socket cleanly before
      // removing the channel. Without this, React StrictMode double-mount
      // teardown races the WS handshake and logs a noisy (but harmless)
      // "WebSocket is closed before the connection is established" error.
      channel.unsubscribe().finally(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [enabled, weekStartStr, userId, refreshSilent]);

  const setStatus = async (status: AttendanceStatus) => {
    if (!userId) return;
    setError(null);

    // ── Optimistic update ──────────────────────────────────────────────────
    // Capture previous state so we can revert on error.
    const prevAttendance = attendance;
    const prevWeekAttendances = weekAttendances;

    const now = new Date().toISOString();
    const optimistic: Attendance = prevAttendance
      ? { ...prevAttendance, status, updated_at: now }
      : {
          id: `opt-${Date.now()}`,
          user_id: userId,
          week_start: weekStartStr,
          status,
          created_at: now,
          updated_at: now,
        };

    setAttendance(optimistic);
    setWeekAttendances((prev) =>
      prev.some((a) => a.user_id === userId)
        ? prev.map((a) => (a.user_id === userId ? { ...a, status, updated_at: now } : a))
        : [...prev, optimistic]
    );
    // Mirror into the module-level cache so a stale-while-revalidate hit
    // doesn't overwrite the optimistic value before the server responds.
    const cachedEntry = weekAttendanceCache.get(weekStartStr);
    if (cachedEntry) {
      weekAttendanceCache.set(weekStartStr, {
        at: cachedEntry.at,
        rows: cachedEntry.rows.some((a) => a.user_id === userId)
          ? cachedEntry.rows.map((a) =>
              a.user_id === userId ? { ...a, status, updated_at: now } : a
            )
          : [...cachedEntry.rows, optimistic],
      });
    }
    // ── End optimistic update ──────────────────────────────────────────────

    const doUpsert = () =>
      supabase
        .from('attendance')
        .upsert(
          { user_id: userId, week_start: weekStartStr, status, updated_at: now },
          { onConflict: 'user_id,week_start' }
        )
        .select()
        .single();

    setSubmitting(true);
    let { data, error: err } = await withDbTiming(
      'PUT',
      `attendance.setStatus user=${userId} week=${weekStartStr} status=${status}`,
      doUpsert
    );

    // 401 = JWT expired mid-session. Refresh the session and retry once.
    if (err && (err.code === 'PGRST301' || (err as { status?: number }).status === 401)) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        ({ data, error: err } = await withDbTiming(
          'PUT',
          `attendance.setStatus.retry user=${userId} week=${weekStartStr} status=${status}`,
          doUpsert
        ));
      }
    }
    setSubmitting(false);

    if (err) {
      // Revert optimistic changes on failure.
      setAttendance(prevAttendance);
      setWeekAttendances(prevWeekAttendances);
      setError(err.message);
      return;
    }
    setAttendance(data as Attendance);
    // Fire background refresh so the roster stays in sync; don't await it.
    refreshSilent();
  };

  return {
    attendance,
    weekAttendances,
    loading,
    submitting,
    error,
    setStatus,
    currentWeekStart,
    weekStartStr,
    refresh: fetchWeekAttendances,
  };
}
