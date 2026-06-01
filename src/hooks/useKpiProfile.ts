import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { KpiProfileRow } from '../types';

// ── In-memory + localStorage cache ───────────────────────────────────────────
// Profile data is per-user; cache TTL 15 min (matches useAllProfiles).
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_PREFIX = 'gwm_kpi_profile_v1_';

const memCache = new Map<string, { at: number; rows: KpiProfileRow[] }>();

function readLocalCache(key: string): { at: number; rows: KpiProfileRow[] } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return parsed as { at: number; rows: KpiProfileRow[] };
  } catch {
    return null;
  }
}

function writeLocalCache(key: string, rows: KpiProfileRow[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), rows }));
  } catch {
    // Ignore quota errors.
  }
}

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

async function fetchProfile(userId: string, maxWeeks: number): Promise<KpiProfileRow[]> {
  const { data, error } = await supabase.rpc('get_kpi_profile', {
    target_user_id: userId,
    max_weeks: maxWeeks,
  });
  if (error) throw error;
  const rows = (data as KpiProfileRow[]) ?? [];
  const key = cacheKey(userId);
  memCache.set(key, { at: Date.now(), rows });
  writeLocalCache(key, rows);
  return rows;
}

/** Invalidate a user's profile cache (call after stats are saved for them). */
export function invalidateKpiProfileCache(userId: string) {
  const key = cacheKey(userId);
  memCache.delete(key);
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

/**
 * Preload KPI profile for a specific user (call on login for the current user).
 * No-ops if a fresh cache entry already exists.
 */
export async function preloadKpiProfile(userId: string, maxWeeks = 8): Promise<void> {
  const key = cacheKey(userId);
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return;
  const local = readLocalCache(key);
  if (local && Date.now() - local.at < CACHE_TTL_MS) { memCache.set(key, local); return; }
  await fetchProfile(userId, maxWeeks).catch((err) => console.error('[preloadKpiProfile]', err));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseKpiProfileResult {
  rows: KpiProfileRow[];
  loading: boolean;
  error: string | null;
}

export function useKpiProfile(
  userId: string | null,
  maxWeeks = 8,
): UseKpiProfileResult {
  const [rows, setRows]       = useState<KpiProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setRows([]); return; }
    let cancelled = false;
    const key = cacheKey(userId);

    // Serve stale cache instantly, then revalidate in background
    const mem = memCache.get(key);
    if (mem) {
      setRows(mem.rows);
      setLoading(false);
      if (Date.now() - mem.at < CACHE_TTL_MS) return;
    } else {
      const local = readLocalCache(key);
      if (local) {
        memCache.set(key, local);
        setRows(local.rows);
        setLoading(false);
        if (Date.now() - local.at < CACHE_TTL_MS) return;
      }
    }

    setLoading(true);
    setError(null);

    fetchProfile(userId, maxWeeks)
      .then((fresh) => {
        if (cancelled) return;
        setRows(fresh);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, maxWeeks]);

  return { rows, loading, error };
}
