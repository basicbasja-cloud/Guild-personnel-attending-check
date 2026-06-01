import { useState, useEffect, useMemo } from 'react';
import { useKpiEntry } from '../../hooks/useKpiEntry';
import { invalidateKpiBoardCache } from '../../hooks/useKpiBoard';
import { invalidateKpiProfileCache } from '../../hooks/useKpiProfile';
import { KPI_ROLES, KPI_ROLE_METRICS, EMPTY_KPI_VALUES } from '../../constants/kpi';
import type { KpiMetricKey, KpiRoleTag, KpiEntryInput } from '../../types';

interface KpiEntryModalProps {
  targetUserId:   string;
  targetUsername: string;
  weekStart:      string;
  isSuperManager: boolean;
  onClose:        () => void;
  onSaved:        () => void;
  onDeleted?:     () => void;
}

const STAT_FIELDS: { key: KpiMetricKey; label: string; placeholder: string }[] = [
  { key: 'damage_dealt',       label: 'Player Damage',       placeholder: 'e.g. 1200000' },
  { key: 'siege_damage',       label: 'Siege Damage',        placeholder: 'e.g. 450000'  },
  { key: 'damage_taken',       label: 'Damage Receive',      placeholder: 'e.g. 800000'  },
  { key: 'kills',              label: 'Kills',               placeholder: 'e.g. 8'       },
  { key: 'deaths',             label: 'Deaths',              placeholder: 'e.g. 3'       },
  { key: 'assists',            label: 'Assists',             placeholder: 'e.g. 15'      },
  { key: 'healing_done',       label: 'Healing Done',        placeholder: 'e.g. 600000'  },
  { key: 'ally_revives',       label: 'Ally Revives',        placeholder: 'e.g. 2'       },
  { key: 'resources_gathered', label: 'Resources Gathered',  placeholder: 'e.g. 1200'    },
];

export function KpiEntryModal({
  targetUserId,
  targetUsername,
  weekStart,
  isSuperManager,
  onClose,
  onSaved,
  onDeleted,
}: KpiEntryModalProps) {
  const { entry, loading, saving, deleting, error, fetch, save, deleteEntry } = useKpiEntry();
  const [roleTag, setRoleTag]             = useState<KpiRoleTag>('ROLE_DPS_DMG');
  const [values, setValues]               = useState<Record<KpiMetricKey, number>>({ ...EMPTY_KPI_VALUES });
  const [toast, setToast]                 = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Split form fields into primary (scored for this role) and secondary
  const { primaryFields, secondaryFields } = useMemo(() => {
    const primary = KPI_ROLE_METRICS[roleTag] ?? [];
    return {
      primaryFields:   STAT_FIELDS.filter(f =>  primary.includes(f.key)),
      secondaryFields: STAT_FIELDS.filter(f => !primary.includes(f.key)),
    };
  }, [roleTag]);

  useEffect(() => {
    fetch(targetUserId, weekStart);
  }, [targetUserId, weekStart, fetch]);

  useEffect(() => {
    if (!entry) return;
    setRoleTag(entry.role_tag);
    setValues({
      damage_dealt:       entry.damage_dealt,
      siege_damage:       entry.siege_damage,
      damage_taken:       entry.damage_taken,
      kills:              entry.kills,
      deaths:             entry.deaths,
      assists:            entry.assists,
      healing_done:       entry.healing_done,
      ally_revives:       entry.ally_revives,
      resources_gathered: entry.resources_gathered,
    });
  }, [entry]);

  const handleChange = (key: KpiMetricKey, raw: string) => {
    const n = raw === '' ? 0 : parseFloat(raw);
    setValues((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : n }));
  };

  const handleSave = async () => {
    const input: KpiEntryInput = { role_tag: roleTag, ...values };
    const ok = await save(targetUserId, weekStart, input);
    if (ok) {
      // Invalidate caches so the board and profile refresh immediately
      invalidateKpiBoardCache(weekStart);
      invalidateKpiProfileCache(targetUserId);
      setToast('Stats saved ✓');
      setTimeout(() => { onSaved(); onClose(); }, 800);
    }
  };

  const handleDelete = async () => {
    const ok = await deleteEntry(targetUserId, weekStart);
    if (ok) {
      invalidateKpiBoardCache(weekStart);
      invalidateKpiProfileCache(targetUserId);
      (onDeleted ?? onSaved)();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-white font-semibold">Enter War Stats</h2>
            <p className="text-slate-400 text-sm mt-0.5">{targetUsername} · {weekStart}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-slate-400 text-sm text-center py-8">Loading existing entry…</p>
          ) : (
            <>
              {/* Role selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                <select
                  value={roleTag}
                  onChange={(e) => setRoleTag(e.target.value as KpiRoleTag)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {KPI_ROLES.map((r) => (
                    <option key={r.tag} value={r.tag}>{r.label}</option>
                  ))}
                </select>
                {/* Show scoring formula — super managers only */}
                {isSuperManager && (() => {
                  const role = KPI_ROLES.find(r => r.tag === roleTag);
                  return role ? (
                    <div className="mt-2 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2">
                      <p className="text-slate-400 text-xs">{role.description}</p>
                      <p className="text-slate-600 text-[10px] mt-0.5 font-mono">Score = {role.scoringFormula}</p>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Primary metrics — scored for this role */}
              <div>
                <p className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1">
                  <span>⭐</span> Scored Metrics
                  <span className="text-slate-500 font-normal">— affect your leaderboard rank</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {primaryFields.map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-200 mb-1">{label}</label>
                      <input
                        type="number"
                        min={0}
                        value={values[key] || ''}
                        placeholder={placeholder}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="w-full bg-slate-800 border border-emerald-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Secondary metrics — stored but not scored for this role */}
              {secondaryFields.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Other Stats (stored, not scored for this role)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {secondaryFields.map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                        <input
                          type="number"
                          min={0}
                          value={values[key] || ''}
                          placeholder={placeholder}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {toast && (
                <p className="text-green-400 text-sm bg-green-950/40 border border-green-800/50 rounded-lg px-3 py-2">
                  {toast}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-700 shrink-0">
          {/* Delete — only when an existing entry is loaded */}
          <div className="flex items-center gap-2 min-h-[36px]">
            {entry && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors"
              >
                🗑 Delete
              </button>
            )}
            {entry && confirmDelete && (
              <>
                <span className="text-xs text-slate-400">Delete this week&apos;s entry?</span>
                <button
                  onClick={() => { void handleDelete(); }}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving || loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Stats'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
