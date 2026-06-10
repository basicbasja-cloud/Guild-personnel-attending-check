import { useState, useRef, useEffect } from 'react';
import { useProfilePage } from '../../hooks/useProfilePage';
import { TitleSelector } from '../titles/TitleSelector';
import type { ProfileSkill } from '../../types';

// ─── class colour badge map ──────────────────────────────────────────────────
const CLASS_BADGE: Record<string, string> = {
  Warrior: 'bg-red-700 text-red-100',
  Mage:    'bg-blue-700 text-blue-100',
  Rogue:   'bg-yellow-600 text-yellow-100',
  Priest:  'bg-purple-700 text-purple-100',
  Ranger:  'bg-green-700 text-green-100',
  Knight:  'bg-orange-700 text-orange-100',
};

// ─── inline inline-edit component ───────────────────────────────────────────
function InlineEdit({
  value, placeholder, className = '', onChange, disabled,
}: {
  value: string; placeholder?: string; className?: string;
  onChange: (v: string) => void; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]   = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (disabled) return <span className={className}>{value || <span className="text-slate-500">{placeholder}</span>}</span>;

  return editing ? (
    <input
      ref={inputRef}
      value={draft}
      placeholder={placeholder}
      className={`bg-slate-700 border border-slate-500 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 ${className}`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onChange(draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); onChange(draft); } if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
    />
  ) : (
    <span
      className={`cursor-pointer hover:underline decoration-dotted underline-offset-2 ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value || <span className="text-slate-400 italic">{placeholder}</span>}
    </span>
  );
}

// ─── Add-skill row ───────────────────────────────────────────────────────────
function AddSkillRow({ onAdd }: { onAdd: (name: string, level: number | null) => void }) {
  const [name, setName]   = useState('');
  const [level, setLevel] = useState('');
  return (
    <div className="flex gap-2 mt-1">
      <input
        value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Skill name"
        className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
      <input
        value={level} onChange={(e) => setLevel(e.target.value)}
        placeholder="Lv" type="number" min="1"
        className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
      <button
        onClick={() => { if (!name.trim()) return; onAdd(name.trim(), level ? parseInt(level, 10) : null); setName(''); setLevel(''); }}
        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold"
      >
        Add
      </button>
    </div>
  );
}

// ─── Skill row ───────────────────────────────────────────────────────────────
function SkillRow({
  skill, canEdit, onUpdate, onRemove,
}: {
  skill: ProfileSkill; canEdit: boolean;
  onUpdate: (id: string, name: string, level: number | null) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-700/50 group">
      <span className="text-slate-400 text-xs w-4">•</span>
      <div className="flex-1 flex items-baseline gap-2">
        <InlineEdit
          value={skill.skill_name} placeholder="Skill name"
          className="text-sm text-slate-100"
          disabled={!canEdit}
          onChange={(v) => onUpdate(skill.id, v, skill.skill_level)}
        />
        <InlineEdit
          value={skill.skill_level != null ? String(skill.skill_level) : ''}
          placeholder="Lv-"
          className="text-xs text-slate-400 w-12"
          disabled={!canEdit}
          onChange={(v) => onUpdate(skill.id, skill.skill_name, v ? parseInt(v, 10) : null)}
        />
      </div>
      {canEdit && (
        <button
          onClick={() => onRemove(skill.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs transition-opacity"
          title="Remove"
        >✕</button>
      )}
    </div>
  );
}

// ─── ProfilePage component ───────────────────────────────────────────────────
export interface ProfilePageProps {
  userId: string;          // profile being viewed
  currentUserId: string;   // logged-in user
  isManagement: boolean;
  /** When true the page is always view-only regardless of ownership */
  readOnly?: boolean;
  onClose: () => void;
}

export function ProfilePage({ userId, currentUserId, isManagement, readOnly = false, onClose }: ProfilePageProps) {
  const { profile, skills, loading, updateNotes, addSkill, updateSkill, removeSkill, updateProfile } = useProfilePage(userId);
  const canEdit = !readOnly && (currentUserId === userId || isManagement);
  const [addingType, setAddingType] = useState<ProfileSkill['skill_type'] | null>(null);
  const [noteDraft, setNoteDraft]   = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const ultimateExtras = skills.filter((s) => s.skill_type === 'ultimate');
  const heroSkills     = skills.filter((s) => s.skill_type === 'hero');

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-5 pt-5 pb-4 rounded-t-2xl flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-14 h-14 rounded-full border-2 border-slate-600 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-2xl shrink-0">👤</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-100 text-lg truncate">{profile?.username ?? '…'}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {canEdit ? (
                <InlineEdit
                  value={profile?.character_name ?? ''}
                  placeholder="Character name"
                  className="text-sm text-slate-300"
                  onChange={(v) => updateProfile({ character_name: v || null })}
                />
              ) : (
                <span className="text-sm text-slate-300">{profile?.character_name ?? <span className="italic text-slate-500">—</span>}</span>
              )}
              {profile?.character_class && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CLASS_BADGE[profile.character_class] ?? 'bg-slate-700 text-slate-200'}`}>
                  {profile.character_class}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none ml-auto pl-2 shrink-0">✕</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : (
          <div className="px-5 py-4 space-y-6">

            {/* ─── Ultimate Skills ─── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">Ultimate Skills</h3>
              {/* Built-in main / sub from profile */}
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-2 py-1 px-2 rounded hover:bg-slate-700/50">
                  <span className="text-xs text-slate-500 w-8 shrink-0">Main</span>
                  {canEdit ? (
                    <>
                      <InlineEdit value={profile?.main_skill_name ?? ''} placeholder="Skill name" className="text-sm text-slate-100 flex-1" onChange={(v) => updateProfile({ main_skill_name: v || null })} />
                      <InlineEdit value={profile?.main_skill_level != null ? String(profile.main_skill_level) : ''} placeholder="Lv-" className="text-xs text-slate-400 w-12" onChange={(v) => updateProfile({ main_skill_level: v ? parseInt(v, 10) : null })} />
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-100 flex-1">{profile?.main_skill_name ?? <span className="text-slate-500">—</span>}</span>
                      <span className="text-xs text-slate-400 w-12">{profile?.main_skill_level != null ? `Lv ${profile.main_skill_level}` : ''}</span>
                    </>
                  )}
                </div>
                <div className="flex items-baseline gap-2 py-1 px-2 rounded hover:bg-slate-700/50">
                  <span className="text-xs text-slate-500 w-8 shrink-0">Sub</span>
                  {canEdit ? (
                    <>
                      <InlineEdit value={profile?.sub_skill_name ?? ''} placeholder="Skill name" className="text-sm text-slate-100 flex-1" onChange={(v) => updateProfile({ sub_skill_name: v || null })} />
                      <InlineEdit value={profile?.sub_skill_level != null ? String(profile.sub_skill_level) : ''} placeholder="Lv-" className="text-xs text-slate-400 w-12" onChange={(v) => updateProfile({ sub_skill_level: v ? parseInt(v, 10) : null })} />
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-100 flex-1">{profile?.sub_skill_name ?? <span className="text-slate-500">—</span>}</span>
                      <span className="text-xs text-slate-400 w-12">{profile?.sub_skill_level != null ? `Lv ${profile.sub_skill_level}` : ''}</span>
                    </>
                  )}
                </div>
                {ultimateExtras.map((s) => (
                  <SkillRow key={s.id} skill={s} canEdit={canEdit} onUpdate={updateSkill} onRemove={removeSkill} />
                ))}
              </div>
              {canEdit && (
                <>
                  {addingType === 'ultimate' ? (
                    <AddSkillRow onAdd={(n, l) => { addSkill('ultimate', n, l); setAddingType(null); }} />
                  ) : (
                    <button
                      onClick={() => setAddingType('ultimate')}
                      className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span className="text-base leading-none">+</span> Add ultimate skill
                    </button>
                  )}
                </>
              )}
            </section>

            {/* ─── Active Title ─── */}
            {userId === currentUserId && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-400 mb-2">👑 Active Title</h3>
                <TitleSelector userId={userId} />
              </section>
            )}

            {/* ─── Hero Skills ─── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">Hero Skills</h3>
              {heroSkills.length === 0 && <p className="text-xs text-slate-500 italic px-2">No hero skills added yet.</p>}
              <div className="space-y-0.5">
                {heroSkills.map((s) => (
                  <SkillRow key={s.id} skill={s} canEdit={canEdit} onUpdate={updateSkill} onRemove={removeSkill} />
                ))}
              </div>
              {canEdit && (
                <>
                  {addingType === 'hero' ? (
                    <AddSkillRow onAdd={(n, l) => { addSkill('hero', n, l); setAddingType(null); }} />
                  ) : (
                    <button
                      onClick={() => setAddingType('hero')}
                      className="mt-1 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <span className="text-base leading-none">+</span> Add hero skill
                    </button>
                  )}
                </>
              )}
            </section>

            {/* ─── Notes ─── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Notes</h3>
              {canEdit ? (
                <textarea
                  value={noteDraft ?? (profile?.notes ?? '')}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={() => {
                    if (noteDraft !== null && noteDraft !== (profile?.notes ?? '')) {
                      updateNotes(noteDraft);
                    }
                  }}
                  rows={4}
                  placeholder="Add notes about this character…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              ) : (
                <p className="text-sm text-slate-300 whitespace-pre-wrap px-2">
                  {profile?.notes ?? <span className="text-slate-500 italic">No notes.</span>}
                </p>
              )}
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
