import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { GuildEvent } from '../types';

const CACHE_KEY = 'gwm_events_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface EventsCache {
  at: number;
  events: GuildEvent[];
}

// In-memory layer — avoids localStorage JSON parse on every hook mount
let memCache: EventsCache | null = null;

function readCache(): EventsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EventsCache;
  } catch {
    return null;
  }
}

function writeCache(events: GuildEvent[]) {
  const entry: EventsCache = { at: Date.now(), events };
  memCache = entry;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /**/ }
}

/** Preload called in App.tsx as soon as the user authenticates */
export async function preloadGuildEvents() {
  if (memCache && Date.now() - memCache.at < CACHE_TTL_MS) return;
  const cached = readCache();
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) { memCache = cached; return; }
  const { data, error } = await supabase
    .from('guild_events')
    .select('*')
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) {
    console.error('[useGuildEvents] preload:', error);
    return;
  }
  if (data) writeCache(data as GuildEvent[]);
}

export interface UseGuildEventsReturn {
  events: GuildEvent[];
  loading: boolean;
  refresh: () => Promise<void>;
  createEvent: (
    payload: Omit<GuildEvent, 'id' | 'created_at' | 'updated_at'>,
  ) => Promise<void>;
  updateEvent: (
    id: string,
    patch: Partial<Omit<GuildEvent, 'id' | 'created_at' | 'updated_at'>>,
  ) => Promise<void>;
  updateEventDate: (id: string, eventDate: string | null) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export function useGuildEvents(): UseGuildEventsReturn {
  const [events, setEvents] = useState<GuildEvent[]>(() => {
    // RAM first, then localStorage
    const hot = memCache ?? readCache();
    if (hot) memCache = hot;
    return hot?.events ?? [];
  });
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guild_events')
      .select('*')
      .order('event_date', { ascending: true, nullsFirst: false });
    setLoading(false);
    if (error) {
      console.error('[useGuildEvents] fetchAll:', error);
      return;
    }
    if (data) {
      const evs = data as GuildEvent[];
      setEvents(evs);
      writeCache(evs);
    }
  }, []);

  // Initial load — skip if fresh cache
  useEffect(() => {
    const hot = memCache;
    if (hot && Date.now() - hot.at < CACHE_TTL_MS) {
      setEvents(hot.events);
      return;
    }
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription — use unique channel name per hook instance
  const channelNameRef = useRef(`guild_events_rt_${Math.random().toString(36).slice(2, 10)}`);
  useEffect(() => {
    const chName = channelNameRef.current;
    const channel = supabase
      .channel(chName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guild_events' }, () => fetchAll())
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe().finally(() => supabase.removeChannel(channel));
    };
  }, [fetchAll]);

  const createEvent = useCallback(async (payload: Omit<GuildEvent, 'id' | 'created_at' | 'updated_at'>) => {
    const tempId = `tmp_${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: GuildEvent = { ...payload, id: tempId, created_at: now, updated_at: now };
    setEvents((prev) => { const next = [...prev, optimistic]; writeCache(next); return next; });
    const { data, error } = await supabase.from('guild_events').insert(payload).select().single();
    if (error) {
      console.error('[useGuildEvents] createEvent:', error);
      setEvents((prev) => { const next = prev.filter((e) => e.id !== tempId); writeCache(next); return next; });
    } else {
      const saved = data as GuildEvent;
      // Auto-create announcement for training events
      if (saved.event_type === 'training') {
        const dateStr = saved.event_date
          ? new Date(saved.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : '';
        const timeStr = saved.start_time ? ` at ${saved.start_time}` : '';
        supabase.from('announcements').insert({
          title: `🏋️ Training: ${saved.title}`,
          content: `A new training session has been scheduled${dateStr ? ` on **${dateStr}**` : ''}${timeStr}.\n\nCheck the calendar and set your attendance!`,
          created_by: saved.created_by,
          pinned: false,
        }).then(() => {}, () => {});
      }
      setEvents((prev) => { const next = prev.map((e) => e.id === tempId ? saved : e); writeCache(next); return next; });
    }
  }, []);

  const updateEvent = useCallback(async (id: string, patch: Partial<Omit<GuildEvent, 'id' | 'created_at' | 'updated_at'>>) => {
    const now = new Date().toISOString();
    setEvents((prev) => {
      const next = prev.map((e) => e.id === id ? { ...e, ...patch, updated_at: now } : e);
      writeCache(next);
      return next;
    });
    const { error } = await supabase.from('guild_events').update({ ...patch, updated_at: now }).eq('id', id);
    if (error) console.error('[useGuildEvents] updateEvent:', error);
  }, []);

  const updateEventDate = useCallback(async (id: string, eventDate: string | null) => {
    await updateEvent(id, { event_date: eventDate });
  }, [updateEvent]);

  const deleteEvent = useCallback(async (id: string) => {
    setEvents((prev) => { const next = prev.filter((e) => e.id !== id); writeCache(next); return next; });
    const { error } = await supabase.from('guild_events').delete().eq('id', id);
    if (error) console.error('[useGuildEvents] deleteEvent:', error);
  }, []);

  return { events, loading, refresh: fetchAll, createEvent, updateEvent, updateEventDate, deleteEvent };
}
