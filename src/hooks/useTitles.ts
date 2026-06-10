import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Title {
  id: string;
  name: string;
  description: string | null;
  icon_emoji: string;
  is_auto: boolean;
  rule_trigger: string | null;
}

export interface UserTitle {
  id: string;
  user_id: string;
  title_id: string;
  earned_at: string;
  is_active: boolean;
  is_auto: boolean;
  title?: Title;
}

// ── Cache ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const ALL_TITLES_KEY = 'gwm_titles';
const USER_TITLES_PREFIX = 'gwm_user_titles_';

const memCache = new Map<string, { at: number; data: unknown }>();

function readCache<T>(key: string): T | null {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return mem.data as T;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.at < CACHE_TTL_MS) {
      memCache.set(key, { at: parsed.at, data: parsed.data });
      return parsed.data;
    }
    return null;
  } catch { return null; }
}

function writeCache<T>(key: string, data: T) {
  memCache.set(key, { at: Date.now(), data });
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* quota */ }
}

// ── API calls ───────────────────────────────────────────────────────────────

async function fetchAllTitles(): Promise<Title[]> {
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data as Title[]) ?? [];
}

async function fetchUserTitles(userId: string): Promise<UserTitle[]> {
  const { data, error } = await supabase
    .from('user_titles')
    .select('*, title:titles(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data as UserTitle[]) ?? [];
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useAllTitles(): {
  titles: Title[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [titles, setTitles] = useState<Title[]>(() => readCache<Title[]>(ALL_TITLES_KEY) ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchAllTitles().then((data) => {
      writeCache(ALL_TITLES_KEY, data);
      setTitles(data);
      setLoading(false);
    }).catch((e) => {
      setError(e instanceof Error ? e.message : 'Failed to load titles');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const cached = readCache<Title[]>(ALL_TITLES_KEY);
    if (cached) {
      setTitles(cached);
      setLoading(false);
    }
    refresh();
  }, [refresh]);

  return { titles, loading, error, refresh };
}

export function useUserTitles(userId: string | null): {
  userTitles: UserTitle[];
  activeTitle: UserTitle | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setActive: (titleId: string) => Promise<boolean>;
} {
  const [userTitles, setUserTitles] = useState<UserTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = userId ? `${USER_TITLES_PREFIX}${userId}` : '';

  const refresh = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    fetchUserTitles(userId).then((data) => {
      writeCache(key, data);
      setUserTitles(data);
      setLoading(false);
    }).catch((e) => {
      setError(e instanceof Error ? e.message : 'Failed to load titles');
      setLoading(false);
    });
  }, [userId, key]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const cached = readCache<UserTitle[]>(key);
    if (cached) {
      setUserTitles(cached);
      setLoading(false);
    }
    refresh();
  }, [userId, key, refresh]);

  const activeTitle = userTitles.find((t) => t.is_active) ?? null;

  const setActive = useCallback(async (titleId: string): Promise<boolean> => {
    if (!userId) return false;

    // Optimistic update
    setUserTitles((prev) =>
      prev.map((t) => ({ ...t, is_active: t.title_id === titleId })),
    );

    // Deactivate all, then activate the selected one
    try {
      await supabase
        .from('user_titles')
        .update({ is_active: false })
        .eq('user_id', userId);

      const { error: err } = await supabase
        .from('user_titles')
        .update({ is_active: true })
        .eq('user_id', userId)
        .eq('title_id', titleId);

      if (err) throw err;
      return true;
    } catch {
      await refresh(); // Rollback
      return false;
    }
  }, [userId, refresh]);

  return { userTitles, activeTitle, loading, error, refresh, setActive };
}
