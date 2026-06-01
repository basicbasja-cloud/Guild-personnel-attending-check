import { useState, useEffect } from 'react';
import { formatISO } from 'date-fns';
import { getUpcomingSaturday } from '../../lib/week';
import { useKpiEntry } from '../../hooks/useKpiEntry';
import { KPI_ROLES, EMPTY_KPI_VALUES } from '../../constants/kpi';
import type { KpiMetricKey, KpiRoleTag, KpiEntryInput } from '../../types';

interface KpiEntryModalProps {
  targetUserId:   string;
  targetUsername: string;
  weekStart:      string;
  onClose:        () => void;
  onSaved:        () => void;
}

const STAT_FIELDS: { key: KpiMetricKey; label: string; placeholder: string }[] = [
  { key: 'damage_dealt',       label: 'Player Damage',       placeholder: 'e.g. 1200000' },
  { key: 'siege_damage',       label: 'Siege Damage',        placeholder: 'e.g. 450000' },
  { key: 'damage_taken',       label: 'Damage Receive',      placeholder: 'e.g. 800000' },
  { key: 'kills',              label: 'Kills',               placeholder: 'e.g. 8' },
  { key: 'deaths',             label: 'Deaths',              placeholder: 'e.g. 3' },
  { key: 'assists',            label: 'Assists',             placeholder: 'e.g. 15' },
  { key: 'healing_done',       label: 'Healing Done',        placeholder: 'e.g. 600000' },
  { key: 'ally_revives',       label: 'Ally Revives',        placeholder: 'e.g. 2' },
  { key: 'resources_gathered', label: 'Resources Gathered',  placeholder: 'e.g. 1200' },
];

export function KpiEntryModal({
  targetUserId,
  targetUsername,
  weekStart,
  onClose,
  onSaved,
}: KpiEntryModalProps) {
  const { entry, loading, saving, error, fetch, save } = useKpiEntry();
  const [roleTag, setRoleTag] = useState<KpiRoleTag>('ROLE_DPS_DMG');
  const [values, setValues]   = useState<Record<KpiMetricKey, number>>({ ...EMPTY_KPI_VALUES });
  const [toast, setToast]     = useState<string | null>(null);

  // Load existing entry on mount
  useEffect(() => {
    fetch(targetUserId, weekStart);
  }, [targetUserId, weekStart, fetch]);

  // Populate form when existing entry is loaded
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
      setToast('Stats saved ✓');
      setTimeout(() => { onSaved(); onClose(); }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
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

        {/* Body */}
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
              </div>

              {/* Stat inputs */}
              <div className="grid grid-cols-2 gap-3">
                {STAT_FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                    <input
                      type="number"
                      min={0}
                      value={values[key] || ''}
                      placeholder={placeholder}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
                    />
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Toast */}
              {toast && (
                <p className="text-green-400 text-sm bg-green-950/40 border border-green-800/50 rounded-lg px-3 py-2">
                  {toast}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Stats'}
          </button>
        </div>
      </div>
    </div>
  );
}
