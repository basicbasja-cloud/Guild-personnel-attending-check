import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { formatISO } from 'date-fns';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MemberOfWeek {
  id: string;
  user_id: string;
  week_start: string;
  nominated_by: string | null;
  reason: string | null;
  created_at: string;
  profile?: {
    username: string;
    character_name: string | null;
    avatar_url: string | null;
    character_class: string | null;
  } | null;
  nominator?: {
    username: string;
  } | null;
}

// ── Cache ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'gwm_motw_current';

const memCache: { at: number; data: MemberOfWeek | null } = { at: 0, data: null };

function readCache(): MemberOfWeek | null {
  if (memCache.data && Date.now() - memCache.at < CACHE_TTL_MS) return memCache.data;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.at < CACHE_TTL_MS) {
      memCache.at = parsed.at;
      memCache.data = parsed.data;
      return parsed.data;
    }
    return null;
  } catch { return null; }
}

function writeCache(data: MemberOfWeek | null) {
  memCache.at = Date.now();
  memCache.data = data;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* quota */ }
}

function getCurrentWeekStart(): string {
  return formatISO(new Date(), { representation: 'date' });
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseMemberOfWeekResult {
  current: MemberOfWeek | null;
  loading: boolean;
  error: string | null;
  nominate: (userId: string, reason: string) => Promise<boolean>;
  remove: () => Promise<boolean>;
  refresh: () => void;
}

export function useMemberOfWeek(isManagement: boolean): UseMemberOfWeekResult {
  const [current, setCurrent] = useState<MemberOfWeek | null>(() => readCache());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrent = useCallback(async () => {
    const weekStart = getCurrentWeekStart();
    try {
      const { data, error: err } = await supabase
        .from('member_of_week')
        .select(`
          *,
          profile:user_id(username, character_name, avatar_url, character_class),
          nominator:nominated_by(username)
        `)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (err) {
        console.warn('[MotW] Fetch error:', err.message);
      }
      const motw = (data as MemberOfWeek | null) ?? null;
      writeCache(motw);
      setCurrent(motw);
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setCurrent(cached);
      setLoading(false);
    }
    fetchCurrent();
  }, [fetchCurrent]);

  // Realtime subscription — unique channel name per instance
  useEffect(() => {
    const chName = `motw-rt-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(chName)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'member_of_week' },
        () => { fetchCurrent(); },
      )
      .subscribe();
    return () => { channel.unsubscribe().finally(() => supabase.removeChannel(channel)); };
  }, [fetchCurrent]);

  const nominate = useCallback(async (userId: string, reason: string): Promise<boolean> => {
    if (!isManagement) return false;
    const weekStart = getCurrentWeekStart();

    // Optimistic update with profile info from a quick fetch
    let tempProfile: MemberOfWeek['profile'] = null;
    try {
      const { data: p } = await supabase
        .from('profiles')
        .select('username, character_name, avatar_url, character_class')
        .eq('id', userId)
        .single();
      tempProfile = p as MemberOfWeek['profile'];
    } catch { /* ignore */ }

    const temp: MemberOfWeek = {
      id: `temp-${Date.now()}`,
      user_id: userId,
      week_start: weekStart,
      nominated_by: null,
      reason,
      created_at: new Date().toISOString(),
      profile: tempProfile,
    };
    setCurrent(temp);

    try {
      // Delete existing nomination for this week first (RLS has DELETE but no UPDATE policy)
      const { error: delErr } = await supabase
        .from('member_of_week')
        .delete()
        .eq('week_start', weekStart);
      if (delErr) throw delErr;

      // Then insert the new one
      const { error: insErr } = await supabase
        .from('member_of_week')
        .insert({
          user_id: userId,
          week_start: weekStart,
          reason,
        });
      if (insErr) throw insErr;

      await fetchCurrent();
      return true;
    } catch (e: unknown) {
      await fetchCurrent(); // Rollback
      setError(e instanceof Error ? e.message : 'Failed to nominate');
      return false;
    }
  }, [isManagement, fetchCurrent]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isManagement || !current) return false;
    const prev = current;
    setCurrent(null);

    try {
      const { error: err } = await supabase
        .from('member_of_week')
        .delete()
        .eq('id', current.id);
      if (err) throw err;
      writeCache(null);
      return true;
    } catch {
      setCurrent(prev); // Rollback
      return false;
    }
  }, [isManagement, current]);

  return { current, loading, error, nominate, remove, refresh: fetchCurrent };
}
