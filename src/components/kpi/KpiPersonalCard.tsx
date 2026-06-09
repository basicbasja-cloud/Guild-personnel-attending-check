import { useMemo } from 'react';
import { useKpiProfile } from '../../hooks/useKpiProfile';
import {
  PROGRESSIVE_STATE_CONFIG,
  getProgressiveMessage,
  getKpiRoleLabel,
  formatKpiNumber,
  computeKpiScore,
  KPI_ROLES,
} from '../../constants/kpi';
import type { KpiProfileRow, KpiProgressiveState, KpiMetricKey } from '../../types';

// ─── Trend arrow helper ──────────────────────────────────────────────────────

function trendArrow(state: KpiProgressiveState): { arrow: string; color: string } {
  switch (state) {
    case 'strong_up': return { arrow: '🔥', color: 'text-green-400' };
    case 'up':        return { arrow: '↑',  color: 'text-green-500' };
    case 'stable':    return { arrow: '→',  color: 'text-blue-400'  };
    case 'calibrating': return { arrow: '↻', color: 'text-slate-400' };
    case 'baseline':  return { arrow: '·',  color: 'text-slate-500' };
    case 'reset':     return { arrow: '↻',  color: 'text-slate-500' };
    default:          return { arrow: '',   color: 'text-slate-400' };
  }
}

/** deaths is "good when down" — invert the arrow logic */
function trendArrowForDeaths(state: KpiProgressiveState): { arrow: string; color: string } {
  const t = trendArrow(state);
  // If deaths are down (strong_up / up), that's actually good — keep the fire
  // If deaths are up, show "↓" in red
  if (state === 'strong_up') return { arrow: '🔥', color: 'text-green-400' };
  if (state === 'up')        return { arrow: '↓',  color: 'text-green-500' }; // fewer deaths = down arrow = good
  if (state === 'stable')    return { arrow: '→',  color: 'text-blue-400' };
  return t;
}

// ─── Progressive cell ────────────────────────────────────────────────────────

function ProgressCell({ row }: { row: KpiProfileRow }) {
  const displayState = row.progressive_state === 'reset' ? 'stable' : row.progressive_state;
  const state = displayState as KpiProgressiveState;
  const cfg   = PROGRESSIVE_STATE_CONFIG[state] ?? PROGRESSIVE_STATE_CONFIG['baseline'];

  const message = getProgressiveMessage(row.role_tag, row.metric_key, state, row.progressive_label);

  if (state === 'baseline') {
    return <span className="text-slate-500 text-xs">ยังไม่มี Baseline</span>;
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

// ─── Personal Card ───────────────────────────────────────────────────────────

interface KpiPersonalCardProps {
  userId:    string;
  weekStart: string;
}

export function KpiPersonalCard({ userId, weekStart }: KpiPersonalCardProps) {
  const { rows, loading, error } = useKpiProfile(userId);

  // ── Current week rows ─────────────────────────────────────────────────
  const weekRows = useMemo(
    () => rows.filter((r) => r.week_start.slice(0, 10) === weekStart.slice(0, 10)),
    [rows, weekStart],
  );

  const roleTag   = weekRows[0]?.role_tag ?? null;
  const roleLabel = roleTag ? getKpiRoleLabel(roleTag) : null;

  // ── Build metric map for current week ─────────────────────────────────
  const metricMap = useMemo(() => {
    const map = new Map<KpiMetricKey, KpiProfileRow>();
    for (const r of weekRows) {
      map.set(r.metric_key, r);
    }
    return map;
  }, [weekRows]);

  // ── Compute overall score ─────────────────────────────────────────────
  const score = useMemo(() => {
    if (!roleTag) return 0;
    const getVal = (key: KpiMetricKey) => metricMap.get(key)?.metric_value ?? 0;
    return computeKpiScore(
      roleTag,
      getVal('damage_dealt'),
      getVal('siege_damage'),
      getVal('damage_taken'),
      getVal('kills'),
      getVal('deaths'),
      getVal('assists'),
      getVal('healing_done'),
      getVal('ally_revives'),
      getVal('resources_gathered'),
    );
  }, [roleTag, metricMap]);

  // ── Personal bests (all weeks) ────────────────────────────────────────
  const { personalBests, streaks } = useMemo(() => {
    const pb = new Map<KpiMetricKey, number>();
    // Build a map of week_start → metrics per week
    const weekMap = new Map<string, Map<KpiMetricKey, number>>();
    for (const r of rows) {
      const wk = r.week_start.slice(0, 10);
      if (!weekMap.has(wk)) weekMap.set(wk, new Map());
      weekMap.get(wk)!.set(r.metric_key, r.metric_value);
    }

    // Find personal best per metric across all weeks
    for (const r of rows) {
      const key = r.metric_key;
      const current = pb.get(key) ?? 0;
      if (r.metric_value > current) pb.set(key, r.metric_value);
    }

    // Count consecutive weeks (backwards from current week)
    const sortedWeeks = [...weekMap.keys()].sort().reverse();
    let streak = 0;
    let cursor = weekStart.slice(0, 10);
    for (const wk of sortedWeeks) {
      // Allow ±7 day flexibility for week_start matching
      if (wk === cursor || Math.abs(new Date(wk).getTime() - new Date(cursor).getTime()) < 8 * 86400000) {
        streak++;
        cursor = wk; // will be advanced by -7 for next iteration
        const d = new Date(cursor);
        d.setDate(d.getDate() - 7);
        cursor = d.toISOString().split('T')[0];
      } else {
        break;
      }
    }

    // Count total entries
    const totalWeeks = weekMap.size;

    return { personalBests: pb, streaks: { consecutive: streak, total: totalWeeks } };
  }, [rows, weekStart]);

  // ── All-time personal best score ──────────────────────────────────────
  const pbScore = useMemo(() => {
    if (!roleTag) return 0;
    // Scan all weeks and find the max computed score
    let maxScore = 0;
    const weekMap = new Map<string, Map<KpiMetricKey, KpiProfileRow>>();
    for (const r of rows) {
      const wk = r.week_start.slice(0, 10);
      if (!weekMap.has(wk)) weekMap.set(wk, new Map());
      weekMap.get(wk)!.set(r.metric_key, r);
    }
    for (const [, metricRows] of weekMap) {
      const rt = metricRows.get('damage_dealt')?.role_tag;
      if (!rt) continue;
      const getVal = (key: KpiMetricKey) => metricRows.get(key)?.metric_value ?? 0;
      const s = computeKpiScore(
        rt,
        getVal('damage_dealt'),
        getVal('siege_damage'),
        getVal('damage_taken'),
        getVal('kills'),
        getVal('deaths'),
        getVal('assists'),
        getVal('healing_done'),
        getVal('ally_revives'),
        getVal('resources_gathered'),
      );
      if (s > maxScore) maxScore = s;
    }
    return maxScore;
  }, [rows, roleTag]);

  const isPersonalBest = score > 0 && score >= pbScore && pbScore > 0;

  // ── Loading / Error / Empty ───────────────────────────────────────────
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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 text-center">
        <p className="text-3xl mb-2">⚔️</p>
        <p className="text-slate-400 text-sm">ยังไม่มีข้อมูลสัปดาห์นี้</p>
        <p className="text-slate-500 text-xs mt-1">Enter your war stats to start tracking!</p>
      </div>
    );
  }

  // ── Rendered card ─────────────────────────────────────────────────────
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">

      {/* ── Score banner ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-indigo-900/40 to-slate-900 px-5 py-4 border-b border-indigo-800/30">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold text-sm">Your Performance</h3>
              {isPersonalBest && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/40 font-medium animate-pulse">
                  🏅 PB!
                </span>
              )}
            </div>
            {roleLabel && (
              <p className="text-slate-400 text-xs mt-0.5">{roleLabel}</p>
            )}
          </div>

          {/* Streak */}
          <div className="flex items-center gap-2 text-xs">
            {streaks.consecutive >= 2 && (
              <span className="text-orange-400 font-medium">
                🔥 {streaks.consecutive} wars
              </span>
            )}
            {streaks.consecutive === 1 && (
              <span className="text-slate-400">⚔️ First war</span>
            )}
            {streaks.total > 0 && (
              <span className="text-slate-500">· {streaks.total} total</span>
            )}
          </div>
        </div>

        {/* Score row */}
        {score > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {formatKpiNumber(score)}
            </span>
            {pbScore > 0 && (
              <div className="flex-1 h-2 bg-slate-700/60 rounded-full overflow-hidden max-w-[120px]">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-amber-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (score / pbScore) * 100)}%` }}
                />
              </div>
            )}
            {pbScore > 0 && score < pbScore && (
              <span className="text-slate-400 text-xs">
                {formatKpiNumber(pbScore - score)} to beat PB 🎯
              </span>
            )}
            {isPersonalBest && (
              <span className="text-amber-400 text-xs font-medium animate-pulse">
                🎉 New Personal Best!
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Metrics ────────────────────────────────────────────────────── */}
      <div className="divide-y divide-slate-800">
        {weekRows.map((row) => {
          const isDeaths = row.metric_key === 'deaths';
          const arrow = isDeaths
            ? trendArrowForDeaths(row.progressive_state as KpiProgressiveState)
            : trendArrow(row.progressive_state as KpiProgressiveState);

          const isPb = (personalBests.get(row.metric_key) ?? 0) > 0
            && row.metric_value >= (personalBests.get(row.metric_key) ?? 0);

          const isGoodDeaths = isDeaths && (row.progressive_state === 'strong_up' || row.progressive_state === 'up');

          return (
            <div
              key={row.metric_key}
              className="flex items-center justify-between px-5 py-3 gap-3 hover:bg-slate-800/30 transition-colors"
            >
              {/* Label */}
              <span className="text-slate-300 text-sm w-32 shrink-0">
                {row.metric_label}
              </span>

              {/* Arrow indicator */}
              <span className={`w-5 text-center text-sm shrink-0 ${arrow.color}`}>
                {arrow.arrow}
              </span>

              {/* Value */}
              <span className={`text-sm font-mono tabular-nums w-24 text-right shrink-0 ${
                isPb ? 'text-amber-300 font-semibold' : 'text-white'
              }`}>
                {formatKpiNumber(row.metric_value)}
                {isPb && !isDeaths && <span className="text-[9px] text-amber-500 ml-0.5">🏅</span>}
                {isGoodDeaths && <span className="text-[9px] text-green-500 ml-0.5">👍</span>}
              </span>

              {/* Progress message */}
              <div className="flex-1 text-right min-w-0">
                <ProgressCell row={row} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
