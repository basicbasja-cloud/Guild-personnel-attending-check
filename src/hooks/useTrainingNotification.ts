import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { GuildEvent } from '../types';

const TRAINING_NOTIF_KEY = 'gwm_training_notif_dismissed';

interface TrainingNotification {
  event: GuildEvent;
  timestamp: number;
}

/**
 * Hook that listens for new training events via Supabase realtime.
 * Shows a floating toast notification when a new training event is created.
 */
export function useTrainingNotification(currentUserId: string) {
  const [notification, setNotification] = useState<TrainingNotification | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear notification after 10 seconds
  const clearNotif = useCallback(() => {
    setDismissed(true);
    setNotification(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearNotif();
    try { localStorage.setItem(TRAINING_NOTIF_KEY, String(Date.now())); } catch { /* */ }
  }, [clearNotif]);

  useEffect(() => {
    // Only subscribe if user is authenticated
    if (!currentUserId) return;

    const channel = supabase
      .channel('training-events-notif')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guild_events',
          filter: `event_type=eq.training`,
        },
        (payload) => {
          const event = payload.new as GuildEvent;
          // Don't notify about own events
          if (event.created_by === currentUserId) return;

          // Check if user dismissed recently
          try {
            const lastDismiss = localStorage.getItem(TRAINING_NOTIF_KEY);
            if (lastDismiss && Date.now() - Number(lastDismiss) < 60000) return; // 1 min cooldown
          } catch { /* */ }

          setDismissed(false);
          setNotification({ event, timestamp: Date.now() });

          // Auto-clear after 10 seconds
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(clearNotif, 10000);
        }
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      channel.unsubscribe().finally(() => supabase.removeChannel(channel));
    };
  }, [currentUserId, clearNotif]);

  return { notification, dismissed, dismiss };
}

/**
 * Check if there are any training events created in the last 24h
 * (for the calendar tab badge).
 */
export function hasRecentTrainingEvent(events: GuildEvent[]): boolean {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return events.some(
    (e) =>
      e.event_type === 'training' &&
      new Date(e.created_at).getTime() > oneDayAgo
  );
}
