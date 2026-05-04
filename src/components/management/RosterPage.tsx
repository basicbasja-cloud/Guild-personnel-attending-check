import { useState } from 'react';
import { format, addWeeks } from 'date-fns';
import { useAttendance } from '../../hooks/useAttendance';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { AttendanceList } from './AttendanceList';

export function RosterPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const targetWeek = weekOffset === 0 ? undefined : addWeeks(new Date(), weekOffset);

  const { weekAttendances, weekStartStr, currentWeekStart } = useAttendance(null, targetWeek, true);
  const { profiles: allProfiles, loading: profilesLoading } = useAllProfiles(true);

  const weekLabel = format(currentWeekStart, "EEEE MMM dd, yyyy");

  return (
    <div className="max-w-2xl mx-auto p-4 pt-6">
      {/* Week selector */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          ◀
        </button>
        <div className="text-center">
          <p className="text-white font-semibold">{weekLabel}</p>
          {weekOffset === 0 && (
            <span className="text-xs text-indigo-400 font-medium">Current Week</span>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          ▶
        </button>
      </div>

      <AttendanceList
        attendances={weekAttendances}
        weekStartStr={weekStartStr}
        allProfiles={allProfiles}
        profilesLoading={profilesLoading}
      />
    </div>
  );
}
