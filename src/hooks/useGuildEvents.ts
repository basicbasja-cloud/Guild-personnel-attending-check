import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { GuildEvent } from '../types';

const CACHE_KEY = 'gwm_events_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface EventsCache {
  at: number;
  events: GuildEvent[];
}

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
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), events })); } catch { /**/ }
}

/** Preload called in App.tsx as soon as the user authenticates */
export async function preloadGuildEvents() {
  const cached = readCache();
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return;
  const { data, error } = await supabase
    .from('guild_events')
    .select('*')
    .order('event_date', { ascending: true, nullsFirst: false });
  if (!error && data) writeCache(data as GuildEvent[]);
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
  const [events, setEvents] = useState<GuildEvent[]>(() => readCache()?.events ?? []);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guild_events')
      .select('*')
      .order('event_date', { ascending: true, nullsFirst: false });
    setLoading(false);
    if (!error && data) {
      const evs = data as GuildEvent[];
      setEvents(evs);
      writeCache(evs);
    }
  }, []);

  // Initial load — skip if fresh cache
  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setEvents(cached.events);
      return;
    }
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    channelRef.current = supabase
      .channel('guild_events_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guild_events' }, () => fetchAll())
      .subscribe();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchAll]);

  const createEvent = useCallback(async (payload: Omit<GuildEvent, 'id' | 'created_at' | 'updated_at'>) => {
    const tempId = `tmp_${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: GuildEvent = { ...payload, id: tempId, created_at: now, updated_at: now };
    setEvents((prev) => { const next = [...prev, optimistic]; writeCache(next); return next; });
    const { data, error } = await supabase.from('guild_events').insert(payload).select().single();
    if (error) {
      setEvents((prev) => { const next = prev.filter((e) => e.id !== tempId); writeCache(next); return next; });
    } else {
      const saved = data as GuildEvent;
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
    await supabase.from('guild_events').update({ ...patch, updated_at: now }).eq('id', id);
  }, []);

  const updateEventDate = useCallback(async (id: string, eventDate: string | null) => {
    await updateEvent(id, { event_date: eventDate });
  }, [updateEvent]);

  const deleteEvent = useCallback(async (id: string) => {
    setEvents((prev) => { const next = prev.filter((e) => e.id !== id); writeCache(next); return next; });
    await supabase.from('guild_events').delete().eq('id', id);
  }, []);

  return { events, loading, refresh: fetchAll, createEvent, updateEvent, updateEventDate, deleteEvent };
}
