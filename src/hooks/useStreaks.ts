import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StreakData {
  streak: number;
  bestStreak: number;
}

export interface StreakLeaderboardEntry {
  user_id: string;
  username: string;
  character_name: string | null;
  streak: number;
}

// ── Cache ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 1 min — streaks change in real time
const CACHE_KEY_PREFIX = 'gwm_streak_';

const memCache = new Map<string, { at: number; data: unknown }>();

function cacheKey(userId: string) { return `${CACHE_KEY_PREFIX}${userId}`; }

function readCache<T>(key: string): T | null {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return mem.data as T;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
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

// ── Compute streak for a single user ────────────────────────────────────────

async function fetchStreak(userId: string): Promise<StreakData> {
  const { data, error } = await supabase
    .from('attendance')
    .select('week_start, status')
    .eq('user_id', userId)
    .eq('status', 'join')
    .order('week_start', { ascending: false });

  if (error) throw error;

  const weeks = (data as { week_start: string }[] ?? []).map((r) => r.week_start);
  let streak = 0;
  let bestStreak = 0;
  let currentRun = 0;

  // Sort descending
  const sorted = [...new Set(weeks)].sort().reverse();

  // Calculate current streak (consecutive from most recent)
  if (sorted.length > 0) {
    const today = new Date();
    const mostRecent = new Date(sorted[0]);
    const diffDays = Math.round((today.getTime() - mostRecent.getTime()) / 86400000);
    // If most recent attendance is within the last 14 days, count streak
    if (diffDays <= 14) {
      streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const gap = Math.round((prev.getTime() - curr.getTime()) / 86400000);
        if (gap === 7) streak++;
        else break;
      }
    }
  }

  // Calculate best streak (all-time)
  const allSorted = [...new Set(weeks)].sort();
  if (allSorted.length > 0) {
    currentRun = 1;
    bestStreak = 1;
    for (let i = 1; i < allSorted.length; i++) {
      const prev = new Date(allSorted[i - 1]);
      const curr = new Date(allSorted[i]);
      const gap = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (gap === 7) {
        currentRun++;
        bestStreak = Math.max(bestStreak, currentRun);
      } else {
        currentRun = 1;
      }
    }
  }

  return { streak, bestStreak };
}

// ── Compute leaderboard ─────────────────────────────────────────────────────

async function fetchLeaderboard(): Promise<StreakLeaderboardEntry[]> {
  // Get all users who have joined at least once
  let result = await supabase
    .from('attendance')
    .select('user_id, week_start, status, profile:profiles!user_id(username, character_name, is_disabled)')
    .eq('status', 'join')
    .order('week_start', { ascending: false });

  // Graceful fallback if the is_disabled column doesn't exist yet
  // (supabase/patch_member_disabled.sql not applied)
  if (result.error && (result.error.message ?? '').includes('is_disabled')) {
    result = (await supabase
      .from('attendance')
      .select('user_id, week_start, status, profile:profiles!user_id(username, character_name)')
      .eq('status', 'join')
      .order('week_start', { ascending: false })) as typeof result;
  }

  const { data, error } = result;
  if (error) throw error;

  // Group by user (disabled members are excluded from streak calculations)
  const userMap = new Map<string, { weeks: string[]; username: string; character_name: string | null }>();
  for (const row of data as unknown as {
    user_id: string;
    week_start: string;
    profile: { username: string; character_name: string | null; is_disabled: boolean | null } | null;
  }[]) {
    if (row.profile?.is_disabled === true) continue;
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        weeks: [],
        username: row.profile?.username ?? 'Unknown',
        character_name: row.profile?.character_name ?? null,
      });
    }
    userMap.get(row.user_id)!.weeks.push(row.week_start);
  }

  // Compute streak for each user
  const entries: StreakLeaderboardEntry[] = [];
  for (const [userId, data] of userMap) {
    const sorted = [...new Set(data.weeks)].sort().reverse();
    let streak = 0;
    if (sorted.length > 0) {
      const today = new Date();
      const mostRecent = new Date(sorted[0]);
      const diffDays = Math.round((today.getTime() - mostRecent.getTime()) / 86400000);
      if (diffDays <= 14) {
        streak = 1;
        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(sorted[i - 1]);
          const curr = new Date(sorted[i]);
          const gap = Math.round((prev.getTime() - curr.getTime()) / 86400000);
          if (gap === 7) streak++;
          else break;
        }
      }
    }
    if (streak > 0) {
      entries.push({
        user_id: userId,
        username: data.username,
        character_name: data.character_name,
        streak,
      });
    }
  }

  return entries.sort((a, b) => b.streak - a.streak).slice(0, 10);
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useStreak(userId: string | null): {
  streak: StreakData;
  loading: boolean;
  refresh: () => void;
} {
  const [streak, setStreak] = useState<StreakData>({ streak: 0, bestStreak: 0 });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!userId) return;
    const key = cacheKey(userId);
    const cached = readCache<StreakData>(key);
    if (cached) {
      setStreak(cached);
      setLoading(false);
    }
    setLoading(true);
    fetchStreak(userId).then((data) => {
      writeCache(key, data);
      setStreak(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const key = cacheKey(userId);
    const cached = readCache<StreakData>(key);
    if (cached) {
      setStreak(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchStreak(userId).then((data) => {
      writeCache(key, data);
      setStreak(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  return { streak, loading, refresh };
}

export function useStreakLeaderboard(): {
  entries: StreakLeaderboardEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = useState<StreakLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = `${CACHE_KEY_PREFIX}leaderboard`;
    const cached = readCache<StreakLeaderboardEntry[]>(key);
    if (cached) {
      setEntries(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchLeaderboard().then((data) => {
      writeCache(key, data);
      setEntries(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return { entries, loading };
}
