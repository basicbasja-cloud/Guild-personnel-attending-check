import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useKpiBoard, invalidateKpiBoardCache } from '../../hooks/useKpiBoard';
import { KPI_BOARDS, getKpiRoleShortLabel, formatKpiNumber } from '../../constants/kpi';
import type { KpiBoardRow, KpiMetricKey, KpiRoleTag } from '../../types';

// ── Cache for raw entries (in-memory + localStorage) ──────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const CACHE_PREFIX = 'gwm_kpi_entries_v4_';

const entriesMemCache = new Map<string, { at: number; entries: KpiAllEntry[] }>();

function readEntriesCache(key: string): { at: number; entries: KpiAllEntry[] } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch { return null; }
}

function writeEntriesCache(key: string, entries: KpiAllEntry[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), entries }));
  } catch { /* quota */ }
}

function entriesCacheKey(weekStart: string) { return `${CACHE_PREFIX}${weekStart}`; }

/** Invalidate entries cache (call after stats are saved) */
export function invalidateKpiEntriesCache(weekStart: string) {
  const key = entriesCacheKey(weekStart);
  entriesMemCache.delete(key);
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

interface KpiAwardsBoardProps {
  isSuperManager: boolean;
  weekStart:      string;
}

// ── Raw entry type (kpi_weekly_entries + profile join) ─────────────────────────
interface KpiAllEntry {
  id: string;
  user_id: string;
  role_tag: KpiRoleTag;
  damage_dealt: number;
  siege_damage: number;
  damage_taken: number;
  kills: number;
  deaths: number;
  assists: number;
  healing_done: number;
  ally_revives: number;
  resources_gathered: number;
  profile: { username: string; character_name: string | null; character_class: string | null; is_test_account: boolean } | null;
}

type ScoreKey = 'sc_overall' | 'sc_glass_cannon' | 'sc_game_changer' | 'sc_gatebreaker' | 'sc_logistics_master' | 'sc_resilient_guardian';
type SortKey = KpiMetricKey | 'name' | ScoreKey;

const ALL_COLS: { key: SortKey; label: string; title: string; score?: true }[] = [
  { key: 'name',                   label: 'Member',    title: 'Member' },
  { key: 'sc_overall',             label: '⭐ Score',   title: 'Overall Score (role-based formula)',                          score: true },
  { key: 'damage_dealt',           label: 'DMG',       title: 'Player Damage' },
  { key: 'siege_damage',           label: 'Siege',     title: 'Siege Damage' },
  { key: 'kills',                  label: 'K',         title: 'Kills' },
  { key: 'deaths',                 label: 'D',         title: 'Deaths' },
  { key: 'assists',                label: 'A',         title: 'Assists' },
  { key: 'healing_done',           label: 'Heal',      title: 'Healing Done' },
  { key: 'ally_revives',           label: 'Rev',       title: 'Ally Revives' },
  { key: 'damage_taken',           label: 'Taken',     title: 'Damage Taken' },
  { key: 'resources_gathered',     label: 'Res',       title: 'Resources Gathered' },
  // ── Category scores ───────────────────────────────────────────────────────
  { key: 'sc_glass_cannon',        label: '🔥 GC',     title: 'Glass Cannon: DMG×0.35 + Kills×25000 + Assists×3000',        score: true },
  { key: 'sc_game_changer',        label: '🛡️ GM',     title: 'Game Changer: Taken×0.35 + Assists×200 − Deaths×3K',   score: true },
  { key: 'sc_gatebreaker',         label: '🏰 GB',     title: 'Gatebreaker: Siege×0.15 + Kills×10000 + Assists×3000',      score: true },
  { key: 'sc_logistics_master',    label: '📦 LM',     title: 'Logistics Master: Resources×1400 + Taken×0.04 + Assists×2K', score: true },
  { key: 'sc_resilient_guardian',  label: '💚 RG',     title: 'Resilient Guardian: Healing×0.3 + Revives×60000 + Assists×2K', score: true },
];

function computeEntryScores(e: KpiAllEntry) {
  // ── v4.0 Dynamic Role Classification ──
  let effectiveRole = e.role_tag;
  if (effectiveRole === 'ROLE_DPS_DEF') effectiveRole = 'ROLE_DPS_DMG';
  if (effectiveRole === 'ROLE_DPS_DMG') {
    if (e.kills > 10 && e.siege_damage < (e.damage_dealt * 0.15)) {
      effectiveRole = 'ROLE_DPS_ASSASSIN';
    } else if (e.siege_damage > (e.damage_dealt * 1.5) && e.siege_damage > 500000) {
      effectiveRole = 'ROLE_DPS_SIEGE';
    }
  }

  // ── v4.0 Additive Score Formulas ──
  let sc_overall = 0;
  switch (effectiveRole) {
    case 'ROLE_DPS_DMG':
      sc_overall = Math.round((e.damage_dealt * 0.4) + (e.siege_damage * 0.2) + (e.kills * 20000) + (e.assists * 5000) - (e.deaths * 8000));
      break;
    case 'ROLE_DPS_ASSASSIN': {
      const takedowns = e.kills + (0.4 * e.assists);
      const deathPenalty = (takedowns >= e.deaths * 2) ? 0 : e.deaths * 3000;
      sc_overall = Math.round((e.damage_dealt * 0.55) + (e.kills * 30000) + (e.assists * 4000) - deathPenalty);
      break;
    }
    case 'ROLE_DPS_SIEGE':
      sc_overall = Math.round((e.siege_damage * 0.20) + (e.damage_dealt * 0.30) + (e.kills * 30000) + (e.assists * 10000) - (e.deaths * 8000));
      break;
    case 'ROLE_TANK':
      sc_overall = Math.round((e.damage_taken * 0.15) + (e.assists * 15000) + (e.damage_dealt * 0.25) - (e.deaths * 5000));
      break;
    case 'ROLE_HEALER':
      sc_overall = Math.round((e.healing_done * 0.35) + (e.assists * 6000) + (e.ally_revives * 50000) - (e.deaths * 6000));
      break;
    case 'ROLE_RESOURCE':
      sc_overall = Math.round((e.resources_gathered * 600) + (e.damage_taken * 0.20) + (e.assists * 15000) - (e.deaths * 15000));
      break;
    default:
      sc_overall = 0;
  }

  return {
    sc_overall: Math.max(0, sc_overall),
    sc_glass_cannon:       Math.round(e.damage_dealt * 0.35 + e.kills * 25000 + e.assists * 3000),
    sc_game_changer:       Math.round(e.damage_taken * 0.35 + e.assists * 200 - e.deaths * 3000),
    sc_gatebreaker:        Math.round(e.siege_damage * 0.15 + e.kills * 10000 + e.assists * 3000),
    sc_logistics_master:   Math.round(e.resources_gathered * 1400 + e.damage_taken * 0.04 + e.assists * 2000),
    sc_resilient_guardian: Math.round(e.healing_done * 0.3 + e.ally_revives * 60000 + e.assists * 2000),
  };
}

const MEDAL = [
  { label: '🥇', bg: 'bg-amber-900/40',  text: 'text-amber-300',  border: 'border-amber-700/40' },
  { label: '🥈', bg: 'bg-slate-700/40',  text: 'text-slate-200',  border: 'border-slate-600/40' },
  { label: '🥉', bg: 'bg-amber-950/60',  text: 'text-amber-700',  border: 'border-amber-900/40' },
];

const ROLE_PILL_CLASS: Record<string, string> = {
  ROLE_DPS_DMG:      'bg-red-950/60 text-red-300 border-red-800/40',
  ROLE_DPS_ASSASSIN: 'bg-purple-950/60 text-purple-300 border-purple-800/40',
  ROLE_DPS_SIEGE:    'bg-amber-950/60 text-amber-300 border-amber-800/40',
  ROLE_TANK:         'bg-blue-950/60 text-blue-300 border-blue-800/40',
  ROLE_HEALER:       'bg-green-950/60 text-green-300 border-green-800/40',
  ROLE_RESOURCE:     'bg-teal-950/60 text-teal-300 border-teal-800/40',
};

function RolePill({ roleTag }: { roleTag: KpiRoleTag }) {
  const cls = ROLE_PILL_CLASS[roleTag] ?? 'bg-slate-800 text-slate-400 border-slate-700';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {getKpiRoleShortLabel(roleTag)}
    </span>
  );
}

function BoardCard({
  boardName,
  allRows,
  isSuperManager,
}: {
  boardName:      string;
  allRows:        KpiBoardRow[];
  isSuperManager: boolean;
}) {
  const meta = KPI_BOARDS.find((b) => b.name === boardName);
  const rows = useMemo(
    () => allRows.filter((r) => r.board_name === boardName).slice(0, 3),
    [allRows, boardName],
  );

  if (!meta) return null;

  return (
    <div className={`rounded-2xl overflow-hidden border ${meta.colorClass} flex flex-col`}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-2xl">{meta.emoji}</span>
          <span className="text-white font-bold text-base">{meta.label}</span>
        </div>
        <p className="text-slate-400 text-xs">{meta.subtitle}</p>
      </div>

      <div className="h-px bg-white/5 mx-4" />

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
                <span className="text-lg w-6 shrink-0 text-center">{medal.label}</span>

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



export function KpiAwardsBoard({ isSuperManager, weekStart }: KpiAwardsBoardProps) {
  const { rows, loading, error, refresh } = useKpiBoard(weekStart);
  const hasData = rows.length > 0;

  // Super manager: fetch all raw entries for the selected week
  const [allEntries, setAllEntries]           = useState<KpiAllEntry[]>([]);
  const [allEntriesLoading, setAllEntriesLoading] = useState(false);
  const [sortKey, setSortKey]                 = useState<SortKey>('sc_overall');
  const [sortAsc, setSortAsc]                 = useState(false);

  useEffect(() => {
    if (!isSuperManager) return;

    const key = entriesCacheKey(weekStart);

    // Check in-memory cache first
    const mem = entriesMemCache.get(key);
    if (mem && Date.now() - mem.at < CACHE_TTL_MS) {
      setAllEntries(mem.entries);
      return;
    }

    // Check localStorage cache
    const local = readEntriesCache(key);
    if (local && Date.now() - local.at < CACHE_TTL_MS) {
      entriesMemCache.set(key, local);
      setAllEntries(local.entries);
      return;
    }

    setAllEntriesLoading(true);

    // Single RPC call: entries + profiles joined server-side, one network round-trip
    supabase
      .rpc('get_kpi_entries_with_profiles', { target_week_start: weekStart })
      .then(({ data, error }) => {
        if (error) {
          console.error('[KpiAwardsBoard] fetch error:', error);
          setAllEntries([]);
          setAllEntriesLoading(false);
          return;
        }
        const rows = (data ?? []) as {
          id: string; user_id: string; role_tag: string;
          damage_dealt: number; siege_damage: number; damage_taken: number;
          kills: number; deaths: number; assists: number;
          healing_done: number; ally_revives: number; resources_gathered: number;
          username: string; character_name: string | null;
          character_class: string | null; is_test_account: boolean;
        }[];
        const merged: KpiAllEntry[] = rows.map(r => ({
          id: r.id, user_id: r.user_id, role_tag: r.role_tag as KpiRoleTag,
          damage_dealt: r.damage_dealt, siege_damage: r.siege_damage, damage_taken: r.damage_taken,
          kills: r.kills, deaths: r.deaths, assists: r.assists,
          healing_done: r.healing_done, ally_revives: r.ally_revives, resources_gathered: r.resources_gathered,
          profile: {
            username: r.username,
            character_name: r.character_name,
            character_class: r.character_class,
            is_test_account: r.is_test_account,
          },
        }));

        // Cache the result
        entriesMemCache.set(key, { at: Date.now(), entries: merged });
        writeEntriesCache(key, merged);

        setAllEntries(merged);
        setAllEntriesLoading(false);
      });
  }, [weekStart, isSuperManager]);

  const sortedEntries = useMemo(() => {
    return [...allEntries]
      .filter(e => !e.profile?.is_test_account)
      .sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortKey === 'name') {
        av = (a.profile?.character_name || a.profile?.username || '').toLowerCase();
        bv = (b.profile?.character_name || b.profile?.username || '').toLowerCase();
      } else if (sortKey.startsWith('sc_')) {
        av = computeEntryScores(a)[sortKey as ScoreKey];
        bv = computeEntryScores(b)[sortKey as ScoreKey];
      } else {
        av = a[sortKey as KpiMetricKey] as number;
        bv = b[sortKey as KpiMetricKey] as number;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ?  1 : -1;
      return 0;
    });
  }, [allEntries, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          🏆 Guild League Awards
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
            title="Refresh"
          >
            ↺
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {KPI_BOARDS.map((b) => (
            <div key={b.name} className="rounded-2xl bg-slate-900 border border-slate-700 h-52 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-2xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-12 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-slate-300 font-medium">No war data for this week yet</p>
          <p className="text-slate-500 text-sm mt-1">Officers can enter post-war stats from the controls above</p>
        </div>
      )}

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

      {/* ── Super-manager: all raw scores ─────────────────────────────────── */}
      {isSuperManager && (
        <div className="mt-6">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            📋 All Member Scores
            <span className="text-slate-500 font-normal text-xs">· {allEntries.filter(e => !e.profile?.is_test_account).length} entries</span>
          </h3>
          {allEntriesLoading ? (
            <div className="h-24 bg-slate-900 border border-slate-700 rounded-2xl animate-pulse" />
          ) : allEntries.length === 0 ? (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-6 text-center">
              <p className="text-slate-500 text-sm">No entries for this week yet</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs">
                      {ALL_COLS.map(col => (
                        <th
                          key={col.key}
                          title={col.title}
                          onClick={() => toggleSort(col.key)}
                          className={`px-3 py-2.5 text-left cursor-pointer select-none whitespace-nowrap hover:text-white transition-colors ${sortKey === col.key ? 'text-white' : ''}`}
                        >
                          {col.label}
                          {sortKey === col.key && (
                            <span className="ml-1 opacity-70">{sortAsc ? '▲' : '▼'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sortedEntries.map(entry => {
                      const sc = computeEntryScores(entry);
                      return (
                      <tr key={entry.id} className={`hover:bg-slate-800/40 transition-colors ${entry.profile?.is_test_account ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2 min-w-[140px]">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-medium truncate max-w-[150px]">
                              {entry.profile?.character_name || entry.profile?.username || '—'}
                            </p>
                            {entry.profile?.is_test_account && (
                              <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700/40">TEST</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <RolePill roleTag={entry.role_tag} />
                            {entry.profile?.character_class && (
                              <span className="text-slate-600 text-[10px]">{entry.profile.character_class}</span>
                            )}
                          </div>
                        </td>
                        {/* Overall score — role-based, highlighted */}
                        <td className="px-3 py-2">
                          <span className={`font-mono tabular-nums font-semibold text-sm ${sortKey === 'sc_overall' ? 'text-yellow-300' : 'text-yellow-400/80'}`}>
                            {formatKpiNumber(sc.sc_overall)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{formatKpiNumber(entry.damage_dealt)}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{formatKpiNumber(entry.siege_damage)}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{entry.kills}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{entry.deaths}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{entry.assists}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{formatKpiNumber(entry.healing_done)}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{entry.ally_revives}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{formatKpiNumber(entry.damage_taken)}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono tabular-nums">{formatKpiNumber(entry.resources_gathered)}</td>
                        {/* Computed scores */}
                        <td className="px-3 py-2 text-amber-300 font-mono tabular-nums text-xs">{formatKpiNumber(sc.sc_glass_cannon)}</td>
                        <td className="px-3 py-2 text-amber-300 font-mono tabular-nums text-xs">{formatKpiNumber(sc.sc_game_changer)}</td>
                        <td className="px-3 py-2 text-amber-300 font-mono tabular-nums text-xs">{formatKpiNumber(sc.sc_gatebreaker)}</td>
                        <td className="px-3 py-2 text-amber-300 font-mono tabular-nums text-xs">{formatKpiNumber(sc.sc_logistics_master)}</td>
                        <td className="px-3 py-2 text-amber-300 font-mono tabular-nums text-xs">{formatKpiNumber(sc.sc_resilient_guardian)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
