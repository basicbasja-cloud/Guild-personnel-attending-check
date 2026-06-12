import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import type { TrainingAttendance, AttendanceStatus, Profile } from '../types';

// ── Cache ──────────────────────────────────────────────────────────────────
const TRAINING_CACHE_TTL_MS = 10 * 60 * 1000;
const trainingCache = new Map<string, { at: number; rows: TrainingAttendance[] }>();
const activeFetches = new Map<string, Promise<TrainingAttendance[]>>();

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
    trainingCache.set(eventId, { at: Date.now(), rows });
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

    const cached = trainingCache.get(eventId);
    if (cached && cached.rows.length > 0) {
      setEventAttendances(cached.rows);
      if (userId) {
        setAttendance(cached.rows.find((a) => a.user_id === userId) ?? null);
      }
    }

    setLoading(!(cached && cached.rows.length > 0));

    const doFetch = async () => {
      const rows = await refreshSilent();
      if (cancelled) return;
      if (userId) setAttendance(rows.find((a) => a.user_id === userId) ?? null);
      setLoading(false);
    };

    if (!cached || Date.now() - cached.at >= TRAINING_CACHE_TTL_MS) {
      doFetch();
    } else {
      setLoading(false);
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

  const setStatus = useCallback(
    async (status: AttendanceStatus, onBehalfOfUserId?: string) => {
      if (!userId && !onBehalfOfUserId) return;
      const targetUserId = onBehalfOfUserId ?? userId!;
      setSubmitting(true);
      setError(null);

      // Optimistic update
      const now = new Date().toISOString();
      const optimistic: TrainingAttendance = {
        id: `opt-${targetUserId}`,
        event_id: eventId,
        user_id: targetUserId,
        status,
        created_at: now,
        updated_at: now,
        set_by: targetUserId === userId ? null : userId,
        set_by_profile: undefined,
        profile: undefined,
      };

      setAttendance(optimistic);
      setEventAttendances((prev) => {
        const idx = prev.findIndex((a) => a.user_id === targetUserId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], status, updated_at: now };
          return next;
        }
        return [...prev, optimistic];
      });

      const { error: err } = await supabase.from('training_attendance').upsert(
        {
          event_id: eventId,
          user_id: targetUserId,
          status,
        },
        { onConflict: 'event_id,user_id' }
      );

      setSubmitting(false);
      if (err) {
        setError(err.message);
        await refreshSilent();
      }
    },
    [eventId, userId, refreshSilent]
  );

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
