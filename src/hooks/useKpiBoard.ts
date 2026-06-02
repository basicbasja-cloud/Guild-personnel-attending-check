import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUpcomingSaturday } from '../lib/week';
import { formatISO } from 'date-fns';
import type { KpiBoardRow } from '../types';

// ── In-memory + localStorage cache ───────────────────────────────────────────
// Cache is keyed by week_start so different weeks are independent.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — board refreshes after stats entry
const CACHE_PREFIX = 'gwm_kpi_board_v1_';

const memCache = new Map<string, { at: number; rows: KpiBoardRow[] }>();

function readLocalCache(key: string): { at: number; rows: KpiBoardRow[] } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return parsed as { at: number; rows: KpiBoardRow[] };
  } catch {
    return null;
  }
}

function writeLocalCache(key: string, rows: KpiBoardRow[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), rows }));
  } catch {
    // Ignore quota errors.
  }
}

function cacheKey(weekStart: string) {
  return `${CACHE_PREFIX}${weekStart}`;
}

async function fetchBoard(weekStart: string): Promise<KpiBoardRow[]> {
  const { data, error } = await supabase.rpc('get_kpi_public_board', {
    target_week_start: weekStart,
  });
  if (error) throw error;
  const rows = (data as KpiBoardRow[]) ?? [];
  const key = cacheKey(weekStart);
  memCache.set(key, { at: Date.now(), rows });
  writeLocalCache(key, rows);
  return rows;
}

/**
 * Preload the current week's KPI board into cache.
 * Call after login so the tab opens instantly.
 */
export async function preloadKpiBoard(): Promise<void> {
  const weekStart = formatISO(getUpcomingSaturday(new Date()), { representation: 'date' });
  const key = cacheKey(weekStart);
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return;
  const local = readLocalCache(key);
  if (local && Date.now() - local.at < CACHE_TTL_MS) {
    memCache.set(key, local);
    return;
  }
  await fetchBoard(weekStart).catch((err) => { console.error('[preloadKpiBoard]', err); });
}

/** Invalidate cache for a specific week (call after saving stats). */
export function invalidateKpiBoardCache(weekStart: string) {
  const key = cacheKey(weekStart);
  memCache.delete(key);
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────



interface UseKpiBoardResult {
  rows: KpiBoardRow[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useKpiBoard(weekStart: string): UseKpiBoardResult {
  const [rows, setRows]           = useState<KpiBoardRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tick, setTick]           = useState(0);

  const refresh = useCallback(() => {
    invalidateKpiBoardCache(weekStart);
    setTick((t) => t + 1);
  }, [weekStart]);

  useEffect(() => {
    let cancelled = false;
    const key = cacheKey(weekStart);

    // Serve from cache immediately while fetching in background
    const mem = memCache.get(key);
    if (mem) {
      setRows(mem.rows);
      setLoading(false);
      if (Date.now() - mem.at < CACHE_TTL_MS) return; // still fresh
    } else {
      const local = readLocalCache(key);
      if (local) {
        memCache.set(key, local);
        setRows(local.rows);
        setLoading(false);
        if (Date.now() - local.at < CACHE_TTL_MS) return; // still fresh
      }
    }

    // Fetch (stale-while-revalidate or first load)
    setLoading(true);
    setError(null);

    fetchBoard(weekStart)
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
  }, [weekStart, tick]);

  return { rows, loading, error, refresh };
}
