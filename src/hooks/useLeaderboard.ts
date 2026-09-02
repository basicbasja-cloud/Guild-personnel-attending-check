import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type GameType = 'snake' | 'memory' | 'reaction' | 'aim' | 'sequence' | 'pong';

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  character_name: string | null;
  score: number;
  rank: number;
}

interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  loading: boolean;
  myBest: number;
  saveScore: (userId: string, username: string, score: number) => Promise<boolean>;
  refresh: () => void;
}

export function useLeaderboard(gameType: GameType, currentUserId?: string, isDisabled = false): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myBest, setMyBest] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch scores
      const { data: scoreData, error } = await supabase
        .from('mini_game_scores')
        .select('user_id, username, score')
        .eq('game_type', gameType)
        .order('score', { ascending: false })
        .limit(20);

      if (error) throw error;

      const scoreRows = (scoreData ?? []) as { user_id: string; username: string; score: number }[];

      // Fetch character names for all users in the leaderboard
      // (also used to exclude disabled members from the ranking)
      const userIds = scoreRows.map((r) => r.user_id);
      let charMap = new Map<string, string | null>();
      const disabledUserIds = new Set<string>();
      if (userIds.length > 0) {
        let profileResult = await supabase
          .from('profiles')
          .select('id, character_name, is_disabled')
          .in('id', userIds);

        // Graceful fallback if the is_disabled column doesn't exist yet
        // (supabase/patch_member_disabled.sql not applied)
        if (profileResult.error && (profileResult.error.message ?? '').includes('is_disabled')) {
          profileResult = (await supabase
            .from('profiles')
            .select('id, character_name')
            .in('id', userIds)) as typeof profileResult;
        }

        if (profileResult.data) {
          for (const p of profileResult.data as { id: string; character_name: string | null; is_disabled?: boolean | null }[]) {
            charMap.set(p.id, p.character_name);
            if (p.is_disabled === true) disabledUserIds.add(p.id);
          }
        }
      }

      // Disabled members are viewable but never ranked
      const ranked = scoreRows
        .filter((r) => !disabledUserIds.has(r.user_id))
        .map((r, i) => ({
          user_id: r.user_id,
          username: r.username,
          character_name: charMap.get(r.user_id) ?? null,
          score: r.score,
          rank: i + 1,
        }));

      setEntries(ranked);

      if (currentUserId) {
        const mine = ranked.find((r) => r.user_id === currentUserId);
        setMyBest(mine?.score ?? 0);
      }
    } catch (e) {
      console.error('[Leaderboard] fetch error:', e);
    }
    setLoading(false);
  }, [gameType, currentUserId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const saveScore = useCallback(async (
    userId: string,
    username: string,
    score: number,
  ): Promise<boolean> => {
    // Disabled members cannot interact — no score saving.
    if (isDisabled) return false;
    try {
      const { error } = await supabase.rpc('upsert_mini_game_score', {
        p_user_id: userId,
        p_username: username,
        p_game_type: gameType,
        p_score: score,
      });

      if (error) throw error;

      // Refresh leaderboard
      fetchLeaderboard();
      return true;
    } catch (e) {
      console.error('[Leaderboard] save error:', e);
      return false;
    }
  }, [gameType, fetchLeaderboard, isDisabled]);

  return { entries, loading, myBest, saveScore, refresh: fetchLeaderboard };
}
