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

export function useLeaderboard(gameType: GameType, currentUserId?: string): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myBest, setMyBest] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mini_game_scores')
        .select('user_id, username, score')
        .eq('game_type', gameType)
        .order('score', { ascending: false })
        .limit(20);

      if (error) throw error;

      const rows = (data ?? []) as { user_id: string; username: string; score: number }[];
      const ranked = rows.map((r, i) => ({
        user_id: r.user_id,
        username: r.username,
        character_name: null as string | null,
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
    try {
      const { error } = await supabase
        .from('mini_game_scores')
        .upsert({
          user_id: userId,
          username,
          game_type: gameType,
          score,
        }, {
          onConflict: 'user_id, game_type',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      // Refresh leaderboard
      fetchLeaderboard();
      return true;
    } catch (e) {
      console.error('[Leaderboard] save error:', e);
      return false;
    }
  }, [gameType, fetchLeaderboard]);

  return { entries, loading, myBest, saveScore, refresh: fetchLeaderboard };
}
