import { useState, useMemo } from 'react';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { STATUS_OPTIONS } from '../../constants/attendance';
import type { Profile, AttendanceStatus } from '../../types';

interface OnBehalfSectionProps {
  currentUserId: string;
  /** Map from user_id → { status, set_by_profile? } */
  attendanceByUserId: ReadonlyMap<
    string,
    { status: AttendanceStatus; set_by_profile?: { id: string; username: string } | null } | undefined
  >;
  setStatus: (status: AttendanceStatus, onBehalfOfUserId?: string) => Promise<void>;
  /** Optional suffix for the prompt text (e.g. "for week of Mar 15") */
  promptSuffix?: string;
}

export function OnBehalfSection({
  currentUserId,
  attendanceByUserId,
  setStatus,
  promptSuffix,
}: OnBehalfSectionProps) {
  const { profiles } = useAllProfiles();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter(
      (p) =>
        p.id !== currentUserId &&
        p.is_disabled !== true && // disabled members cannot have status set on their behalf
        (!q ||
          p.username.toLowerCase().includes(q) ||
          (p.character_name ?? '').toLowerCase().includes(q))
    );
  }, [profiles, search, currentUserId]);

  const handleSet = async (targetProfile: Profile, status: AttendanceStatus) => {
    setSubmitting(status);
    await setStatus(status, targetProfile.id);
    setSubmitting(null);
  };

  const promptText = `Set attendance for another member${promptSuffix ? ` ${promptSuffix}` : '.'}`;

  if (!selected) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-indigo-800/60 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-indigo-400 text-base">👥</span>
          <h2 className="text-white font-bold text-base">Set On Behalf</h2>
        </div>
        <p className="text-slate-400 text-xs mb-4">{promptText}</p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or character…"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-2"
        />
        <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
          {filtered.length === 0 && (
            <p className="text-slate-500 text-xs text-center py-4">No members found.</p>
          )}
          {filtered.map((p) => {
            const att = attendanceByUserId.get(p.id);
            const statusEmoji = att
              ? att.status === 'join' ? '✅' : att.status === 'not_join' ? '❌' : '🤔'
              : '❓';
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.username} className="w-7 h-7 rounded-full shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.character_name ?? p.username}</p>
                  <p className="text-slate-400 text-xs truncate">
                    {p.username}{p.character_class ? ` · ${p.character_class}` : ''}
                  </p>
                </div>
                <span className="text-base shrink-0">{statusEmoji}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-indigo-800/60 p-5">
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-800 border border-slate-700">
        {selected.avatar_url ? (
          <img src={selected.avatar_url} alt={selected.username} className="w-9 h-9 rounded-full shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {selected.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{selected.character_name ?? selected.username}</p>
          <p className="text-slate-400 text-xs truncate">
            {selected.username}{selected.character_class ? ` · ${selected.character_class}` : ''}
          </p>
          {(() => {
            const att = attendanceByUserId.get(selected.id);
            if (!att) return <p className="text-slate-500 text-xs">No status yet</p>;
            const emoji = att.status === 'join' ? '✅' : att.status === 'not_join' ? '❌' : '🤔';
            const label = att.status === 'join' ? 'Join' : att.status === 'not_join' ? "Can't Join" : 'Maybe';
            return (
              <p className="text-slate-400 text-xs">
                Current: {emoji} {label}
                {att.set_by_profile && att.set_by_profile.id !== selected.id
                  ? ` (set by ${att.set_by_profile.username})`
                  : ''}
              </p>
            );
          })()}
        </div>
        <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 text-lg leading-none shrink-0 transition-colors" title="Back to list">✕</button>
      </div>
      <p className="text-slate-400 text-xs mb-2">Set status for this member:</p>
      <div className="grid grid-cols-3 gap-2">
        {STATUS_OPTIONS.map(({ status, emoji, label, color }) => (
          <button
            key={status}
            onClick={() => handleSet(selected, status)}
            disabled={submitting !== null}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${color}`}
          >
            <span className="text-xl">{submitting === status ? '⏳' : emoji}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
