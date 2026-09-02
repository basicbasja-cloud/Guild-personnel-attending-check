import { useMemo, useState, useEffect } from 'react';
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

const PROFILE_SELECT_COLUMNS =
  'id,discord_id,username,avatar_url,character_name,character_class,main_skill_name,main_skill_level,sub_skill_name,sub_skill_level,is_management,is_admin,is_disabled,created_at';
// Fallback select for databases that haven't run supabase/patch_member_disabled.sql yet
const PROFILE_SELECT_COLUMNS_LEGACY = PROFILE_SELECT_COLUMNS.replace(',is_disabled', '');

async function fetchAndCache(): Promise<Profile[]> {
  let result = await withDbTiming('GET', 'profiles.all', () =>
    supabase
      .from('profiles')
      .select(PROFILE_SELECT_COLUMNS)
      .order('username')
  );

  // Graceful fallback: if the is_disabled column doesn't exist yet (patch not
  // applied), retry without it so the app keeps working — every member is
  // then treated as enabled until the SQL patch is run.
  const errMsg = (result.error as { message?: string } | null)?.message ?? '';
  if (result.error && errMsg.includes('is_disabled')) {
    console.warn('[useAllProfiles] is_disabled column missing — run supabase/patch_member_disabled.sql. Falling back to legacy select.');
    result = (await withDbTiming('GET', 'profiles.all.legacy', () =>
      supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS_LEGACY)
        .order('username')
    )) as typeof result;
  }

  if (result.error) throw result.error;
  const profiles = (result.data as Profile[] | null) ?? [];
  memCache = { at: Date.now(), profiles };
  writeLocalCache(profiles);
  return profiles;
}

/**
 * Remove a single profile from both in-memory and localStorage caches.
 * Call this after a successful account deletion so other pages update immediately.
 */
export function evictProfileFromCache(userId: string) {
  if (memCache) {
    const filtered = memCache.profiles.filter((p) => p.id !== userId);
    memCache = { at: memCache.at, profiles: filtered };
    writeLocalCache(filtered);
  } else {
    const local = readLocalCache();
    if (local) {
      const filtered = local.profiles.filter((p) => p.id !== userId);
      memCache = { at: local.at, profiles: filtered };
      writeLocalCache(filtered);
    }
  }
}

/**
 * Update a single profile in both in-memory and localStorage caches.
 * Call this after a successful profile mutation (role change, disable toggle, etc.)
 * so other pages update immediately.
 */
export function upsertProfileInCache(updated: Profile) {
  const apply = (list: Profile[]) => {
    const idx = list.findIndex((p) => p.id === updated.id);
    if (idx === -1) return list;
    const next = [...list];
    next[idx] = { ...next[idx], ...updated };
    return next;
  };
  if (memCache) {
    memCache = { at: memCache.at, profiles: apply(memCache.profiles) };
    writeLocalCache(memCache.profiles);
  } else {
    const local = readLocalCache();
    if (local) {
      memCache = { at: local.at, profiles: apply(local.profiles) };
      writeLocalCache(memCache.profiles);
    }
  }
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
  await fetchAndCache().catch((err) => { console.error('[preloadProfiles]', err); });
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

/** Guard for old cached rows that may be missing the is_disabled flag. */
export function isMemberDisabled(p: Pick<Profile, 'is_disabled'> | null | undefined): boolean {
  return p?.is_disabled === true;
}

/**
 * Set of user_ids currently marked as disabled.
 * Shares the useAllProfiles cache, so it's free wherever profiles are loaded.
 */
export function useDisabledUserIds(enabled = true): Set<string> {
  const { profiles } = useAllProfiles(enabled);
  return useMemo(
    () => new Set(profiles.filter(isMemberDisabled).map((p) => p.id)),
    [profiles]
  );
}
