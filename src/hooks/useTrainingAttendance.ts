import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import type { TrainingAttendance, AttendanceStatus, Profile } from '../types';

// ── Cache ──────────────────────────────────────────────────────────────────
const TRAINING_CACHE_TTL_MS = 10 * 60 * 1000;
const TRAINING_ATTENDANCE_STORAGE_PREFIX = 'gwm_train_att_v1_';
const trainingCache = new Map<string, { at: number; rows: TrainingAttendance[] }>();
const activeFetches = new Map<string, Promise<TrainingAttendance[]>>();

function readPersistedTrainingAttendance(eventId: string): { at: number; rows: TrainingAttendance[] } | null {
  try {
    const raw = localStorage.getItem(TRAINING_ATTENDANCE_STORAGE_PREFIX + eventId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return parsed as { at: number; rows: TrainingAttendance[] };
  } catch {
    return null;
  }
}

function persistTrainingAttendance(eventId: string, entry: { at: number; rows: TrainingAttendance[] }) {
  try {
    localStorage.setItem(TRAINING_ATTENDANCE_STORAGE_PREFIX + eventId, JSON.stringify(entry));
  } catch {
    // Ignore quota errors (private mode / storage full).
  }
}

/** Evict stale cache entries to prevent unbounded memory growth. */
function evictStaleCache() {
  const cutoff = Date.now() - TRAINING_CACHE_TTL_MS * 2;
  for (const [key, val] of trainingCache) {
    if (val.at < cutoff) trainingCache.delete(key);
  }
  // Also clean up localStorage for the same cutoff
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(TRAINING_ATTENDANCE_STORAGE_PREFIX)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.at < cutoff) localStorage.removeItem(k);
          } catch { /* skip unparseable */ }
        }
      }
    }
  } catch { /* localStorage unavailable */ }
}

async function fetchEventRows(eventId: string): Promise<TrainingAttendance[]> {
  const existing = activeFetches.get(eventId);
  if (existing) return existing;

  const promise = (async () => {
    const { data: baseData, error: baseErr } = await withDbTiming(
      'GET',
      `training_attendance.rows event=${eventId}`,
      () =>
        supabase
          .from('training_attendance')
          .select('id,event_id,user_id,status,created_at,updated_at,set_by')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
    );

    if (baseErr) throw baseErr;
    const baseRows = (baseData as TrainingAttendance[]) ?? [];
    const userIds = Array.from(new Set(baseRows.map((r) => r.user_id).filter(Boolean)));
    const setByIds = Array.from(new Set(baseRows.map((r) => r.set_by).filter(Boolean)));
    const allProfileIds = Array.from(new Set([...userIds, ...setByIds]));

    let profileById = new Map<string, TrainingAttendance['profile']>();
    if (allProfileIds.length > 0) {
      const { data: profilesData, error: profilesErr } = await withDbTiming(
        'GET',
        `profiles.byIds count=${allProfileIds.length}`,
        () =>
          supabase
            .from('profiles')
            .select('id,discord_id,username,avatar_url,character_name,character_class,main_skill_name,main_skill_level,sub_skill_name,sub_skill_level,is_management,is_admin,created_at')
            .in('id', allProfileIds)
      );
      if (!profilesErr) {
        profileById = new Map(
          ((profilesData as Profile[] | null) ?? [])
            .filter((p): p is Profile => !!p?.id)
            .map((p) => [p.id, p])
        );
      }
    }

    const rows = baseRows.map((r) => ({
      ...r,
      profile: profileById.get(r.user_id),
      set_by_profile: r.set_by ? profileById.get(r.set_by) ?? null : null,
    }));
    const entry = { at: Date.now(), rows };
    trainingCache.set(eventId, entry);
    persistTrainingAttendance(eventId, entry);
    evictStaleCache();
    return rows;
  })();

  activeFetches.set(eventId, promise);
  promise.finally(() => activeFetches.delete(eventId));
  return promise;
}

export async function preloadTrainingAttendance(eventId: string): Promise<void> {
  const cached = trainingCache.get(eventId);
  if (cached && Date.now() - cached.at < TRAINING_CACHE_TTL_MS) return;
  await fetchEventRows(eventId).catch((err) => { console.error('[preloadTrainingAttendance]', err); });
}

export function useTrainingAttendance(eventId: string, userId: string | null) {
  const [attendance, setAttendance] = useState<TrainingAttendance | null>(null);
  const [eventAttendances, setEventAttendances] = useState<TrainingAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSilent = useCallback(async (): Promise<TrainingAttendance[]> => {
    try {
      const rows = await fetchEventRows(eventId);
      setEventAttendances(rows);
      return rows;
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Failed to fetch training attendance');
      return [];
    }
  }, [eventId]);

  // Initial load
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    let cached = trainingCache.get(eventId);
    if (!cached) {
      const persisted = readPersistedTrainingAttendance(eventId);
      if (persisted) {
        trainingCache.set(eventId, persisted);
        cached = persisted;
      }
    }

    const hasData = cached && cached.rows.length > 0;
    const isFresh = hasData && Date.now() - cached!.at < TRAINING_CACHE_TTL_MS;

    if (hasData) {
      setEventAttendances(cached!.rows);
      if (userId) {
        setAttendance(cached!.rows.find((a) => a.user_id === userId) ?? null);
      }
    }

    // Show loading only when we have NO data AND must fetch.
    // If we have stale data, show it instantly and revalidate silently.
    setLoading(!hasData);

    if (!isFresh) {
      const doFetch = async () => {
        const rows = await refreshSilent();
        if (cancelled) return;
        if (userId) setAttendance(rows.find((a) => a.user_id === userId) ?? null);
        setLoading(false);
      };
      doFetch();
    }

    return () => { cancelled = true; };
  }, [eventId, userId, refreshSilent]);

  // Realtime subscription
  useEffect(() => {
    if (!eventId) return;
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
          setAttendance(allData.find((a) => a.user_id === userId) ?? null);
        }
      } finally {
        refreshInFlight = false;
        if (pendingRefresh) {
          pendingRefresh = false;
          handleRealtimeChange();
        }
      }
    }

    const channelTopic = `training-att-${eventId}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_attendance',
          filter: `event_id=eq.${eventId}`,
        },
        () => void handleRealtimeChange()
      )
      .subscribe();

    return () => {
      channel.unsubscribe().finally(() => supabase.removeChannel(channel));
    };
  }, [eventId, userId, refreshSilent]);

  const setStatus = async (status: AttendanceStatus, onBehalfOfUserId?: string) => {
    const targetId = onBehalfOfUserId ?? userId;
    if (!userId || !targetId) return;
    setError(null);

    // ── Optimistic update ──
    // Capture previous state so we can revert on error.
    const prevAttendance = attendance;
    const prevEventAttendances = eventAttendances;

    const now = new Date().toISOString();
    const optimistic: TrainingAttendance = prevAttendance && targetId === userId
      ? { ...prevAttendance, status, updated_at: now }
      : {
          id: `opt-${targetId}-${Date.now()}`,
          event_id: eventId,
          user_id: targetId,
          status,
          created_at: now,
          updated_at: now,
          set_by: targetId === userId ? null : userId,
          set_by_profile: undefined,
          profile: undefined,
        };

    if (targetId === userId) {
      setAttendance(optimistic);
    }

    setEventAttendances((prev) =>
      prev.some((a) => a.user_id === targetId)
        ? prev.map((a) => (a.user_id === targetId ? { ...a, status, updated_at: now, set_by: optimistic.set_by, set_by_profile: optimistic.set_by_profile } : a))
        : [...prev, optimistic]
    );

    // Mirror into the module-level cache so a stale-while-revalidate hit
    // doesn't overwrite the optimistic value before the server responds.
    const cachedEntry = trainingCache.get(eventId);
    if (cachedEntry) {
      const updatedRows = cachedEntry.rows.some((a) => a.user_id === targetId)
        ? cachedEntry.rows.map((a) =>
            a.user_id === targetId ? { ...a, status, updated_at: now, set_by: optimistic.set_by } : a
          )
        : [...cachedEntry.rows, optimistic];
      trainingCache.set(eventId, { at: cachedEntry.at, rows: updatedRows });
      persistTrainingAttendance(eventId, { at: cachedEntry.at, rows: updatedRows });
    }
    // ── End optimistic update ──

    const doUpsert = () =>
      supabase
        .from('training_attendance')
        .upsert(
          { event_id: eventId, user_id: targetId, status, updated_at: now },
          { onConflict: 'event_id,user_id' }
        )
        .select()
        .single();

    setSubmitting(true);
    let { data, error: err } = await withDbTiming(
      'PUT',
      `training_attendance.setStatus user=${targetId} event=${eventId} status=${status}`,
      doUpsert
    );

    // 401 = JWT expired mid-session. Refresh the session and retry once.
    if (err && (err.code === 'PGRST301' || (err as { status?: number }).status === 401)) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        ({ data, error: err } = await withDbTiming(
          'PUT',
          `training_attendance.setStatus.retry user=${targetId} event=${eventId} status=${status}`,
          doUpsert
        ));
      }
    }
    setSubmitting(false);

    if (err) {
      // Revert optimistic changes on failure.
      setAttendance(prevAttendance);
      setEventAttendances(prevEventAttendances);
      setError(err.message);
      return;
    }

    if (targetId === userId && data) {
      setAttendance(data as TrainingAttendance);
    }

    // Fallback refresh — compensates for potentially missing realtime publication
    await refreshSilent();
  };

  return {
    attendance,
    eventAttendances,
    loading,
    submitting,
    error,
    setStatus,
    refresh: refreshSilent,
  };
}
