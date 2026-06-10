import type { LeaderboardEntry } from '../../hooks/useLeaderboard';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  myBest: number;
  currentUserId?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard({ entries, loading, myBest, currentUserId }: LeaderboardProps) {
  if (loading) {
    return (
      <div className="space-y-2 mt-3">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Leaderboard</p>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Leaderboard</p>
        <p className="text-slate-600 text-xs text-center py-3">No scores yet — be the first!</p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/50">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">
        Leaderboard <span className="text-slate-600 font-normal">· Top 20</span>
      </p>

      {/* My best banner */}
      {myBest > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-indigo-900/30 border border-indigo-800/40 mb-2 text-sm">
          <span className="text-indigo-300 text-xs">Your Best</span>
          <span className="text-white font-bold font-mono">{myBest}</span>
        </div>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.user_id}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors
              ${entry.user_id === currentUserId
                ? 'bg-indigo-900/20 border border-indigo-800/30'
                : 'hover:bg-slate-800/30'
              }
              ${entry.rank <= 3 ? 'bg-slate-800/40' : ''}
            `}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 text-center text-xs shrink-0">
                {entry.rank <= 3 ? MEDALS[entry.rank - 1] : `#${entry.rank}`}
              </span>
              <span className="text-slate-300 text-xs truncate">{entry.username}</span>
            </div>
            <span className="text-white font-mono text-xs font-bold shrink-0 ml-2">{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
