import { useMemo } from 'react';
import { useKpiProfile } from '../../hooks/useKpiProfile';
import {
  PROGRESSIVE_STATE_CONFIG,
  getProgressiveMessage,
  getKpiRoleLabel,
  formatKpiNumber,
} from '../../constants/kpi';
import type { KpiProfileRow, KpiProgressiveState } from '../../types';

interface KpiPersonalCardProps {
  userId:    string;
  weekStart: string;
}

function ProgressCell({ row }: { row: KpiProfileRow }) {
  // Treat 'reset' the same as 'stable' — no "⚙️ ปรับระบบ…" messages
  const displayState = row.progressive_state === 'reset' ? 'stable' : row.progressive_state;
  const state = displayState as KpiProgressiveState;
  const cfg   = PROGRESSIVE_STATE_CONFIG[state] ?? PROGRESSIVE_STATE_CONFIG['baseline'];

  const message = getProgressiveMessage(
    row.role_tag,
    row.metric_key,
    state,
    row.progressive_label,
  );

  if (state === 'baseline') {
    return <span className="text-slate-500 text-xs">กำลังสร้าง Baseline…</span>;
  }

  return (
    <span className={`text-xs ${cfg.colorClass}`}>
      {cfg.showLabel && row.progressive_label
        ? message || row.progressive_label
        : message || stateLabel(state)}
    </span>
  );
}

function stateLabel(state: KpiProgressiveState): string {
  switch (state) {
    case 'stable':      return '🎯 Stable';
    case 'calibrating': return '🔄 Calibrating';
    case 'reset':       return '⚙️ Adjusting';
    default:            return '';
  }
}

export function KpiPersonalCard({ userId, weekStart }: KpiPersonalCardProps) {
  const { rows, loading, error } = useKpiProfile(userId);

  const weekRows = useMemo(
    () => rows.filter((r) => r.week_start.slice(0, 10) === weekStart.slice(0, 10)),
    [rows, weekStart],
  );

  const roleTag   = weekRows[0]?.role_tag ?? null;
  const roleLabel = roleTag ? getKpiRoleLabel(roleTag) : null;

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-slate-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-800/50 rounded-2xl p-5">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (weekRows.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
        <p className="text-slate-500 text-sm text-center py-4">
          ยังไม่มีข้อมูลสัปดาห์นี้
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-white font-semibold text-sm">Your Performance</h3>
          {roleLabel && (
            <p className="text-slate-400 text-xs mt-0.5">Role: {roleLabel}</p>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-800">
        {weekRows.map((row) => (
          <div
            key={row.metric_key}
            className="flex items-center justify-between px-5 py-3 gap-4"
          >
            <span className="text-slate-300 text-sm w-36 shrink-0">
              {row.metric_label}
            </span>
            <span className="text-white text-sm font-mono tabular-nums w-24 text-right shrink-0">
              {formatKpiNumber(row.metric_value)}
            </span>
            <div className="flex-1 text-right">
              <ProgressCell row={row} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
