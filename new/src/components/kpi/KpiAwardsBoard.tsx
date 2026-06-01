import { useMemo } from 'react';
import { useKpiBoard } from '../../hooks/useKpiBoard';
import { KPI_BOARDS, getKpiRoleShortLabel, formatKpiNumber } from '../../constants/kpi';
import type { KpiBoardRow, KpiRoleTag } from '../../types';

interface KpiAwardsBoardProps {
  isSuperManager: boolean;
}

// ─── Medal config ─────────────────────────────────────────────────────────────
const MEDAL = [
  { label: '🥇', bg: 'bg-amber-900/40',  text: 'text-amber-300',  border: 'border-amber-700/40' },
  { label: '🥈', bg: 'bg-slate-700/40',  text: 'text-slate-200',  border: 'border-slate-600/40' },
  { label: '🥉', bg: 'bg-amber-950/60',  text: 'text-amber-700',  border: 'border-amber-900/40' },
];

// ─── Role pill ────────────────────────────────────────────────────────────────
const ROLE_PILL_CLASS: Record<string, string> = {
  ROLE_DPS_DMG:  'bg-red-950/60 text-red-300 border-red-800/40',
  ROLE_DPS_DEF:  'bg-orange-950/60 text-orange-300 border-orange-800/40',
  ROLE_TANK:     'bg-blue-950/60 text-blue-300 border-blue-800/40',
  ROLE_HEALER:   'bg-green-950/60 text-green-300 border-green-800/40',
  ROLE_RESOURCE: 'bg-teal-950/60 text-teal-300 border-teal-800/40',
};

function RolePill({ roleTag }: { roleTag: KpiRoleTag }) {
  const cls = ROLE_PILL_CLASS[roleTag] ?? 'bg-slate-800 text-slate-400 border-slate-700';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {getKpiRoleShortLabel(roleTag)}
    </span>
  );
}

// ─── Single board card ────────────────────────────────────────────────────────
function BoardCard({
  boardName,
  allRows,
  isSuperManager,
}: {
  boardName:      string;
  allRows:        KpiBoardRow[];
  isSuperManager: boolean;
}) {
  const meta  = KPI_BOARDS.find((b) => b.name === boardName);
  const rows  = allRows.filter((r) => r.board_name === boardName).slice(0, 3);

  if (!meta) return null;

  return (
    <div className={`rounded-2xl overflow-hidden border ${meta.colorClass} flex flex-col`}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-2xl">{meta.emoji}</span>
          <span className="text-white font-bold text-base">{meta.label}</span>
        </div>
        <p className="text-slate-400 text-xs">{meta.subtitle}</p>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5 mx-4" />

      {/* Rank rows */}
      <div className="flex-1 px-3 py-2 space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-4">No data this week</p>
        ) : (
          rows.map((row) => {
            const medal = MEDAL[(row.rank_no ?? 1) - 1] ?? MEDAL[2];
            return (
              <div
                key={`${row.board_name}-${row.user_id}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${medal.bg} ${medal.border}`}
              >
                {/* Medal */}
                <span className="text-lg w-6 shrink-0 text-center">{medal.label}</span>

                {/* Name block */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm truncate ${medal.text}`}>
                    {row.character_name || row.username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <RolePill roleTag={row.role_tag} />
                    {row.character_class && (
                      <span className="text-slate-500 text-[10px] truncate">
                        {row.character_class}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score (super manager only) */}
                {isSuperManager && row.visible_score != null && (
                  <span className={`text-xs font-mono tabular-nums shrink-0 ${medal.text}`}>
                    {formatKpiNumber(row.visible_score)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Week nav ─────────────────────────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function KpiAwardsBoard({ isSuperManager }: KpiAwardsBoardProps) {
  const { rows, loading, error, weekStart, setWeekStart, refresh } = useKpiBoard();

  // Check if any data exists for the selected week
  const hasData = rows.length > 0;

  return (
    <div className="space-y-5">
      {/* Week picker header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          🏆 Guild League Awards
        </h2>
        <div className="flex items-center gap-2">
          {/* Prev week */}
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
          >
            ◀
          </button>

          {/* Week label */}
          <span className="text-slate-300 text-sm font-medium px-2 min-w-[120px] text-center">
            {formatWeekLabel(weekStart)}
          </span>

          {/* Next week */}
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
          >
            ▶
          </button>

          {/* Refresh */}
          <button
            onClick={refresh}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
            title="Refresh"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {KPI_BOARDS.map((b) => (
            <div key={b.name} className="rounded-2xl bg-slate-900 border border-slate-700 h-52 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-2xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasData && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-12 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-slate-300 font-medium">No war data for this week yet</p>
          <p className="text-slate-500 text-sm mt-1">Officers can enter post-war stats from the controls above</p>
        </div>
      )}

      {/* Board grid */}
      {!loading && !error && hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {KPI_BOARDS.map((b) => (
            <BoardCard
              key={b.name}
              boardName={b.name}
              allRows={rows}
              isSuperManager={isSuperManager}
            />
          ))}
        </div>
      )}
    </div>
  );
}
