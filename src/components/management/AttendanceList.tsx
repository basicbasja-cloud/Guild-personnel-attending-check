import { format } from 'date-fns';
import type { Attendance } from '../../types';

const STATUS_CONFIG = {
  join: { label: 'Join', emoji: '✅', bg: 'bg-emerald-900/30', text: 'text-emerald-300', border: 'border-emerald-700' },
  not_join: { label: "Can't Join", emoji: '❌', bg: 'bg-red-900/30', text: 'text-red-300', border: 'border-red-800' },
  maybe: { label: 'Maybe', emoji: '🤔', bg: 'bg-yellow-900/30', text: 'text-yellow-300', border: 'border-yellow-800' },
};

interface AttendanceListProps {
  attendances: Attendance[];
  weekStartStr: string;
}

export function AttendanceList({ attendances, weekStartStr }: AttendanceListProps) {
  const byStatus = {
    join: attendances.filter((a) => a.status === 'join'),
    maybe: attendances.filter((a) => a.status === 'maybe'),
    not_join: attendances.filter((a) => a.status === 'not_join'),
  };

  const weekLabel = format(new Date(weekStartStr + 'T00:00:00'), "EEEE MMM dd, yyyy");

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-bold">Attendance — {weekLabel}</h3>
        <span className="text-slate-400 text-sm">{attendances.length} responses</span>
      </div>

      <div className="divide-y divide-slate-800">
        {(['join', 'maybe', 'not_join'] as const).map((status) => {
          const cfg = STATUS_CONFIG[status];
          const members = byStatus[status];
          if (members.length === 0) return null;
          return (
            <div key={status} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span>{cfg.emoji}</span>
                <span className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</span>
                <span className="text-slate-500 text-xs">({members.length})</span>
              </div>
              <div className="space-y-2">
                {members.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-2 rounded-lg border ${cfg.bg} ${cfg.border}`}
                  >
                    {a.profile?.avatar_url ? (
                      <img src={a.profile.avatar_url} alt="" className="w-7 h-7 rounded-full shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs shrink-0 font-bold">
                        {(a.profile?.username ?? '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {a.profile?.character_name ?? a.profile?.username ?? 'Unknown'}
                      </p>
                      <p className="text-slate-400 text-xs truncate">
                        {a.profile?.username}
                        {a.profile?.character_class ? ` · ${a.profile.character_class}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {attendances.length === 0 && (
          <div className="p-8 text-center text-slate-500">No responses yet for this week.</div>
        )}
      </div>
    </div>
  );
}
