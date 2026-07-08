import { useMemo } from 'react';

interface RawAttendanceRow {
  user_id: string;
  week_start: string;
  status: string;
}

interface WeeklyTrendChartProps {
  weeks: string[];
  rows: RawAttendanceRow[];
  onBarClick?: (weekStart: string) => void;
}

const MAX_BAR_HEIGHT = 100; // px

/**
 * Pure CSS bar chart showing attendance rate per week over the last 12 weeks.
 * Each bar shows join (green), maybe (amber), not_join (red) stacked.
 */
export function WeeklyTrendChart({ weeks, rows, onBarClick }: WeeklyTrendChartProps) {
  const weeklyData = useMemo(() => {
    const reversed = [...weeks].reverse();
    return reversed.map((week) => {
      const weekRows = rows.filter((r) => r.week_start === week);
      return {
        week,
        weekLabel: week.slice(5), // Show MM-DD
        join: weekRows.filter((r) => r.status === 'join').length,
        maybe: weekRows.filter((r) => r.status === 'maybe').length,
        notJoin: weekRows.filter((r) => r.status === 'not_join').length,
      };
    });
  }, [weeks, rows]);

  const maxVal = Math.max(...weeklyData.map((w) => w.join + w.maybe + w.notJoin), 1);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
      <h3 className="text-white font-semibold text-sm mb-4">📈 Weekly Attendance Trend</h3>
      {weeklyData.every((w) => w.join + w.maybe + w.notJoin === 0) ? (
        <p className="text-slate-500 text-sm py-8 text-center">No attendance data for the last {weeks.length} weeks.</p>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height: MAX_BAR_HEIGHT }}>
          {weeklyData.map((w) => {
            const total = w.join + w.maybe + w.notJoin;
            const barPx = Math.max(Math.round((total / maxVal) * MAX_BAR_HEIGHT), 2);
            const joinPx = total > 0 ? Math.round((w.join / total) * barPx) : 0;
            const maybePx = total > 0 ? Math.round((w.maybe / total) * barPx) : 0;
            const notJoinPx = total > 0 ? Math.round((w.notJoin / total) * barPx) : 0;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  onClick={() => onBarClick?.(w.week)}
                  className={`w-full flex flex-col-reverse rounded-t-sm overflow-hidden transition-all group-hover:opacity-80 ${onBarClick ? 'cursor-pointer' : ''}`}
                  style={{ height: barPx }}>
                  {notJoinPx > 0 && <div style={{ height: notJoinPx }} className="bg-red-600/70 w-full shrink-0" />}
                  {maybePx > 0 && <div style={{ height: maybePx }} className="bg-amber-600/70 w-full shrink-0" />}
                  {joinPx > 0 && <div style={{ height: joinPx }} className="bg-emerald-600/70 w-full shrink-0" />}
                </div>
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  ✅{w.join} 🤔{w.maybe} ❌{w.notJoin}
                </div>
                <span className="text-[10px] text-slate-500 truncate w-full text-center">{w.weekLabel}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-600/70" /> Join</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-600/70" /> Maybe</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-600/70" /> Can't Join</span>
      </div>
    </div>
  );
}
