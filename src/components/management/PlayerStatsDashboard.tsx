import { useState, useEffect, useMemo } from 'react';
import { formatISO, subWeeks, addWeeks } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { getUpcomingSaturday } from '../../lib/week';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { downloadCsv } from '../../lib/exportCsv';
import { WeeklyTrendChart } from './WeeklyTrendChart';
import { ClassBreakdownChart } from './ClassBreakdownChart';
import type { Profile } from '../../types';

const HISTORY_WEEKS = 12; // how many weeks back to include
const HIGH_JOIN_THRESHOLD = 60;
const PROGRAM_START_DATE = '2026-04-18'; // first Saturday the program launched

type DashboardTab = 'war' | 'training' | 'summary';

interface WeekRow {
  user_id: string;
  week_start: string;
  status: string;
}

interface PlayerStat {
  profile: Profile;
  join: number;
  maybe: number;
  not_join: number;
  non_select: number;
  total: number;
  attendance_rate: number; // (join + maybe) / total
  main_skill: string;
  sub_skill: string;
  /** Summary-only: weighted active score (war 0.7 + training 0.3) */
  active_score?: number;
  war_rate?: number;
  training_rate?: number;
}

type SortKey = 'username' | 'join' | 'maybe' | 'not_join' | 'non_select' | 'attendance_rate' | 'active_score' | 'main_skill' | 'sub_skill';

function buildWeekStrs(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = subWeeks(getUpcomingSaturday(today), i);
    return formatISO(d, { representation: 'date' });
  });
}

function useAttendanceStats(): {
  rows: WeekRow[];
  weeks: string[];
  totalWeeks: number;
  allTimeRows: WeekRow[];
  loading: boolean;
} {
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [allTimeRows, setAllTimeRows] = useState<WeekRow[]>([]);
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weeks] = useState<string[]>(() => buildWeekStrs(HISTORY_WEEKS));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Single query — fetch all attendance data, derive 12-week subset client-side
    supabase
      .from('attendance')
      .select('user_id,week_start,status')
      .then(({ data }) => {
        if (cancelled) return;
        const all = (data as WeekRow[]) ?? [];
        setAllTimeRows(all);

        // totalWeeks: number of weeks from program start (2026-04-18) to current week
        const first = new Date(PROGRAM_START_DATE + 'T00:00:00');
        const now = getUpcomingSaturday(new Date());
        const span = Math.max(1, Math.round((now.getTime() - first.getTime()) / MS_PER_WEEK) + 1);
        setTotalWeeks(span);

        // Derive 12-week subset for chart
        const weekSet = new Set(weeks);
        setRows(all.filter((r) => weekSet.has(r.week_start)));
        setLoading(false);
      }, () => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [weeks]);

  return { rows, weeks, totalWeeks, allTimeRows, loading };
}

function useTrainingStats(): {
  rows: WeekRow[];
  weeks: string[];
  loading: boolean;
  eventCount: number;
} {
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Get all training events with their dates
    supabase
      .from('guild_events')
      .select('id,event_date')
      .eq('event_type', 'training')
      .not('event_date', 'is', null)
      .order('event_date', { ascending: false })
      .then(({ data: events }) => {
        if (cancelled) return;
        const eventList = (events ?? []) as { id: string; event_date: string }[];
        setEventCount(eventList.length);

        if (eventList.length === 0) {
          setRows([]);
          setWeeks([]);
          setLoading(false);
          return;
        }

        const eventIds = eventList.map((e) => e.id);

        // Get training attendance for all events
        supabase
          .from('training_attendance')
          .select('user_id,event_id,status')
          .in('event_id', eventIds)
          .then(({ data: attRows }) => {
            if (cancelled) return;
            const raw = (attRows ?? []) as { user_id: string; event_id: string; status: string }[];

            // Build a map from event_id → ISO week start (Monday)
            const eventWeekMap = new Map<string, string>();
            for (const ev of eventList) {
              const d = new Date(ev.event_date + 'T00:00:00');
              const day = d.getDay();
              const monOffset = day === 0 ? -6 : 1 - day; // Monday
              const monday = new Date(d);
              monday.setDate(d.getDate() + monOffset);
              const weekStr = monday.toISOString().slice(0, 10);
              eventWeekMap.set(ev.id, weekStr);
            }

            // Build unique sorted week list
            const weekSet = new Set(eventWeekMap.values());
            const sortedWeeks = Array.from(weekSet).sort();
            setWeeks(sortedWeeks);

            // Map attendance rows to week_start
            const mapped: WeekRow[] = raw
              .filter((r) => eventWeekMap.has(r.event_id))
              .map((r) => ({
                user_id: r.user_id,
                week_start: eventWeekMap.get(r.event_id)!,
                status: r.status,
              }));
            setRows(mapped);
            setLoading(false);
          }, () => { if (!cancelled) setLoading(false); });
      }, () => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { rows, weeks, loading, eventCount };
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function weeksBetween(firstDate: Date, secondDate: Date): number {
  return Math.max(1, Math.round((secondDate.getTime() - firstDate.getTime()) / MS_PER_WEEK) + 1);
}

function buildStats(profiles: Profile[], rows: { user_id: string; week_start: string; status: string }[]): PlayerStat[] {
  // Track first recorded week per user
  const firstWeekByUser = new Map<string, string>();
  const statusByUser = new Map<string, { join: number; maybe: number; not_join: number }>();
  for (const r of rows) {
    const s = statusByUser.get(r.user_id) ?? { join: 0, maybe: 0, not_join: 0 };
    if (r.status === 'join' || r.status === 'not_join' || r.status === 'maybe') {
      s[r.status]++;
    }
    statusByUser.set(r.user_id, s);

    // Track earliest week for this user
    if (r.week_start) {
      const existing = firstWeekByUser.get(r.user_id);
      if (!existing || r.week_start < existing) {
        firstWeekByUser.set(r.user_id, r.week_start);
      }
    }
  }

  const now = getUpcomingSaturday(new Date());

  return profiles.map((p) => {
    const s = statusByUser.get(p.id) ?? { join: 0, maybe: 0, not_join: 0 };
    const firstWk = firstWeekByUser.get(p.id);

    // Player's total eligible weeks: from their first join to current week
    const playerTotal = firstWk
      ? weeksBetween(new Date(firstWk + 'T00:00:00'), now)
      : 0;

    const responded = s.join + s.maybe + s.not_join;
    const non_select = Math.max(0, playerTotal - responded);
    const attendance_rate = playerTotal > 0
      ? Math.round(((s.join + s.maybe) / playerTotal) * 100)
      : 0;
    const main_skill = p.main_skill_name
      ? `${p.main_skill_name}${p.main_skill_level != null ? ` Lv.${p.main_skill_level}` : ''}`
      : '';
    const sub_skill = p.sub_skill_name
      ? `${p.sub_skill_name}${p.sub_skill_level != null ? ` Lv.${p.sub_skill_level}` : ''}`
      : '';
    return { profile: p, join: s.join, maybe: s.maybe, not_join: s.not_join, non_select, total: playerTotal, attendance_rate, main_skill, sub_skill };
  });
}

export function PlayerStatsDashboard() {
  const { profiles } = useAllProfiles();
  const [tab, setTab] = useState<DashboardTab>('summary');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('active_score');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [allTime, setAllTime] = useState(false);

  const warStats = useAttendanceStats();
  const trainingStats = useTrainingStats();

  const warSourceRows = allTime ? warStats.allTimeRows : warStats.rows;
  const warStatList = useMemo(
    () => buildStats(profiles, warSourceRows),
    [profiles, warSourceRows]
  );
  const allTimeWeeks = useMemo(() => {
    // Generate continuous weeks from program start to now, newest first.
    // The WeeklyTrendChart reverses the array, which results in oldest-left → newest-right.
    const first = new Date(PROGRAM_START_DATE + 'T00:00:00');
    const last = getUpcomingSaturday(new Date());
    const weeks: string[] = [];
    let cur = new Date(last);
    while (cur >= first) {
      weeks.push(formatISO(cur, { representation: 'date' }));
      cur = addWeeks(cur, -1);
    }
    return weeks;
  }, [warStats.allTimeRows]);
  const trainingStatList = useMemo(
    () => buildStats(profiles, trainingStats.rows),
    [profiles, trainingStats.rows]
  );

  const stats = useMemo(() => {
    if (tab === 'summary') {
      // Combine war + training into a single summary with weighted active score
      const warMap = new Map(warStatList.map((s) => [s.profile.id, s]));
      const trainingMap = new Map(trainingStatList.map((s) => [s.profile.id, s]));
      return profiles.map((p) => {
        const w = warMap.get(p.id);
        const t = trainingMap.get(p.id);
        const warRate = w?.attendance_rate ?? 0;
        const trainingRate = t?.attendance_rate ?? 0;
        return {
          profile: p,
          join: (w?.join ?? 0) + (t?.join ?? 0),
          maybe: (w?.maybe ?? 0) + (t?.maybe ?? 0),
          not_join: (w?.not_join ?? 0) + (t?.not_join ?? 0),
          non_select: (w?.non_select ?? 0) + (t?.non_select ?? 0),
          total: (w?.total ?? 0) + (t?.total ?? 0),
          attendance_rate: 0, // not meaningful in combined view
          main_skill: p.main_skill_name
            ? `${p.main_skill_name}${p.main_skill_level != null ? ` Lv.${p.main_skill_level}` : ''}`
            : '',
          sub_skill: p.sub_skill_name
            ? `${p.sub_skill_name}${p.sub_skill_level != null ? ` Lv.${p.sub_skill_level}` : ''}`
            : '',
          active_score: Math.round(warRate * 0.7 + trainingRate * 0.3),
          war_rate: warRate,
          training_rate: trainingRate,
        };
      });
    }
    return tab === 'war' ? warStatList : trainingStatList;
  }, [profiles, tab, warStatList, trainingStatList]);

  const loading = tab === 'war' ? warStats.loading : tab === 'training' ? trainingStats.loading : warStats.loading || trainingStats.loading;

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
      const getVal = (s: typeof filtered[number]) => {
        if (sortKey === 'username') return s.profile.username;
        if (sortKey === 'main_skill') return s.main_skill;
        if (sortKey === 'sub_skill') return s.sub_skill;
        return s[sortKey] ?? 0;
      };
      const av = getVal(a);
      const bv = getVal(b);
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
    const baseFields = sorted.map((s) => ({
      Username: s.profile.username,
      'Character Name': s.profile.character_name ?? '',
      Class: s.profile.character_class ?? '',
      'Main Skill': s.main_skill,
      'Sub Skill': s.sub_skill,
      Join: s.join,
      Maybe: s.maybe,
      "Can't Join": s.not_join,
      'Non-Select': s.non_select,
      ...(tab === 'summary'
        ? { 'Active Score (war×0.7 + training×0.3)': s.active_score ?? '', 'War Rate': `${s.war_rate ?? 0}%`, 'Training Rate': `${s.training_rate ?? 0}%` }
        : { 'Attendance Rate (%)': s.attendance_rate, Total: s.total }),
    }));
    downloadCsv(
      baseFields,
      `player_stats_${tab}_${new Date().toISOString().slice(0, 10)}.csv`
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
          <div className="flex items-center gap-4">
            <h2 className="text-white font-bold text-lg">Player Stats Dashboard</h2>
            {/* Sub-tabs */}
            <div className="flex bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setTab('summary')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tab === 'summary'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📊 Summary
              </button>
              <button
                onClick={() => setTab('war')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tab === 'war'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚔️ War
              </button>
              <button
                onClick={() => setTab('training')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  tab === 'training'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏋️ Training
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-slate-400 text-xs mr-1">
              {tab === 'summary' ? 'War ×0.7 + Training ×0.3' : tab === 'war' ? `Last ${HISTORY_WEEKS} weeks` : `${trainingStats.eventCount} training events`}
              · {profiles.length} players
            </p>
            {tab === 'war' && (
              <button
                onClick={() => setAllTime((a) => !a)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  allTime
                    ? 'bg-indigo-700 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
                }`}
              >
                {allTime ? '📅 All Time' : '📅 12 Weeks'}
              </button>
            )}
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
          <>
            {/* Charts section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
              {tab === 'war' && (() => {
                const chartRows = allTime ? warStats.allTimeRows : warStats.rows;
                const chartWeeks = allTime ? allTimeWeeks : warStats.weeks;
                return (
                  <WeeklyTrendChart weeks={chartWeeks} rows={chartRows} />
                );
              })()}
              {tab === 'training' && (
                <WeeklyTrendChart
                  weeks={trainingStats.weeks}
                  rows={trainingStats.rows}
                  onBarClick={(week) => setSelectedWeek(week === selectedWeek ? null : week)}
                />
              )}
              {selectedWeek && tab === 'training' ? (
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm">🏛️ Class Breakdown — week of {selectedWeek}</h3>
                    <button
                      onClick={() => setSelectedWeek(null)}
                      className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <ClassBreakdownChart
                    rows={trainingStats.rows.filter((r) => r.week_start === selectedWeek)}
                    profiles={profiles}
                  />
                </div>
              ) : (
                <ClassBreakdownChart
                  rows={tab === 'war' ? warStats.rows : tab === 'training' ? trainingStats.rows : [...warStats.rows, ...trainingStats.rows]}
                  profiles={profiles}
                />
              )}
            </div>
            {/* Summary stats cards */}
            {tab === 'war' && (() => {
              // Use all-time or 12-week data based on toggle
              const sourceRows = allTime ? warStats.allTimeRows : warStats.rows;

              // Per-week stats
              const joinCountByWeek = new Map<string, number>();
              const weekSet = new Set<string>();
              for (const r of sourceRows) {
                weekSet.add(r.week_start);
                if (r.status === 'join') {
                  joinCountByWeek.set(r.week_start, (joinCountByWeek.get(r.week_start) ?? 0) + 1);
                }
              }
              const sourceWeekCount = allTime ? warStats.totalWeeks : weekSet.size;
              const weeksWithHighJoin = Array.from(joinCountByWeek.values()).filter((c) => c >= HIGH_JOIN_THRESHOLD).length;
              const avgJoinPerWeek = sourceWeekCount > 0
                ? Math.round(Array.from(joinCountByWeek.values()).reduce((a, b) => a + b, 0) / sourceWeekCount)
                : 0;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4 pb-4">
                  <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3 text-center">
                    <p className="text-xs text-slate-400">Weeks (total)</p>
                    <p className="text-xl font-bold text-white">{warStats.totalWeeks}</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3 text-center">
                    <p className="text-xs text-slate-400">Avg Join / Week</p>
                    <p className="text-xl font-bold text-emerald-400">{avgJoinPerWeek}</p>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3 text-center">
                    <p className="text-xs text-slate-400">≥{HIGH_JOIN_THRESHOLD} Join Weeks</p>
                    <p className="text-xl font-bold text-indigo-400">{weeksWithHighJoin}</p>
                  </div>
                </div>
              );
            })()}
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 border-b border-slate-700">
                <tr>
                  <Th label="Player" k="username" />
                  <th className="px-3 py-3 text-xs font-semibold text-slate-400 text-left">Class</th>
                  <Th label="⚡ Main Skill" k="main_skill" />
                  <Th label="✦ Sub Skill" k="sub_skill" />
                  {tab === 'summary' && <Th label="🎯 Active" k="active_score" right />}
                  <Th label="✅ Join" k="join" right />
                  <Th label="🤔 Maybe" k="maybe" right />
                  <Th label="❌ Can't" k="not_join" right />
                  <Th label="❓ Non-Select" k="non_select" right />
                  {tab !== 'summary' && <Th label="Rate" k="attendance_rate" right />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={tab === 'summary' ? 10 : 9} className="text-center text-slate-500 py-10">No players found.</td>
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
                      <td className="px-3 py-2.5 text-xs">
                        {s.main_skill ? (
                          <span className="px-1.5 py-0.5 rounded bg-violet-700/40 text-violet-200 border border-violet-600/30">{s.main_skill}</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {s.sub_skill ? (
                          <span className="px-1.5 py-0.5 rounded bg-sky-700/40 text-sky-200 border border-sky-600/30">{s.sub_skill}</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      {tab === 'summary' && (
                        <td className="px-3 py-2.5 text-right">
                          {s.active_score != null ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    s.active_score >= 70 ? 'bg-indigo-500' : s.active_score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${s.active_score}%` }}
                                />
                              </div>
                              <span className={`font-semibold w-8 text-right ${
                                s.active_score >= 70 ? 'text-indigo-400' : s.active_score >= 40 ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {s.active_score}
                              </span>
                            </div>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                      )}
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
        </>)}

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
