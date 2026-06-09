import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { KpiMetricKey, KpiWeeklyEntry } from '../types';

// ─── Metric labels ──────────────────────────────────────────────────────────

export const METRIC_LABELS: Record<KpiMetricKey, string> = {
  damage_dealt:       'Damage Dealt',
  siege_damage:       'Siege Damage',
  damage_taken:       'Damage Taken',
  kills:              'Kills',
  deaths:             'Deaths',
  assists:            'Assists',
  healing_done:       'Healing Done',
  ally_revives:       'Ally Revives',
  resources_gathered: 'Resources Gathered',
};

// ─── Trend state ─────────────────────────────────────────────────────────────

export type MetricTrend = 'strong_up' | 'up' | 'stable' | 'down' | 'strong_down' | 'baseline';

export interface MetricWithTrend {
  key:     KpiMetricKey;
  label:   string;
  value:   number;
  trend:   MetricTrend;
  pct:     number | null;   // percentage change vs previous week
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseKpiMetricsResult {
  loading: boolean;
  error:   string | null;
  metrics: MetricWithTrend[];
  /** Total computed score for current week (from raw entry) */
  currentEntry: KpiWeeklyEntry | null;
  previousEntry: KpiWeeklyEntry | null;
}

/**
 * Fetches the user's raw KPI entries for the current and previous week,
 * then computes per-metric trend states (up/down/stable/baseline).
 */
export function useKpiMetrics(userId: string, weekStart: string): UseKpiMetricsResult {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [entries, setEntries] = useState<KpiWeeklyEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch up to 2 entries for this user (current week + most recent previous week)
    const fetchEntries = async () => {
      const { data, error: dbErr } = await supabase
        .from('kpi_weekly_entries')
        .select('*')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(2);

      if (cancelled) return;
      if (dbErr) {
        setError(dbErr.message);
        setLoading(false);
        return;
      }
      setEntries((data as KpiWeeklyEntry[]) ?? []);
      setLoading(false);
    };

    fetchEntries();

    return () => { cancelled = true; };
  }, [userId]);

  const result = useMemo(() => {
    // Find current week entry (exact match or closest)
    const current = entries.find(
      (e) => e.week_start.slice(0, 10) === weekStart.slice(0, 10),
    ) ?? entries[0] ?? null;

    // Find previous week entry
    const previous = current
      ? entries.find(
          (e) => e.id !== current.id && e.week_start.slice(0, 10) !== weekStart.slice(0, 10),
        ) ?? null
      : null;

    const metrics: MetricWithTrend[] = allMetricKeys.map((key) => {
      const currentVal = current ? current[key] : 0;
      const prevVal    = previous ? previous[key] : 0;

      let trend: MetricTrend = 'baseline';
      let pct: number | null = null;

      if (current && previous) {
        if (prevVal === 0 && currentVal > 0) {
          trend = 'strong_up';
          pct = 100;
        } else if (prevVal === 0) {
          trend = 'stable';
          pct = 0;
        } else {
          const diff = currentVal - prevVal;
          pct = Math.round((diff / prevVal) * 100);
          if (key === 'deaths') {
            // For deaths, fewer = better
            if (pct <= -20) trend = 'strong_up';
            else if (pct < 0) trend = 'up';
            else if (pct === 0) trend = 'stable';
            else if (pct <= 20) trend = 'down';
            else trend = 'strong_down';
          } else {
            if (pct >= 20) trend = 'strong_up';
            else if (pct > 0) trend = 'up';
            else if (pct === 0) trend = 'stable';
            else if (pct >= -20) trend = 'down';
            else trend = 'strong_down';
          }
        }
      }

      return {
        key,
        label: METRIC_LABELS[key],
        value: currentVal,
        trend,
        pct: pct !== null ? Math.abs(pct) : null,
      };
    });

    return { metrics, currentEntry: current, previousEntry: previous };
  }, [entries, weekStart]);

  return { loading, error, ...result };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const allMetricKeys: KpiMetricKey[] = [
  'damage_dealt',
  'siege_damage',
  'damage_taken',
  'kills',
  'deaths',
  'assists',
  'healing_done',
  'ally_revives',
  'resources_gathered',
];

// ─── Trend → display helper ──────────────────────────────────────────────────

export function metricTrendDisplay(trend: MetricTrend): { arrow: string; label: string; color: string } {
  switch (trend) {
    case 'strong_up':    return { arrow: '🔥', label: 'Way up!',     color: 'text-green-400' };
    case 'up':           return { arrow: '📈', label: 'Improving',   color: 'text-green-500' };
    case 'stable':       return { arrow: '➡️', label: 'Steady',      color: 'text-blue-400'  };
    case 'down':         return { arrow: '📉', label: 'Dropped',     color: 'text-amber-400' };
    case 'strong_down':  return { arrow: '💥', label: 'Dropped a lot', color: 'text-red-400' };
    case 'baseline':     return { arrow: '📊', label: 'First entry', color: 'text-slate-400' };
  }
}

/** For deaths, fewer is better — invert the display */
export function metricTrendDisplayDeaths(trend: MetricTrend): { arrow: string; label: string; color: string } {
  switch (trend) {
    case 'strong_up':    return { arrow: '🔥', label: 'Fewer deaths!', color: 'text-green-400' };
    case 'up':           return { arrow: '📉', label: 'Dying less',   color: 'text-green-500' };
    case 'stable':       return { arrow: '➡️', label: 'Same',         color: 'text-blue-400'  };
    case 'down':         return { arrow: '📈', label: 'More deaths',  color: 'text-amber-400' };
    case 'strong_down':  return { arrow: '💥', label: 'Way more deaths', color: 'text-red-400' };
    case 'baseline':     return { arrow: '📊', label: 'First entry',  color: 'text-slate-400' };
  }
}
