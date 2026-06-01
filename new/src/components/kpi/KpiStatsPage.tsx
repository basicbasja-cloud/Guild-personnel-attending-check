import { useState, useMemo } from 'react';
import { formatISO } from 'date-fns';
import { getUpcomingSaturday } from '../../lib/week';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { KpiAwardsBoard } from './KpiAwardsBoard';
import { KpiPersonalCard } from './KpiPersonalCard';
import { KpiEntryModal } from './KpiEntryModal';

interface KpiStatsPageProps {
  currentUserId:  string;
  isSuperManager: boolean;
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

export function KpiStatsPage({ currentUserId, isSuperManager }: KpiStatsPageProps) {
  const [weekStart, setWeekStart] = useState<string>(defaultWeek);
  const [search, setSearch]       = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entryTarget, setEntryTarget] = useState<{ id: string; username: string } | null>(null);
  const [refreshKey, setRefreshKey]   = useState(0);

  const { profiles } = useAllProfiles();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        (p.character_name ?? '').toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const handleSaved = () => {
    setEntryTarget(null);
    setPickerOpen(false);
    setRefreshKey((k) => k + 1);
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
            Post-war performance boards & personal metrics
          </p>
        </div>

        {/* Officer controls */}
        {isSuperManager && (
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Enter Stats
          </button>
        )}
      </div>

      {/* ── Awards Board ── */}
      <KpiAwardsBoard
        key={refreshKey}
        isSuperManager={isSuperManager}
      />

      {/* ── Personal Card ── */}
      <div>
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          📊 Your Metrics
          <span className="text-slate-500 font-normal">· {formatWeekLabel(weekStart)}</span>
        </h2>

        {/* Personal week nav */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs"
          >◀</button>
          <span className="text-slate-400 text-xs">{formatWeekLabel(weekStart)}</span>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs"
          >▶</button>
        </div>

        <KpiPersonalCard
          userId={currentUserId}
          weekStart={weekStart}
        />
      </div>

      {/* ── Member picker (officer modal) ── */}
      {pickerOpen && !entryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
              <h3 className="text-white font-semibold text-sm">Select Member</h3>
              <button
                onClick={() => { setPickerOpen(false); setSearch(''); }}
                className="text-slate-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700"
              >✕</button>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-slate-700/60 shrink-0">
              <input
                type="text"
                placeholder="Search name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
              />
            </div>

            {/* List */}
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

      {/* ── Entry modal ── */}
      {entryTarget && (
        <KpiEntryModal
          targetUserId={entryTarget.id}
          targetUsername={entryTarget.username}
          weekStart={weekStart}
          onClose={() => setEntryTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
