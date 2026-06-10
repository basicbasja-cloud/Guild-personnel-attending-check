interface StreakBadgeProps {
  streak: number;
  compact?: boolean;
  className?: string;
}

const COLORS = [
  '',                                                                    // 0
  'bg-amber-900/60 text-amber-300 border border-amber-600/50',           // 1-4
  'bg-amber-900/60 text-amber-300 border border-amber-600/50',
  'bg-amber-900/60 text-amber-300 border border-amber-600/50',
  'bg-amber-900/60 text-amber-300 border border-amber-600/50',
  'bg-orange-900/60 text-orange-300 border border-orange-500/50',        // 5-9
  'bg-orange-900/60 text-orange-300 border border-orange-500/50',
  'bg-orange-900/60 text-orange-300 border border-orange-500/50',
  'bg-orange-900/60 text-orange-300 border border-orange-500/50',
  'bg-orange-900/60 text-orange-300 border border-orange-500/50',
  'bg-red-900/60 text-red-300 border border-red-500/60 shadow-sm shadow-red-900/40', // 10+
];

const LABELS: Record<number, string> = {
  5: 'Hot streak!',
  10: 'On fire!',
  15: 'Legendary!',
};

export function StreakBadge({ streak, compact = false, className = '' }: StreakBadgeProps) {
  if (streak <= 0) return null;

  const colorIndex = Math.min(streak, COLORS.length - 1);
  const label = LABELS[streak >= 15 ? 15 : streak >= 10 ? 10 : streak >= 5 ? 5 : 0];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold transition-all duration-300 ${COLORS[colorIndex]} ${className}`}
        title={`${streak}-week streak${label ? ` — ${label}` : ''}`}
      >
        🔥{streak}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-bold transition-all duration-300 ${COLORS[colorIndex]} ${className}`}
      title={`${streak}-week streak${label ? ` — ${label}` : ''}`}
    >
      🔥 {streak}
      {label && <span className="text-[10px] font-normal opacity-80 ml-0.5">{label}</span>}
    </span>
  );
}
