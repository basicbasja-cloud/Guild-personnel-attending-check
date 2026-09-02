import { useState, useMemo } from 'react';
import { format, addWeeks } from 'date-fns';
import { useAttendance } from '../../hooks/useAttendance';
import { STATUS_CONFIG } from '../../constants/attendance';
import { OnBehalfSection } from './OnBehalfSection';
import type { AttendanceStatus, Profile } from '../../types';
import { useClassCatalog } from '../../contexts/ClassCatalogContext';

interface AttendancePageProps {
  profile: Profile;
  onUpdateProfile: (updates: Partial<Pick<Profile, 'character_name' | 'character_class' | 'main_skill_name' | 'main_skill_level' | 'sub_skill_name' | 'sub_skill_level'>>) => Promise<unknown>;
}

export function AttendancePage({ profile, onUpdateProfile }: AttendancePageProps) {
  const { classCatalog, getClassColor } = useClassCatalog();
  const [weekOffset, setWeekOffset] = useState(0);
  const targetWeek = weekOffset === 0 ? undefined : addWeeks(new Date(), weekOffset);
  const { attendance, weekAttendances, weekStartStr, submitting, error, setStatus, currentWeekStart } = useAttendance(
    profile.id,
    targetWeek
  );

  const [editingProfile, setEditingProfile] = useState(false);
  const [charName, setCharName] = useState(profile.character_name ?? '');
  const [charClass, setCharClass] = useState(profile.character_class ?? '');
  const [mainSkillName, setMainSkillName] = useState(profile.main_skill_name ?? '');
  const [mainSkillLevel, setMainSkillLevel] = useState(profile.main_skill_level?.toString() ?? '');
  const [subSkillName, setSubSkillName] = useState(profile.sub_skill_name ?? '');
  const [subSkillLevel, setSubSkillLevel] = useState(profile.sub_skill_level?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const selectedClassColor = getClassColor(charClass || null);
  const displayClassOptions = classCatalog.some((item) => item.name === charClass)
    ? classCatalog
    : charClass
      ? [...classCatalog, { name: charClass, color_hex: selectedClassColor }]
      : classCatalog;

  // Disabled members are view-only: they cannot change war/attendance status.
  const isDisabledMember = profile.is_disabled === true;

  const handleStatusSelect = async (status: AttendanceStatus) => {
    if (isDisabledMember) return;
    await setStatus(status);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    await onUpdateProfile({
      character_name: charName || null,
      character_class: charClass || null,
      main_skill_name: mainSkillName || null,
      main_skill_level: mainSkillLevel ? parseInt(mainSkillLevel, 10) || null : null,
      sub_skill_name: subSkillName || null,
      sub_skill_level: subSkillLevel ? parseInt(subSkillLevel, 10) || null : null,
    });
    setSaving(false);
    setEditingProfile(false);
  };

  const weekLabel = format(currentWeekStart, "EEEE MMM dd, yyyy");

  return (
    <div className="max-w-lg mx-auto p-4 pt-6">
      {/* Week selector */}
      <div className="flex items-center justify-between mb-6 gap-2">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors touch-manipulation"
        >
          ◀
        </button>
        <div className="text-center min-w-0 flex-1">
          <p className="text-white font-semibold text-sm sm:text-base">{weekLabel}</p>
          {weekOffset === 0 && (
            <span className="text-xs text-indigo-400 font-medium">Current Week</span>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors touch-manipulation"
        >
          ▶
        </button>
      </div>

      {/* Attendance card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 sm:p-6 mb-6">
        <h2 className="text-white font-bold text-lg sm:text-xl mb-1">Guild War Attendance</h2>
        <p className="text-slate-400 text-sm mb-6">Will you participate in this week's guild war?</p>

        {isDisabledMember && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 mb-4 text-amber-200 text-sm">
            🚫 Your account is currently <strong>Disabled</strong>. You can view the guild board but cannot set your war status.
            Contact a manager if this is a mistake.
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][]).map(
            ([status, cfg]) => {
              const selected = attendance?.status === status;
              return (
                <button
                  key={status}
                  onClick={() => handleStatusSelect(status)}
                  disabled={submitting || isDisabledMember}
                  className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all min-h-[80px] sm:min-h-[96px] touch-manipulation
                    ${selected ? `${cfg.bg} ${cfg.border}` : 'bg-slate-800 border-slate-600 hover:border-slate-500'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="text-xl sm:text-2xl">{cfg.emoji}</span>
                  <span className={`font-semibold text-xs sm:text-sm leading-tight text-center ${selected ? cfg.text : 'text-slate-300'}`}>
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
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 sm:p-6">
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
            {/* Skill fields */}
            <div className="border-t border-slate-700 pt-3 mt-1">
              <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wide">Ultimate Skills</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 text-xs font-medium block mb-1">Main Skill</label>
                  <input
                    type="text"
                    value={mainSkillName}
                    onChange={(e) => setMainSkillName(e.target.value)}
                    placeholder="Skill name"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium block mb-1">Level</label>
                  <input
                    type="number"
                    value={mainSkillLevel}
                    onChange={(e) => setMainSkillLevel(e.target.value)}
                    placeholder="e.g. 5"
                    min={1}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium block mb-1">Sub Skill</label>
                  <input
                    type="text"
                    value={subSkillName}
                    onChange={(e) => setSubSkillName(e.target.value)}
                    placeholder="Skill name"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-medium block mb-1">Level</label>
                  <input
                    type="number"
                    value={subSkillLevel}
                    onChange={(e) => setSubSkillLevel(e.target.value)}
                    placeholder="e.g. 3"
                    min={1}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
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
                  setMainSkillName(profile.main_skill_name ?? '');
                  setMainSkillLevel(profile.main_skill_level?.toString() ?? '');
                  setSubSkillName(profile.sub_skill_name ?? '');
                  setSubSkillLevel(profile.sub_skill_level?.toString() ?? '');
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
            {(profile.main_skill_name || profile.sub_skill_name) && (
              <div className="border-t border-slate-700 pt-2 mt-1 space-y-1">
                {profile.main_skill_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Main Skill</span>
                    <span className="text-white text-sm font-medium">
                      {profile.main_skill_name}{profile.main_skill_level != null ? ` Lv.${profile.main_skill_level}` : ''}
                    </span>
                  </div>
                )}
                {profile.sub_skill_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Sub Skill</span>
                    <span className="text-white text-sm font-medium">
                      {profile.sub_skill_name}{profile.sub_skill_level != null ? ` Lv.${profile.sub_skill_level}` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* On-behalf section — visible to all, DB enforces manager-only writes */}
      <OnBehalfSection
        currentUserId={profile.id}
        attendanceByUserId={useMemo(() => new Map(weekAttendances.map((a) => [a.user_id, a])), [weekAttendances])}
        setStatus={setStatus}
        promptSuffix={`for week of ${format(new Date(weekStartStr + 'T00:00:00'), 'MMM dd')}.`}
      />
    </div>
  );
}
