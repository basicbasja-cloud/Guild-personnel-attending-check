import { useState } from 'react';
import { format, addWeeks } from 'date-fns';
import { useAttendance } from '../../hooks/useAttendance';
import type { Profile, AttendanceStatus } from '../../types';
import { useClassCatalog } from '../../contexts/ClassCatalogContext';

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

interface AttendancePageProps {
  profile: Profile;
  onUpdateProfile: (updates: Partial<Pick<Profile, 'character_name' | 'character_class'>>) => Promise<unknown>;
}

export function AttendancePage({ profile, onUpdateProfile }: AttendancePageProps) {
  const { classCatalog, getClassColor } = useClassCatalog();
  const [weekOffset, setWeekOffset] = useState(0);
  const targetWeek = weekOffset === 0 ? undefined : addWeeks(new Date(), weekOffset);
  const { attendance, loading, error, setStatus, currentWeekStart } = useAttendance(
    profile.id,
    targetWeek
  );

  const [editingProfile, setEditingProfile] = useState(false);
  const [charName, setCharName] = useState(profile.character_name ?? '');
  const [charClass, setCharClass] = useState(profile.character_class ?? '');
  const [saving, setSaving] = useState(false);

  const selectedClassColor = getClassColor(charClass || null);
  const displayClassOptions = classCatalog.some((item) => item.name === charClass)
    ? classCatalog
    : charClass
      ? [...classCatalog, { name: charClass, color_hex: selectedClassColor }]
      : classCatalog;

  const handleStatusSelect = async (status: AttendanceStatus) => {
    await setStatus(status);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    await onUpdateProfile({ character_name: charName || null, character_class: charClass || null });
    setSaving(false);
    setEditingProfile(false);
  };

  const weekLabel = format(currentWeekStart, "EEEE MMM dd, yyyy");

  return (
    <div className="max-w-lg mx-auto p-4 pt-6">
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

      {/* Attendance card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 mb-6">
        <h2 className="text-white font-bold text-xl mb-1">Guild War Attendance</h2>
        <p className="text-slate-400 text-sm mb-6">Will you participate in this week's guild war?</p>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][]).map(
            ([status, cfg]) => {
              const selected = attendance?.status === status;
              return (
                <button
                  key={status}
                  onClick={() => handleStatusSelect(status)}
                  disabled={loading}
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
          <div className="mt-4 text-center">
            <span className="text-slate-400 text-sm">
              Your status:{' '}
              <span className={`font-semibold ${STATUS_CONFIG[attendance.status].text}`}>
                {STATUS_CONFIG[attendance.status].emoji} {STATUS_CONFIG[attendance.status].label}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Character Info</h2>
          {!editingProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {editingProfile ? (
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Character Name</label>
              <input
                type="text"
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                placeholder="e.g. DragonSlayer"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">
                Class / School (Job)
              </label>
              <select
                value={charClass}
                onChange={(e) => setCharClass(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select class</option>
                {displayClassOptions.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
              {charClass && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: selectedClassColor }}>
                  <span className="w-2 h-2 rounded-full bg-white/70" />
                  {charClass}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingProfile(false);
                  setCharName(profile.character_name ?? '');
                  setCharClass(profile.character_class ?? '');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Discord</span>
              <span className="text-white text-sm font-medium">{profile.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Character</span>
              <span className="text-white text-sm font-medium">
                {profile.character_name ?? <span className="text-slate-500 italic">Not set</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Class</span>
              <span className="text-white text-sm font-medium">
                {profile.character_class ?? <span className="text-slate-500 italic">Not set</span>}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
