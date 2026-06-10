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
      const userIds = scoreRows.map((r) => r.user_id);
      let charMap = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, character_name')
          .in('id', userIds);
        if (profileData) {
          for (const p of profileData as { id: string; character_name: string | null }[]) {
            charMap.set(p.id, p.character_name);
          }
        }
      }

      const ranked = scoreRows.map((r, i) => ({
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
  }, [gameType, fetchLeaderboard]);

  return { entries, loading, myBest, saveScore, refresh: fetchLeaderboard };
}
