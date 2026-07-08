import { useMemo } from 'react';
import type { Profile } from '../../types';

interface ClassBreakdownChartProps {
  rows: { user_id: string; status: string }[];
  profiles: Profile[];
}

export function ClassBreakdownChart({ rows, profiles }: ClassBreakdownChartProps) {
  const classData = useMemo(() => {
    const map = new Map<string, { join: number; maybe: number; notJoin: number }>();
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    for (const r of rows) {
      const profile = profileMap.get(r.user_id);
      const cls = profile?.character_class ?? 'Unknown';
      const entry = map.get(cls) ?? { join: 0, maybe: 0, notJoin: 0 };
      if (r.status === 'join') entry.join++;
      else if (r.status === 'maybe') entry.maybe++;
      else if (r.status === 'not_join') entry.notJoin++;
      map.set(cls, entry);
    }

    return Array.from(map.entries())
      .map(([cls, counts]) => ({ cls, ...counts, total: counts.join + counts.maybe + counts.notJoin }))
      .sort((a, b) => b.total - a.total);
  }, [rows, profiles]);

  if (classData.length === 0) return null;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
      <h3 className="text-white font-semibold text-sm mb-4">🏛️ Class Breakdown</h3>
      <div className="space-y-2">
        {classData.map((c) => {
          return (
            <div key={c.cls}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">{c.cls}</span>
                <span className="text-slate-400">{c.total} responses</span>
              </div>
              <div className="w-full h-4 rounded-full bg-slate-800 overflow-hidden flex">
                {c.join > 0 && (
                  <div
                    className="bg-emerald-600/70 h-full transition-all"
                    style={{ width: `${(c.join / c.total) * 100}%` }}
                    title={`✅ Join: ${c.join}`}
                  />
                )}
                {c.maybe > 0 && (
                  <div
                    className="bg-amber-600/70 h-full transition-all"
                    style={{ width: `${(c.maybe / c.total) * 100}%` }}
                    title={`🤔 Maybe: ${c.maybe}`}
                  />
                )}
                {c.notJoin > 0 && (
                  <div
                    className="bg-red-600/70 h-full transition-all"
                    style={{ width: `${(c.notJoin / c.total) * 100}%` }}
                    title={`❌ Can't: ${c.notJoin}`}
                  />
                )}
              </div>
              <div className="flex gap-3 mt-0.5 text-[10px] text-slate-500">
                <span>✅ {c.join}</span>
                <span>🤔 {c.maybe}</span>
                <span>❌ {c.notJoin}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
