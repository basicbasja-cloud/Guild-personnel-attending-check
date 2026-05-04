import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import type { Profile } from '../types';

// ── localStorage cache ──────────────────────────────────────────────────────
const CACHE_KEY = 'gwm_profiles_v1';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Module-level in-memory cache — shared across all hook instances. */
let memCache: { at: number; profiles: Profile[] } | null = null;

function readLocalCache(): { at: number; profiles: Profile[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Guard against old cache format missing the profiles array
    if (!parsed || !Array.isArray(parsed.profiles)) return null;
    return parsed as { at: number; profiles: Profile[] };
  } catch {
    return null;
  }
}

function writeLocalCache(profiles: Profile[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), profiles }));
  } catch {
    // Ignore quota errors.
  }
}

async function fetchAndCache(): Promise<Profile[]> {
  const { data, error } = await withDbTiming('GET', 'profiles.all', () =>
    supabase
      .from('profiles')
      .select(
        'id,discord_id,username,avatar_url,character_name,character_class,is_management,is_admin,created_at'
      )
      .order('username')
  );
  if (error) throw error;
  const profiles = (data as Profile[] | null) ?? [];
  memCache = { at: Date.now(), profiles };
  writeLocalCache(profiles);
  return profiles;
}

/**
 * Kick off a background profile fetch and cache the result.
 * Call this once after login so the Management tab loads instantly.
 */
export async function preloadProfiles(): Promise<void> {
  if (memCache && Date.now() - memCache.at < CACHE_TTL_MS) return;
  const local = readLocalCache();
  if (local && Date.now() - local.at < CACHE_TTL_MS) {
    memCache = local;
    return;
  }
  await fetchAndCache().catch(() => {});
}

export function useAllProfiles(enabled = true) {
  // Seed immediately from in-memory or localStorage cache
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    if (memCache && Array.isArray(memCache.profiles)) return memCache.profiles;
    const local = readLocalCache();
    if (local && Array.isArray(local.profiles)) {
      memCache = local;
      return local.profiles;
    }
    return [];
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // Check if cache is still fresh — skip network call if so
    const isFresh = memCache !== null && Date.now() - memCache.at < CACHE_TTL_MS;
    if (isFresh) return;

    let cancelled = false;
    // Only show a loading spinner when there is no cached data at all.
    if (!memCache || memCache.profiles.length === 0) setLoading(true);

    fetchAndCache()
      .then((p) => {
        if (cancelled) return;
        setProfiles(p);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('useAllProfiles: failed to fetch profiles', error);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { profiles, loading };
}
