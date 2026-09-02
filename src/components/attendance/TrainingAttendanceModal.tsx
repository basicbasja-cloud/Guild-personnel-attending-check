import { useMemo, useEffect } from 'react';
import { useTrainingAttendance } from '../../hooks/useTrainingAttendance';
import { STATUS_CONFIG } from '../../constants/attendance';
import { OnBehalfSection } from './OnBehalfSection';
import type { AttendanceStatus, GuildEvent } from '../../types';

interface TrainingAttendanceModalProps {
  event: GuildEvent;
  currentUserId: string;
  isManagement: boolean;
  /** Disabled members are view-only inside this modal. */
  isDisabled?: boolean;
  onClose: () => void;
  onManageSetup?: () => void;
  onEditEvent?: () => void;
}

export function TrainingAttendanceModal({
  event,
  currentUserId,
  isManagement,
  isDisabled = false,
  onClose,
  onManageSetup,
  onEditEvent,
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
            <div className="flex items-center gap-2">
              {isManagement && onEditEvent && (
                <button
                  onClick={onEditEvent}
                  className="text-xs px-2.5 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-semibold transition-colors"
                >
                  ✏️ Edit
                </button>
              )}
              <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">✕</button>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Training · {eventDate}{event.start_time ? ` at ${event.start_time}` : ''}
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading attendance responses…</span>
            </div>
          )}

          {/* Status buttons */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-3">Your Response</h3>
            {isDisabled && (
              <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 mb-3 text-amber-200 text-xs">
                🚫 Your account is currently <strong>Disabled</strong> — you can view responses but cannot set one.
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][]).map(
                ([status, cfg]) => {
                  const selected = attendance?.status === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatus(status)}
                      disabled={submitting || isDisabled}
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
              attendanceByUserId={useMemo(() => new Map(eventAttendances.map((a) => [a.user_id, a])), [eventAttendances])}
              setStatus={setStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}
