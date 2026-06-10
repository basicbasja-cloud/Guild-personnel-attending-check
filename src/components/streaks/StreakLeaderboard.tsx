import { useStreakLeaderboard } from '../../hooks/useStreaks';
import { StreakBadge } from './StreakBadge';

interface StreakLeaderboardProps {
  compact?: boolean;
}

export function StreakLeaderboard({ compact = false }: StreakLeaderboardProps) {
  const { entries, loading } = useStreakLeaderboard();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-(--color-bg-elevated) rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-(--color-text-muted) text-sm">No active streaks yet</p>
      </div>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-1.5">
      {entries.map((entry, i) => (
        <div
          key={entry.user_id}
          className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200
            ${i < 3
              ? 'bg-(--color-bg-elevated) border border-(--color-border)'
              : 'bg-(--color-bg-card)/60'
            }
            ${compact ? 'py-1.5' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 text-center text-sm shrink-0">
              {i < 3 ? medals[i] : `#${i + 1}`}
            </span>
            <span className="text-(--color-text-primary) text-sm font-medium truncate">
              {entry.character_name ?? entry.username}
            </span>
          </div>
          <StreakBadge streak={entry.streak} compact />
        </div>
      ))}
    </div>
  );
}
