import { useState, useEffect, useMemo } from 'react';
import { formatISO, subWeeks } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { getUpcomingSaturday } from '../../lib/week';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { downloadCsv } from '../../lib/exportCsv';
import type { Profile } from '../../types';

const HISTORY_WEEKS = 12; // how many weeks back to include

interface WeekRow {
  user_id: string;
  status: 'join' | 'not_join' | 'maybe';
}

interface PlayerStat {
  profile: Profile;
  join: number;
  maybe: number;
  not_join: number;
  non_select: number;
  total: number;
  attendance_rate: number; // (join + maybe) / total
}

type SortKey = 'username' | 'join' | 'maybe' | 'not_join' | 'non_select' | 'attendance_rate';

function buildWeekStrs(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = subWeeks(getUpcomingSaturday(today), i);
    return formatISO(d, { representation: 'date' });
  });
}

export function PlayerStatsDashboard() {
  const { profiles } = useAllProfiles();
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeks] = useState<string[]>(() => buildWeekStrs(HISTORY_WEEKS));
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('join');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('attendance')
      .select('user_id,status')
      .in('week_start', weeks)
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data as WeekRow[]) ?? []);
        setLoading(false);
      }, () => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [weeks]);

  const stats = useMemo((): PlayerStat[] => {
    const statusByUser = new Map<string, { join: number; maybe: number; not_join: number }>();
    for (const r of rows) {
      const s = statusByUser.get(r.user_id) ?? { join: 0, maybe: 0, not_join: 0 };
      s[r.status]++;
      statusByUser.set(r.user_id, s);
    }
    return profiles.map((p) => {
      const s = statusByUser.get(p.id) ?? { join: 0, maybe: 0, not_join: 0 };
      const responded = s.join + s.maybe + s.not_join;
      const non_select = Math.max(0, HISTORY_WEEKS - responded);
      const total = HISTORY_WEEKS;
      const attendance_rate = total > 0 ? Math.round(((s.join + s.maybe) / total) * 100) : 0;
      return { profile: p, join: s.join, maybe: s.maybe, not_join: s.not_join, non_select, total, attendance_rate };
    });
  }, [profiles, rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stats.filter(
      (s) =>
        !q ||
        s.profile.username.toLowerCase().includes(q) ||
        (s.profile.character_name ?? '').toLowerCase().includes(q) ||
        (s.profile.character_class ?? '').toLowerCase().includes(q)
    );
  }, [stats, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = sortKey === 'username' ? a.profile.username : a[sortKey];
      const bv = sortKey === 'username' ? b.profile.username : b[sortKey];
      if (av < bv) return sortDesc ? 1 : -1;
      if (av > bv) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [filtered, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else { setSortKey(key); setSortDesc(true); }
  };

  const handleExport = () => {
    downloadCsv(
      sorted.map((s) => ({
        Username: s.profile.username,
        'Character Name': s.profile.character_name ?? '',
        Class: s.profile.character_class ?? '',
        Join: s.join,
        Maybe: s.maybe,
        "Can't Join": s.not_join,
        'Non-Select': s.non_select,
        'Attendance Rate (%)': s.attendance_rate,
        [`Weeks (last ${HISTORY_WEEKS})`]: s.total,
      })),
      `player_stats_${weeks[0]}.csv`
    );
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span className="ml-1 text-indigo-400">{sortDesc ? '▼' : '▲'}</span> : <span className="ml-1 text-slate-600">⇅</span>;

  const Th = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <th
      className={`px-3 py-3 text-xs font-semibold text-slate-400 cursor-pointer select-none hover:text-white transition-colors ${right ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(k)}
    >
      {label}<SortIcon k={k} />
    </th>
  );

  return (
    <div className="max-w-screen-xl mx-auto p-3 sm:p-4 pt-6">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-lg">Player Stats Dashboard</h2>
            <p className="text-slate-400 text-xs mt-0.5">Last {HISTORY_WEEKS} weeks · {profiles.length} players</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player…"
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 w-44"
            />
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors shrink-0"
            >
              ⬇ Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading stats…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 border-b border-slate-700">
                <tr>
                  <Th label="Player" k="username" />
                  <th className="px-3 py-3 text-xs font-semibold text-slate-400 text-left">Class</th>
                  <Th label="✅ Join" k="join" right />
                  <Th label="🤔 Maybe" k="maybe" right />
                  <Th label="❌ Can't" k="not_join" right />
                  <Th label="❓ Non-Select" k="non_select" right />
                  <Th label="Rate" k="attendance_rate" right />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-10">No players found.</td>
                  </tr>
                )}
                {sorted.map((s) => {
                  const rateColor =
                    s.attendance_rate >= 70 ? 'text-emerald-400' :
                    s.attendance_rate >= 40 ? 'text-yellow-400' : 'text-red-400';
                  return (
                    <tr key={s.profile.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {s.profile.avatar_url ? (
                            <img src={s.profile.avatar_url} alt={s.profile.username} className="w-7 h-7 rounded-full shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {s.profile.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium leading-tight">
                              {s.profile.character_name ?? s.profile.username}
                            </p>
                            {s.profile.character_name && (
                              <p className="text-slate-500 text-xs leading-tight">{s.profile.username}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{s.profile.character_class ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-emerald-400 font-semibold">{s.join}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-yellow-400 font-semibold">{s.maybe}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-red-400 font-semibold">{s.not_join}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-slate-400 font-semibold">{s.non_select}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Mini progress bar */}
                          <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden hidden sm:block">
                            <div
                              className={`h-full rounded-full ${s.attendance_rate >= 70 ? 'bg-emerald-500' : s.attendance_rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${s.attendance_rate}%` }}
                            />
                          </div>
                          <span className={`font-semibold w-10 text-right ${rateColor}`}>{s.attendance_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary footer */}
        {!loading && sorted.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>Total players: <strong className="text-slate-300">{sorted.length}</strong></span>
            <span>Avg join rate: <strong className="text-emerald-400">{Math.round(sorted.reduce((s, r) => s + r.attendance_rate, 0) / sorted.length)}%</strong></span>
            <span>Top attender: <strong className="text-white">{[...sorted].sort((a, b) => b.join - a.join)[0]?.profile.character_name ?? [...sorted].sort((a, b) => b.join - a.join)[0]?.profile.username ?? '—'}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
