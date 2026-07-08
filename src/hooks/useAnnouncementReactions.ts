import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { AnnouncementReaction, ReactionSummary } from '../types';

const REACTIONS_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '😡'] as const;

interface UseAnnouncementReactionsResult {
  /** Per-announcement reaction summaries */
  summaries: Map<string, ReactionSummary[]>;
  loading: boolean;
  /** Toggle a reaction for the current user on an announcement */
  toggle: (announcementId: string, emoji: string) => Promise<void>;
}

export function useAnnouncementReactions(userId: string | undefined): UseAnnouncementReactionsResult {
  const [allReactions, setAllReactions] = useState<Map<string, AnnouncementReaction[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcement_reactions')
      .select('*')
      .order('created_at');

    if (error) {
      console.error('[useAnnouncementReactions] fetch:', error);
      return;
    }

    const byAnnouncement = new Map<string, AnnouncementReaction[]>();
    for (const r of (data ?? []) as AnnouncementReaction[]) {
      const list = byAnnouncement.get(r.announcement_id) ?? [];
      list.push(r);
      byAnnouncement.set(r.announcement_id, list);
    }
    setAllReactions(byAnnouncement);
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('announcement-reactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcement_reactions' },
        () => { fetchAll(); }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const toggle = useCallback(async (announcementId: string, emoji: string) => {
    if (!userId) return;

    // Check if user already has this reaction
    const existing = allReactions.get(announcementId)?.find(
      (r) => r.user_id === userId && r.emoji === emoji
    );

    if (existing) {
      // Remove reaction
      await supabase
        .from('announcement_reactions')
        .delete()
        .eq('id', existing.id);
    } else {
      // Add reaction
      await supabase
        .from('announcement_reactions')
        .insert({ announcement_id: announcementId, user_id: userId, emoji });
    }

    // Refresh to get latest counts
    await fetchAll();
  }, [userId, allReactions, fetchAll]);

  // Build summaries per announcement
  const summaries = new Map<string, ReactionSummary[]>();

  for (const [announcementId, reactions] of allReactions) {
    const emojiCounts = new Map<string, { count: number; reacted: boolean }>();

    for (const emoji of REACTIONS_EMOJI) {
      const list = reactions.filter((r) => r.emoji === emoji);
      emojiCounts.set(emoji, {
        count: list.length,
        reacted: userId ? list.some((r) => r.user_id === userId) : false,
      });
    }

    const summary: ReactionSummary[] = REACTIONS_EMOJI
      .filter((emoji) => (emojiCounts.get(emoji)?.count ?? 0) > 0)
      .map((emoji) => ({
        emoji,
        count: emojiCounts.get(emoji)?.count ?? 0,
        reacted: emojiCounts.get(emoji)?.reacted ?? false,
      }))
      .sort((a, b) => b.count - a.count);

    summaries.set(announcementId, summary);
  }

  return { summaries, loading, toggle };
}
