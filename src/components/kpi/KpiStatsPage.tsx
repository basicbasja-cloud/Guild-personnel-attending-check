import { useState, useMemo, useRef } from 'react';
import { formatISO } from 'date-fns';
import { getUpcomingSaturday, isDoubleWarWeek } from '../../lib/week';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { KpiAwardsBoard } from './KpiAwardsBoard';
import { KpiPersonalCard } from './KpiPersonalCard';
import { KpiEntryModal } from './KpiEntryModal';
import { invalidateKpiProfileCache } from '../../hooks/useKpiProfile';
import { downloadKpiTemplate, parseKpiExcel } from '../../lib/kpiExcel';
import type { ParsedKpiRow } from '../../lib/kpiExcel';
import { useKpiBulkImport } from '../../hooks/useKpiBulkImport';
import { SnakeGame } from './SnakeGame';
import { MemoryMatch } from './MemoryMatch';
import { ReactionTest } from './ReactionTest';
import { AimTrainer } from './AimTrainer';
import { SequenceMemory } from './SequenceMemory';
import { PongGame } from './PongGame';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { Leaderboard } from './Leaderboard';
import type { GameType } from '../../hooks/useLeaderboard';

interface KpiStatsPageProps {
  currentUserId:  string;
  isSuperManager: boolean;
  isManager:      boolean;
  /** Disabled members are view-only: no stat entry, no mini games. */
  isDisabled?:    boolean;
}

function defaultWeek(): string {
  return formatISO(getUpcomingSaturday(new Date()), { representation: 'date' });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function KpiStatsPage({ currentUserId, isSuperManager, isManager, isDisabled = false }: KpiStatsPageProps) {
  const [weekStart, setWeekStart]     = useState<string>(defaultWeek);
  const [warSlot, setWarSlot]         = useState<1 | 2>(1);
  const [search, setSearch]           = useState('');
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [entryTarget, setEntryTarget] = useState<{ id: string; username: string } | null>(null);
  const [boardKey, setBoardKey]       = useState(0);
  const [importOpen, setImportOpen]   = useState(false);
  const [parsedRows, setParsedRows]   = useState<ParsedKpiRow[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importing, results, bulkImport, reset: resetImport } = useKpiBulkImport();
  const [miniGamesOpen, setMiniGamesOpen] = useState(false);
  const [activeMiniGame, setActiveMiniGame] = useState<GameType>('snake');
  const lb = useLeaderboard(activeMiniGame, currentUserId, isDisabled);

  const isDouble      = useMemo(() => isDoubleWarWeek(weekStart), [weekStart]);
  // War 2 is stored as saturday+1 (Sunday slot) to keep the unique DB constraint intact
  const entryWeekStart = warSlot === 2 ? addDays(weekStart, 1) : weekStart;
  const warLabel       = isDouble
    ? `${warSlot === 1 ? 'War 1' : 'War 2'} · ${formatWeekLabel(weekStart)}`
    : formatWeekLabel(weekStart);

  const handleWeekChange = (next: string) => {
    setWeekStart(next);
    setWarSlot(1);
  };

  const { profiles } = useAllProfiles();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.id !== currentUserId && // own stats use the "My Stats" button
        p.is_disabled !== true && // disabled members are excluded from KPI entry
        (p.username.toLowerCase().includes(q) ||
        (p.character_name ?? '').toLowerCase().includes(q)),
    );
  }, [profiles, search, currentUserId]);

  const handleSaved = () => {
    // Invalidate the current user's profile cache so Personal Card updates
    if (entryTarget) invalidateKpiProfileCache(entryTarget.id);
    setEntryTarget(null);
    setPickerOpen(false);
    setBoardKey((k) => k + 1); // force KpiAwardsBoard remount → picks up fresh cache
  };

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-6 space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            ⚔️ Guild League Stats
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Post-war performance boards &amp; personal metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Disabled members cannot enter stats — show a notice instead */}
          {isDisabled ? (
            <span className="text-amber-300 text-xs bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2">
              🚫 Account disabled — stats are view-only
            </span>
          ) : (
            <>
              {/* Every member can enter their own stats */}
              <button
                onClick={() => setEntryTarget({ id: currentUserId, username: 'My Stats' })}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                📝 My Stats
              </button>

              {/* Managers and super managers can enter stats for any member */}
              {(isManager || isSuperManager) && (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  + Enter Stats
                </button>
              )}
            </>
          )}

          {/* Super manager: Excel tools */}
          {isSuperManager && (
            <>
              <button
                onClick={() => downloadKpiTemplate(profiles)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                📥 Template
              </button>
              <button
                onClick={() => {
                  resetImport();
                  setParsedRows(null);
                  setImportFileName('');
                  setImportOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                📤 Import Excel
              </button>
            </>
          )}

          {/* 🎮 Mini Games — disabled members cannot interact */}
          {!isDisabled && (
            <button
              onClick={() => setMiniGamesOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-purple-900/40 transition-all hover:scale-105 active:scale-95"
            >
              🎮 Mini Games
            </button>
          )}
        </div>
      </div>

      {/* Global Controls Bar */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm font-medium">Select Week:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleWeekChange(addDays(weekStart, -7))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
            >
              ◀
            </button>
            <span className="text-white text-sm font-semibold px-2 min-w-[120px] text-center">
              {formatWeekLabel(weekStart)}
            </span>
            <button
              onClick={() => handleWeekChange(addDays(weekStart, 7))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
            >
              ▶
            </button>
          </div>
        </div>

        {/* War slot toggle — only on double-war weeks */}
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm font-medium">
            {isDouble ? 'This week has 2 wars:' : 'This week has 1 war:'}
          </span>
          {isDouble ? (
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              <button
                onClick={() => setWarSlot(1)}
                className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                  warSlot === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ⚔️ War 1
              </button>
              <button
                onClick={() => setWarSlot(2)}
                className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                  warSlot === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ⚔️ War 2
              </button>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs font-medium">
              ⚔️ Single War
            </div>
          )}
        </div>
      </div>

      {/* Awards Board */}
      <KpiAwardsBoard key={`${boardKey}-${entryWeekStart}`} isSuperManager={isSuperManager} weekStart={entryWeekStart} currentUserId={currentUserId} />

      {/* Personal metrics */}
      <div>
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          📊 Your Metrics
          <span className="text-slate-500 font-normal">· {warLabel}</span>
        </h2>

        <KpiPersonalCard key={`${boardKey}-${entryWeekStart}`} userId={currentUserId} weekStart={entryWeekStart} isSuperManager={isSuperManager} />
      </div>

      {/* Member picker (officer only) */}
      {pickerOpen && !entryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh]">

            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
              <h3 className="text-white font-semibold text-sm">Select Member</h3>
              <button
                onClick={() => { setPickerOpen(false); setSearch(''); }}
                className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700"
              >✕</button>
            </div>

            <div className="px-4 py-2 border-b border-slate-700/60 shrink-0">
              <input
                type="text"
                placeholder="Search name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
              />
            </div>

            <div className="overflow-y-auto flex-1">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setEntryTarget({ id: p.id, username: p.character_name || p.username });
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 overflow-hidden shrink-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        {(p.character_name || p.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {p.character_name || p.username}
                    </p>
                    {p.character_name && (
                      <p className="text-slate-500 text-xs truncate">{p.username}</p>
                    )}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">No members found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entry modal */}
      {entryTarget && (
        <KpiEntryModal
          targetUserId={entryTarget.id}
          targetUsername={entryTarget.username}
          weekStart={entryWeekStart}
          warLabel={warLabel}
          isSuperManager={isSuperManager}
          onClose={() => setEntryTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Hidden file input for Excel import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImportFileName(file.name);
          const rows = await parseKpiExcel(file);
          setParsedRows(rows);
          // Reset the input so the same file can be re-selected
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {/* Import Preview Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <div>
                <h2 className="text-white font-semibold">📤 Import KPI from Excel</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  {importFileName
                    ? `File: ${importFileName} · ${parsedRows ? parsedRows.length : 0} rows found`
                    : 'Select an Excel file to import'}
                </p>
              </div>
              <button
                onClick={() => { setImportOpen(false); setParsedRows(null); resetImport(); }}
                className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
              >✕</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* File selector (when no file loaded yet) */}
              {!parsedRows && (
                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center">
                  <p className="text-4xl mb-3">📄</p>
                  <p className="text-slate-300 font-medium mb-2">Upload an Excel file</p>
                  <p className="text-slate-500 text-sm mb-4">
                    Download the template first to see the required format
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Choose File
                    </button>
                    <button
                      onClick={() => downloadKpiTemplate(profiles)}
                      className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      📥 Download Template
                    </button>
                  </div>
                </div>
              )}

              {/* Parsed rows preview */}
              {parsedRows && parsedRows.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-400">No data rows found in the file.</p>
                </div>
              )}

              {parsedRows && parsedRows.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2">
                    Preview ({parsedRows.length} rows) — rows with <span className="text-red-400">errors</span> will be skipped
                  </p>
                  <div className="overflow-x-auto border border-slate-700 rounded-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-slate-400">
                          <th className="px-2 py-1.5 text-left">#</th>
                          <th className="px-2 py-1.5 text-left">Character</th>
                          <th className="px-2 py-1.5 text-left">Role</th>
                          <th className="px-2 py-1.5 text-right">DMG</th>
                          <th className="px-2 py-1.5 text-right">Siege</th>
                          <th className="px-2 py-1.5 text-right">Taken</th>
                          <th className="px-2 py-1.5 text-right">K</th>
                          <th className="px-2 py-1.5 text-right">D</th>
                          <th className="px-2 py-1.5 text-right">A</th>
                          <th className="px-2 py-1.5 text-right">Heal</th>
                          <th className="px-2 py-1.5 text-right">Rev</th>
                          <th className="px-2 py-1.5 text-right">Res</th>
                          <th className="px-2 py-1.5 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {parsedRows.map((row) => {
                          const hasErrors = row.errors.length > 0;
                          return (
                            <tr key={row.rowNumber} className={hasErrors ? 'bg-red-950/20' : 'hover:bg-slate-800/40'}>
                              <td className="px-2 py-1.5 text-slate-500">{row.rowNumber}</td>
                              <td className={`px-2 py-1.5 font-medium ${hasErrors ? 'text-red-400' : 'text-white'}`}>
                                {row.characterName || <span className="text-red-400">—missing—</span>}
                              </td>
                              <td className="px-2 py-1.5 text-slate-300">{row.roleTag || '—'}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.damage_dealt.toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.siege_damage.toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.damage_taken.toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.kills}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.deaths}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.assists}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.healing_done.toLocaleString()}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.ally_revives}</td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{row.resources_gathered.toLocaleString()}</td>
                              <td className="px-2 py-1.5">
                                {hasErrors ? (
                                  <span className="text-red-400 text-[10px]" title={row.errors.join(' | ')}>
                                    ⚠ Error
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 text-[10px]">✓ OK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import results */}
              {results && (
                <div className={`rounded-xl px-4 py-3 text-sm ${
                  results.errors.length === 0
                    ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
                    : results.success > 0
                      ? 'bg-amber-950/40 border border-amber-800/50 text-amber-300'
                      : 'bg-red-950/40 border border-red-800/50 text-red-300'
                }`}>
                  <p className="font-semibold">
                    ✅ {results.success} imported
                    {results.skipped > 0 && ` · ⏭ ${results.skipped} skipped`}
                    {results.errors.length > 0 && ` · ⚠ ${results.errors.length} errors`}
                  </p>
                  {results.errors.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-400 max-h-32 overflow-y-auto">
                      {results.errors.map((e, i) => (
                        <li key={i}>Row {e.row}: <span className="text-red-400">{e.message}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-700 shrink-0">
              <p className="text-xs text-slate-500">
                {results
                  ? 'Import complete'
                  : parsedRows
                    ? `Importing for week starting ${formatWeekLabel(entryWeekStart)}`
                    : ''}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setImportOpen(false); setParsedRows(null); resetImport(); }}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {results ? 'Close' : 'Cancel'}
                </button>
                {parsedRows && !results && (
                  <button
                    onClick={async () => {
                      await bulkImport(parsedRows, entryWeekStart, profiles);
                      setBoardKey((k) => k + 1);
                    }}
                    disabled={importing || parsedRows.length === 0}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {importing ? 'Importing…' : `Confirm Import (${parsedRows.filter(r => r.errors.length === 0).length} valid)`}
                  </button>
                )}
                {results && (
                  <button
                    onClick={() => { setImportOpen(false); setParsedRows(null); resetImport(); }}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎮 Mini Games Modal */}
      {miniGamesOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-700 shrink-0">
              <div>
                <h2 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                  🎮 Mini Games
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Take a break between wars!
                </p>
              </div>
              <button
                onClick={() => setMiniGamesOpen(false)}
                className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors shrink-0"
              >✕</button>
            </div>

            {/* Game tabs */}
            <div className="flex border-b border-slate-700 px-2 overflow-x-auto">
              {(['snake', 'memory', 'reaction', 'aim', 'sequence', 'pong'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setActiveMiniGame(g)}
                  className={`shrink-0 px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                    activeMiniGame === g
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {g === 'snake' ? '🐍 Snake' : g === 'memory' ? '🃏 Memory' : g === 'reaction' ? '⚡ Reaction' : g === 'aim' ? '🎯 Aim' : g === 'sequence' ? '🔢 Sequence' : '🏓 Pong'}
                </button>
              ))}
            </div>

            {/* Game content */}
            <div className="px-4 sm:px-5 py-4 overflow-y-auto flex-1">
              {activeMiniGame === 'snake' && (
                <SnakeGame
                  userId={currentUserId}
                  username={profiles.find(p => p.id === currentUserId)?.character_name || profiles.find(p => p.id === currentUserId)?.username || 'Player'}
                />
              )}
              {activeMiniGame === 'memory' && (
                <MemoryMatch onScore={(s) => lb.saveScore(currentUserId, profiles.find(p => p.id === currentUserId)?.username ?? 'Player', s)} />
              )}
              {activeMiniGame === 'reaction' && (
                <ReactionTest onScore={(s) => lb.saveScore(currentUserId, profiles.find(p => p.id === currentUserId)?.username ?? 'Player', s)} />
              )}
              {activeMiniGame === 'aim' && (
                <AimTrainer onScore={(s) => lb.saveScore(currentUserId, profiles.find(p => p.id === currentUserId)?.username ?? 'Player', s)} />
              )}
              {activeMiniGame === 'sequence' && (
                <SequenceMemory onScore={(s) => lb.saveScore(currentUserId, profiles.find(p => p.id === currentUserId)?.username ?? 'Player', s)} />
              )}
              {activeMiniGame === 'pong' && (
                <PongGame onScore={(s) => lb.saveScore(currentUserId, profiles.find(p => p.id === currentUserId)?.username ?? 'Player', s)} />
              )}

              {/* Leaderboard */}
              <Leaderboard
                entries={lb.entries}
                loading={lb.loading}
                myBest={lb.myBest}
                currentUserId={currentUserId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
