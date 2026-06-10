import { useMemo } from 'react';
import { useKpiMetrics, metricTrendDisplay, metricTrendDisplayDeaths } from '../../hooks/useKpiMetrics';
import { useKpiProfile } from '../../hooks/useKpiProfile';
import { getKpiRoleLabel, formatKpiNumber, computeKpiScore } from '../../constants/kpi';
import { KpiScoreTierAnimation } from './KpiScoreTierAnimation';

// ─── Personal Card ───────────────────────────────────────────────────────────

interface KpiPersonalCardProps {
  userId:         string;
  weekStart:      string;
  isSuperManager?: boolean;
}

export function KpiPersonalCard({ userId, weekStart, isSuperManager }: KpiPersonalCardProps) {
  // ── Per-metric data with trends (for the 9 arrows) ───────────────────
  const {
    loading: metricsLoading,
    error: metricsError,
    metrics,
    currentEntry,
  } = useKpiMetrics(userId, weekStart);

  // ── Overall score profile (for super manager score banner) ───────────
  const { rows: profileRows } = useKpiProfile(userId);

  const overallScore = useMemo(() => {
    if (!currentEntry) return 0;
    return computeKpiScore(
      currentEntry.role_tag,
      currentEntry.damage_dealt,
      currentEntry.siege_damage,
      currentEntry.damage_taken,
      currentEntry.kills,
      currentEntry.deaths,
      currentEntry.assists,
      currentEntry.healing_done,
      currentEntry.ally_revives,
      currentEntry.resources_gathered,
    );
  }, [currentEntry]);

  // ── Personal best & streaks (from profile rows: overall scores across weeks) ──
  const { personalBest, entryCount, streakCount } = useMemo(() => {
    const sorted = [...profileRows]
      .filter((r) => r.metric_value > 0)
      .sort((a, b) => b.week_start.localeCompare(a.week_start));
    const pb = sorted.reduce((max, r) => Math.max(max, r.metric_value), 0);
    const total = sorted.length;
    let streak = 0;
    for (let i = 0; i < sorted.length; i++) {
      const wk = sorted[i].week_start.slice(0, 10);
      if (i === 0 && wk !== weekStart.slice(0, 10)) break;
      if (i === 0) { streak = 1; continue; }
      const prevWk = sorted[i - 1].week_start.slice(0, 10);
      const diffDays = Math.round((new Date(prevWk).getTime() - new Date(wk).getTime()) / 86400000);
      if (diffDays === 7) streak++;
      else break;
    }
    return { personalBest: pb, entryCount: total, streakCount: streak };
  }, [profileRows, weekStart]);

  const isPB = overallScore > 0 && overallScore >= personalBest && personalBest > 0;
  const roleTag = currentEntry?.role_tag ?? null;
  const roleLabel = roleTag ? getKpiRoleLabel(roleTag) : null;

  // ── Loading / Error / Empty ───────────────────────────────────────────
  if (metricsLoading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-slate-800 rounded" />)}
        </div>
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="bg-slate-900 border border-red-800/50 rounded-2xl p-5">
        <p className="text-red-400 text-sm">{metricsError}</p>
      </div>
    );
  }

  if (!currentEntry) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 text-center">
        <p className="text-3xl mb-2">⚔️</p>
        <p className="text-slate-400 text-sm">No stats for this week yet</p>
        <p className="text-slate-500 text-xs mt-1">Enter your war stats above to start tracking!</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">

      {/* ── Banner ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-indigo-900/40 to-slate-900 px-5 py-4 border-b border-indigo-800/30">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h3 className="text-white font-semibold text-sm">Your Performance</h3>
              {roleLabel && <p className="text-slate-400 text-xs mt-0.5">{roleLabel}</p>}
            </div>
          </div>
          {/* Streak */}
          <div className="flex items-center gap-1.5">
            {streakCount >= 3 && <span className="px-2.5 py-1 rounded-full bg-orange-900/40 border border-orange-700/40 text-orange-300 text-xs font-bold">🔥 {streakCount}</span>}
            {streakCount === 2 && <span className="px-2.5 py-1 rounded-full bg-orange-900/30 border border-orange-700/30 text-orange-400 text-xs font-medium">🔥 2 in a row!</span>}
            {streakCount === 1 && entryCount > 1 && <span className="text-slate-500 text-xs">⚔️ Back this week</span>}
            {streakCount === 1 && entryCount === 1 && <span className="text-slate-500 text-xs">⚔️ First war</span>}
            {entryCount > 0 && <span className="text-slate-600 text-xs">· {entryCount} total</span>}
          </div>
        </div>

        {/* Score tier animation — super manager only */}
        {isSuperManager && overallScore > 0 && (
          <div className="mt-3">
            <KpiScoreTierAnimation score={overallScore} isNewBest={isPB} />
          </div>
        )}

        {/* PB badge (visible to all) */}
        {isPB && !isSuperManager && (
          <div className="mt-2 flex items-center gap-2 text-xs bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-1.5">
            <span className="text-amber-400 font-semibold animate-pulse">🏅 Personal Best!</span>
            <span className="text-amber-500/70">You're playing better than ever 🎉</span>
          </div>
        )}
      </div>

      {/* ── 9 Metrics with trend arrows ───────────────────────────────── */}
      <div className="divide-y divide-slate-800">
        {metrics.map((m) => {
          const isDeaths = m.key === 'deaths';
          const display = isDeaths ? metricTrendDisplayDeaths(m.trend) : metricTrendDisplay(m.trend);
          return (
            <div key={m.key} className="flex items-center justify-between px-5 py-3 gap-2 hover:bg-slate-800/30 transition-colors">
              {/* Arrow */}
              <div className={`w-9 flex items-center justify-center text-lg shrink-0 ${display.color}`} title={display.label}>
                {display.arrow}
              </div>
              {/* Label */}
              <div className="flex-1 min-w-0">
                <span className="text-slate-300 text-sm">{m.label}</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-white font-mono tabular-nums text-sm">{formatKpiNumber(m.value)}</span>
                </div>
              </div>
              {/* Trend label */}
              <div className="text-right shrink-0 min-w-[70px]">
                <span className={`text-xs whitespace-nowrap ${
                  m.trend === 'strong_up' ? 'text-green-400' :
                  m.trend === 'up' ? 'text-green-500' :
                  m.trend === 'stable' ? 'text-blue-400' :
                  m.trend === 'down' ? 'text-amber-400' :
                  m.trend === 'strong_down' ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {m.trend === 'baseline' && '📊 First'}
                  {m.trend === 'stable' && '🎯 Same'}
                  {m.trend === 'up' && m.pct != null && `📈 +${m.pct}%`}
                  {m.trend === 'up' && m.pct == null && '📈 Up'}
                  {m.trend === 'strong_up' && m.pct != null && `🔥 +${m.pct}%`}
                  {m.trend === 'strong_up' && m.pct == null && '🔥 Up'}
                  {m.trend === 'down' && m.pct != null && `📉 -${m.pct}%`}
                  {m.trend === 'down' && m.pct == null && '📉 Down'}
                  {m.trend === 'strong_down' && m.pct != null && `💥 -${m.pct}%`}
                  {m.trend === 'strong_down' && m.pct == null && '💥 Down'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Stats footer ───────────────────────────────────────────────── */}
      <div className="border-t border-slate-800 px-5 py-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-slate-500 text-[10px]">Entries</p>
          <p className="text-white font-bold text-sm">{entryCount}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px]">Streak</p>
          <p className={`font-bold text-sm ${streakCount >= 3 ? 'text-orange-400' : streakCount >= 2 ? 'text-orange-300' : 'text-white'}`}>
            {streakCount > 0 ? `🔥 ${streakCount}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px]">Best Score</p>
          <p className="text-amber-400 font-bold text-sm font-mono">{personalBest > 0 ? formatKpiNumber(personalBest) : '—'}</p>
        </div>
      </div>
    </div>
  );
}
