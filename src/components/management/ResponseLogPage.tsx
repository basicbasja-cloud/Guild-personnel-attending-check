import { Fragment, useMemo, useState } from 'react';
import { addDays, format, formatISO, startOfDay } from 'date-fns';
import { useAttendanceResponseLog, type AttendanceLogEntry } from '../../hooks/useAttendanceResponseLog';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { getUpcomingSaturday, isDoubleWarWeek } from '../../lib/week';
import { downloadCsv } from '../../lib/exportCsv';
import { STATUS_CONFIG } from '../../constants/attendance';
import type { AttendanceStatus, Profile } from '../../types';

type StatusFilter = 'all' | AttendanceStatus | 'non_select';

/** True when the player actually changed their answer during the week. */
function wasChanged(e: AttendanceLogEntry) {
  return new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 2000;
}

/**
 * End of Wednesday (23:59:59) of the Mon–Sun week that contains the war
 * Saturday. Responses after this point are considered late.
 */
function weekDeadline(weekStart: string): number {
  const saturday = startOfDay(new Date(weekStart + 'T00:00:00'));
  const wednesdayEnd = addDays(saturday, -5); // back to Monday
  wednesdayEnd.setDate(wednesdayEnd.getDate() + 2); // Monday → Wednesday
  wednesdayEnd.setHours(23, 59, 59, 999);
  return wednesdayEnd.getTime();
}

/** Green = pressed on/before Wednesday of the target week, red = after. */
function isLatePress(e: AttendanceLogEntry) {
  return new Date(e.created_at).getTime() > weekDeadline(e.week_start);
}

const ON_TIME_CLASS = 'text-emerald-400';
const LATE_CLASS = 'text-red-400';

function fmtDateTime(iso: string) {
  return format(new Date(iso), 'EEE dd MMM yyyy · HH:mm');
}

function fmtWeek(weekStart: string) {
  return format(new Date(weekStart + 'T00:00:00'), 'EEE dd MMM yyyy');
}

interface PlayerRow {
  profile: Profile;
  entry: AttendanceLogEntry | null; // null = has NOT responded this week
  otherWeeks: AttendanceLogEntry[]; // responses from every other week, newest first
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'join', label: '✅ Join' },
  { id: 'maybe', label: '🤔 Maybe' },
  { id: 'not_join', label: "❌ Can't Join" },
  { id: 'non_select', label: '❓ No Answer' },
];

const NON_SELECT = {
  label: 'Non-Select',
  emoji: '❓',
  bg: 'bg-slate-800/50',
  border: 'border-slate-700',
  text: 'text-slate-400',
};

export function ResponseLogPage() {
  const { entries, loading, error, refreshing, refresh } = useAttendanceResponseLog();
  const { profiles } = useAllProfiles();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const thisWeekStr = formatISO(getUpcomingSaturday(new Date()), { representation: 'date' });
  const thisWeekLabel = fmtWeek(thisWeekStr);
  const isThisWeekDouble = isDoubleWarWeek(thisWeekStr);

  // (user_id, week_start) → entry lookup
  const entryByKey = useMemo(() => {
    const m = new Map<string, AttendanceLogEntry>();
    for (const e of entries) m.set(`${e.user_id}|${e.week_start}`, e);
    return m;
  }, [entries]);

  // ── This-week summary ───────────────────────────────────────────────────
  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { join: 0, maybe: 0, not_join: 0 };
    let changed = 0;
    for (const e of entries) {
      if (e.week_start !== thisWeekStr) continue;
      counts[e.status] += 1;
      if (wasChanged(e)) changed += 1;
    }
    const responded = counts.join + counts.maybe + counts.not_join;
    return { total: profiles.length, responded, ...counts, changed };
  }, [entries, profiles.length, thisWeekStr]);

  // ── Rows: one per player, this-week data inline ─────────────────────────
  const rows = useMemo<PlayerRow[]>(() => {
    const q = search.trim().toLowerCase();

    return profiles
      .map((profile) => ({
        profile,
        entry: entryByKey.get(`${profile.id}|${thisWeekStr}`) ?? null,
        otherWeeks: entries
          .filter((e) => e.user_id === profile.id && e.week_start !== thisWeekStr)
          .sort((a, b) => b.week_start.localeCompare(a.week_start)),
      }))
      .filter((r) => {
        const status = r.entry?.status ?? 'non_select';
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (
          q &&
          !r.profile.username.toLowerCase().includes(q) &&
          !(r.profile.character_name ?? '').toLowerCase().includes(q) &&
          !(r.profile.character_class ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // This-week responders first, newest press on top; non-responders after (A→Z)
        if (a.entry && b.entry) {
          const at = new Date(a.entry.created_at).getTime();
          const bt = new Date(b.entry.created_at).getTime();
          if (at !== bt) return bt - at;
          return a.profile.username.localeCompare(b.profile.username);
        }
        if (a.entry) return -1;
        if (b.entry) return 1;
        return a.profile.username.localeCompare(b.profile.username);
      });
  }, [entries, entryByKey, profiles, search, statusFilter, thisWeekStr]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggle = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const allOpen = rows.length > 0 && rows.every((r) => expanded.has(r.profile.id));
  const toggleAll = () => {
    setExpanded(allOpen ? new Set() : new Set(rows.map((r) => r.profile.id)));
  };

  const handleExport = () => {
    const statusLabel = (s: AttendanceStatus) => STATUS_CONFIG[s].label;
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const csvRows = entries
      .map((e) => {
        const p = e.profile ?? profileById.get(e.user_id);
        if (!p) return null;
        return {
          Username: p.username,
          'Character Name': p.character_name ?? '',
          Class: p.character_class ?? '',
          Week: e.week_start,
          Status: statusLabel(e.status),
          'First Response': fmtDateTime(e.created_at),
          'On Time (by Wed)': isLatePress(e) ? 'Late' : 'On Time',
          'Last Changed': wasChanged(e) ? fmtDateTime(e.updated_at) : '',
          'Set By':
            e.set_by_profile && e.set_by_profile.id !== p.id ? e.set_by_profile.username : '',
        };
      })
      .filter(Boolean) as Record<string, unknown>[];
    downloadCsv(csvRows, `response_times_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-xl mx-auto p-3 sm:p-4 pt-6">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-slate-700 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-white font-bold text-sm sm:text-lg flex items-center gap-2 flex-wrap">
              🕒 Response Times
              <span className="text-xs font-normal text-slate-400">
                this week: <span className="text-white">{thisWeekLabel}</span>
                {isThisWeekDouble && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300" title="Double war week">
                    ⚔️ 2×
                  </span>
                )}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                disabled={refreshing}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
              >
                {refreshing ? '⏳ Refreshing…' : '🔄 Refresh'}
              </button>
              <button
                onClick={handleExport}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                title="Export full history (all weeks) to CSV"
              >
                ⬇ Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player / character / class…"
              className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex bg-slate-800 rounded-lg p-0.5 self-start overflow-x-auto scrollbar-hide">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === f.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* This-week summary */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
              Responded: <strong className="text-white">{summary.responded}</strong>/{summary.total}
            </span>
            <span className={`px-2.5 py-1 rounded-lg border ${STATUS_CONFIG.join.bg} ${STATUS_CONFIG.join.border} ${STATUS_CONFIG.join.text}`}>
              ✅ Join: <strong>{summary.join}</strong>
            </span>
            <span className={`px-2.5 py-1 rounded-lg border ${STATUS_CONFIG.maybe.bg} ${STATUS_CONFIG.maybe.border} ${STATUS_CONFIG.maybe.text}`}>
              🤔 Maybe: <strong>{summary.maybe}</strong>
            </span>
            <span className={`px-2.5 py-1 rounded-lg border ${STATUS_CONFIG.not_join.bg} ${STATUS_CONFIG.not_join.border} ${STATUS_CONFIG.not_join.text}`}>
              ❌ Can't Join: <strong>{summary.not_join}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400">
              ♻️ Changed answer: <strong className="text-slate-200">{summary.changed}</strong>
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="m-3 sm:m-4 bg-rose-900/40 border border-rose-700 rounded-lg p-3 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="p-10 text-center text-slate-400 text-sm animate-pulse">
            ⏳ Loading response times…
          </div>
        )}

        {/* Player rows */}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="w-6 py-2 pl-3 sm:pl-4" />
                  <th className="py-2 pr-3 font-semibold">Player</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Pressed at</th>
                  <th className="py-2 pr-3 font-semibold">Last changed</th>
                  <th className="py-2 pr-3 sm:pr-4 font-semibold">Set by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500 text-sm">
                      No players match your filters.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const open = expanded.has(r.profile.id);
                  const cfg = r.entry ? STATUS_CONFIG[r.entry.status] : NON_SELECT;
                  const changed = r.entry ? wasChanged(r.entry) : false;
                  return (
                    <Fragment key={r.profile.id}>
                      {/* Player row — this week inline */}
                      <tr
                        className={`cursor-pointer transition-colors ${open ? 'bg-slate-800/40' : 'hover:bg-slate-800/30'}`}
                        onClick={() => toggle(r.profile.id)}
                      >
                        <td className="pl-3 sm:pl-4 text-slate-500 text-xs select-none">{open ? '▼' : '▶'}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {r.profile.avatar_url ? (
                              <img
                                src={r.profile.avatar_url}
                                alt={r.profile.username}
                                className="w-8 h-8 rounded-full shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs shrink-0 font-bold">
                                {r.profile.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">
                                {r.profile.character_name ?? r.profile.username}
                              </p>
                              <p className="text-slate-400 text-xs truncate">
                                {r.profile.username}
                                {r.profile.character_class ? ` · ${r.profile.character_class}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                            {cfg.emoji} {cfg.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {r.entry ? (
                            <span
                              className={isLatePress(r.entry) ? LATE_CLASS : ON_TIME_CLASS}
                              title={isLatePress(r.entry) ? 'After Wednesday — late' : 'By Wednesday — on time'}
                            >
                              {fmtDateTime(r.entry.created_at)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {changed ? (
                            <span className="text-amber-300">{fmtDateTime(r.entry!.updated_at)}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 sm:pr-4 whitespace-nowrap">
                          {r.entry ? (
                            r.entry.set_by_profile && r.entry.set_by_profile.id !== r.profile.id ? (
                              <span className="text-slate-400">
                                {r.entry.set_by_profile.username}{' '}
                                <span className="text-slate-600">(on behalf)</span>
                              </span>
                            ) : (
                              <span className="text-slate-600">Self</span>
                            )
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded — all other weeks */}
                      {open && (
                        <tr className="bg-slate-950/40">
                          <td colSpan={6} className="px-3 sm:px-4 py-3">
                            {r.otherWeeks.length === 0 ? (
                              <p className="text-xs text-slate-500">No responses in other weeks.</p>
                            ) : (
                              <>
                                <p className="text-xs text-slate-500 mb-2">
                                  Other weeks ({r.otherWeeks.length})
                                </p>
                                <div className="space-y-1.5">
                                  {r.otherWeeks.map((e) => {
                                    const c = STATUS_CONFIG[e.status];
                                    const ch = wasChanged(e);
                                    const late = isLatePress(e);
                                    const upcoming =
                                      new Date(e.week_start + 'T00:00:00').getTime() > Date.now();
                                    return (
                                      <div
                                        key={e.id}
                                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                                      >
                                        <span className="text-white w-36 shrink-0">
                                          {fmtWeek(e.week_start)}
                                          {isDoubleWarWeek(e.week_start) && (
                                            <span className="ml-1 text-amber-300" title="Double war week">
                                              ⚔️ 2×
                                            </span>
                                          )}
                                          {upcoming && (
                                            <span className="ml-1 text-sky-300" title="Upcoming week">
                                              ⏭ Upcoming
                                            </span>
                                          )}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${c.bg} ${c.border} ${c.text}`}>
                                          {c.emoji} {c.label}
                                        </span>
                                        <span
                                          className={late ? LATE_CLASS : ON_TIME_CLASS}
                                          title={late ? 'After Wednesday — late' : 'By Wednesday — on time'}
                                        >
                                          Pressed: {fmtDateTime(e.created_at)}
                                        </span>
                                        {ch && (
                                          <span className="text-amber-300">
                                            Changed: {fmtDateTime(e.updated_at)}
                                          </span>
                                        )}
                                        {e.set_by_profile && e.set_by_profile.id !== r.profile.id && (
                                          <span className="text-slate-400">
                                            Set by {e.set_by_profile.username} (on behalf)
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && rows.length > 0 && (
          <div className="px-3 sm:px-4 py-2 border-t border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {rows.length} player{rows.length !== 1 ? 's' : ''} · click a row for other weeks · times in your local timezone ·{' '}
              <span className="text-emerald-400">🟢 by Wed</span> / <span className="text-red-400">🔴 after Wed</span>
            </p>
            <button
              onClick={toggleAll}
              className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-400 hover:text-white transition-colors"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
