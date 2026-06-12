import { useState, useMemo, useEffect } from 'react';
import { useTrainingAttendance } from '../../hooks/useTrainingAttendance';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import type { Profile, AttendanceStatus, TrainingAttendance, GuildEvent } from '../../types';

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; emoji: string; bg: string; border: string; text: string }
> = {
  join: {
    label: 'Join',
    emoji: '✅',
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-500',
    text: 'text-emerald-300',
  },
  not_join: {
    label: "Can't Join",
    emoji: '❌',
    bg: 'bg-red-900/40',
    border: 'border-red-500',
    text: 'text-red-300',
  },
  maybe: {
    label: 'Maybe',
    emoji: '🤔',
    bg: 'bg-yellow-900/40',
    border: 'border-yellow-500',
    text: 'text-yellow-300',
  },
};

const STATUS_OPTIONS: { status: AttendanceStatus; emoji: string; label: string; color: string }[] = [
  { status: 'join', emoji: '✅', label: 'Join', color: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-500' },
  { status: 'not_join', emoji: '❌', label: "Can't", color: 'bg-red-800 hover:bg-red-700 border-red-600' },
  { status: 'maybe', emoji: '🤔', label: 'Maybe', color: 'bg-yellow-800 hover:bg-yellow-700 border-yellow-600' },
];

interface OnBehalfSectionProps {
  currentUserId: string;
  eventAttendances: TrainingAttendance[];
  eventId: string;
  onClose: () => void;
}

function OnBehalfSection({ currentUserId, eventAttendances, eventId }: OnBehalfSectionProps) {
  const { profiles } = useAllProfiles();
  const { setStatus } = useTrainingAttendance(eventId, currentUserId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const attendanceByUserId = useMemo(
    () => new Map(eventAttendances.map((a) => [a.user_id, a])),
    [eventAttendances]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter(
      (p) =>
        p.id !== currentUserId &&
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

  if (!selected) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-indigo-800/60 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-indigo-400 text-base">👥</span>
          <h2 className="text-white font-bold text-base">Set On Behalf</h2>
        </div>
        <p className="text-slate-400 text-xs mb-4">Set attendance for another member.</p>
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
        <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 text-lg leading-none shrink-0 transition-colors" title="Back">✕</button>
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

interface TrainingAttendanceModalProps {
  event: GuildEvent;
  currentUserId: string;
  isManagement: boolean;
  onClose: () => void;
  onManageSetup?: () => void;
}

export function TrainingAttendanceModal({
  event,
  currentUserId,
  isManagement,
  onClose,
  onManageSetup,
}: TrainingAttendanceModalProps) {
  const { attendance, eventAttendances, submitting, error, setStatus, loading } = useTrainingAttendance(
    event.id,
    currentUserId
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Summary counts
  const summary = useMemo(() => {
    const counts = { join: 0, not_join: 0, maybe: 0 };
    for (const a of eventAttendances) {
      if (a.status === 'join') counts.join++;
      else if (a.status === 'not_join') counts.not_join++;
      else if (a.status === 'maybe') counts.maybe++;
    }
    return counts;
  }, [eventAttendances]);

  const total = summary.join + summary.not_join + summary.maybe;

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Unscheduled';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-white text-lg flex items-center gap-2">
              🏋️ {event.title}
            </h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">✕</button>
          </div>
          <p className="text-slate-400 text-sm">
            Training · {eventDate}{event.start_time ? ` at ${event.start_time}` : ''}
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}

          {/* Status buttons */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-3">Your Response</h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][]).map(
                ([status, cfg]) => {
                  const selected = attendance?.status === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatus(status)}
                      disabled={submitting}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                        ${selected ? `${cfg.bg} ${cfg.border}` : 'bg-slate-800 border-slate-600 hover:border-slate-500'}
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span className="text-2xl">{cfg.emoji}</span>
                      <span className={`font-semibold text-sm ${selected ? cfg.text : 'text-slate-300'}`}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
            {attendance && (
              <p className="text-center text-xs text-slate-400 mt-2">
                Your status: <span className={`font-semibold ${STATUS_CONFIG[attendance.status].text}`}>
                  {STATUS_CONFIG[attendance.status].emoji} {STATUS_CONFIG[attendance.status].label}
                </span>
              </p>
            )}
          </div>

          {/* Management: Response summary */}
          {isManagement && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
              <h3 className="text-white font-semibold text-sm mb-3">📊 Response Summary</h3>
              {loading ? (
                <p className="text-slate-500 text-xs">Loading responses…</p>
              ) : total === 0 ? (
                <p className="text-slate-500 text-xs">No responses yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50">
                    <p className="text-2xl font-bold text-emerald-400">{summary.join}</p>
                    <p className="text-xs text-emerald-300">✅ Join</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-yellow-900/30 border border-yellow-800/50">
                    <p className="text-2xl font-bold text-yellow-400">{summary.maybe}</p>
                    <p className="text-xs text-yellow-300">🤔 Maybe</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-900/30 border border-red-800/50">
                    <p className="text-2xl font-bold text-red-400">{summary.not_join}</p>
                    <p className="text-xs text-red-300">❌ Can't</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                {onManageSetup && (
                  <button
                    onClick={onManageSetup}
                    className="flex-1 px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
                  >
                    ⚔️ Manage War Setup
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Management: On-behalf section */}
          {isManagement && (
            <OnBehalfSection
              currentUserId={currentUserId}
              eventAttendances={eventAttendances}
              eventId={event.id}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
