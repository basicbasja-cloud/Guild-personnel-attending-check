import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  author_username?: string;
}

// ── Cache ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'gwm_announcements';

let memCacheData: Announcement[] | null = null;
let memCacheAt = 0;

function readCache(): Announcement[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Announcement[];
  } catch { return null; }
}

function writeCache(data: Announcement[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseAnnouncementsResult {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  create: (title: string, content: string, pinned: boolean) => Promise<boolean>;
  update: (id: string, title: string, content: string, pinned: boolean) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useAnnouncements(isManagement: boolean, userId?: string): UseAnnouncementsResult {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const cached = readCache();
    if (cached) {
      memCacheData = cached;
      memCacheAt = Date.now();
      return cached;
    }
    return [];
  });
  const [loading, setLoading] = useState(!memCacheData || Date.now() - memCacheAt > CACHE_TTL_MS);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('announcements')
        .select('*, profiles!created_by(username)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) throw err;

      const mapped = (data ?? []).map((row: Record<string, unknown>) => {
        const profileArr = row.profiles as { username?: string }[] | undefined;
        return {
          id: row.id as string,
          title: row.title as string,
          content: row.content as string,
          created_by: row.created_by as string,
          pinned: row.pinned as boolean,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          author_username: profileArr?.[0]?.username ?? 'Unknown',
        };
      });

      memCacheData = mapped;
      memCacheAt = Date.now();
      writeCache(mapped);
      setAnnouncements(mapped);
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load announcements');
      setLoading(false);
    }
  }, []);

  // ── Initial fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch();
  }, [fetch]);

  // ── Realtime subscription ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('announcements-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Refetch on any change
          fetch();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetch]);

  // ── Create ──────────────────────────────────────────────────────────────
  const create = useCallback(async (
    title: string,
    content: string,
    pinned: boolean,
  ): Promise<boolean> => {
    if (!isManagement) return false;

    // Optimistic update
    const temp: Announcement = {
      id: `temp-${Date.now()}`,
      title,
      content,
      created_by: '',
      pinned,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author_username: 'You',
    };
    setAnnouncements((prev) => [temp, ...prev]);

    try {
      const insertPayload: Record<string, unknown> = {
        title,
        content,
        pinned,
      };
      if (userId) insertPayload.created_by = userId;
      const { error: err } = await supabase.from('announcements').insert(insertPayload);
      if (err) throw err;
      await fetch(); // Refresh to get real IDs
      return true;
    } catch (e: unknown) {
      // Rollback
      setAnnouncements((prev) => prev.filter((a) => a.id !== temp.id));
      console.error('[Announcements] Create error:', e);
      setError(e instanceof Error ? e.message : 'Failed to create announcement');
      return false;
    }
  }, [isManagement, fetch]);

  // ── Update ──────────────────────────────────────────────────────────────
  const update = useCallback(async (
    id: string,
    title: string,
    content: string,
    pinned: boolean,
  ): Promise<boolean> => {
    if (!isManagement) return false;

    // Optimistic update
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, title, content, pinned } : a)),
    );

    try {
      const { error: err } = await supabase
        .from('announcements')
        .update({ title, content, pinned, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
      return true;
    } catch (e: unknown) {
      await fetch(); // Rollback by refetching
      setError(e instanceof Error ? e.message : 'Failed to update announcement');
      return false;
    }
  }, [isManagement, fetch]);

  // ── Delete ──────────────────────────────────────────────────────────────
  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (!isManagement) return false;

    // Optimistic removal
    const prev = announcements;
    setAnnouncements((a) => a.filter((x) => x.id !== id));

    try {
      const { error: err } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      if (err) throw err;
      return true;
    } catch (e: unknown) {
      setAnnouncements(prev); // Rollback
      setError(e instanceof Error ? e.message : 'Failed to delete announcement');
      return false;
    }
  }, [isManagement, announcements]);

  return { announcements, loading, error, create, update, remove };
}
