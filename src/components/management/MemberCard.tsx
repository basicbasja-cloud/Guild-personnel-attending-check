import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Profile } from '../../types';
import { useClassCatalog } from '../../contexts/ClassCatalogContext';

interface MemberCardProps {
  id: string;
  profile: Profile;
  /** Where this card originates from: available pool, party slot, or substitute */
  origin:
    | { type: 'available' }
    | { type: 'party'; partyId: string; position: number }
    | { type: 'substitute'; position: number };
  compact?: boolean;
  isMaybe?: boolean;
  disabled?: boolean;
}

export function MemberCard({ id, profile, origin, compact = false, isMaybe = false, disabled = false }: MemberCardProps) {
  const { getClassColor } = useClassCatalog();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { profile, origin },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const classColor = getClassColor(profile.character_class);

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`flex items-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg p-2 select-none border transition-colors
          ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
          ${isMaybe ? 'border-dashed border-amber-400/80' : 'border-slate-600 hover:border-indigo-500'}`}
      >
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username} className="w-6 h-6 rounded-full shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs shrink-0 font-bold">
            {profile.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-white text-xs font-medium truncate leading-tight">
            {profile.character_name ?? profile.username}
          </p>
          {isMaybe && (
            <span className="inline-flex mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Maybe
            </span>
          )}
          {profile.character_class && (
            <p
              className="text-xs px-1 rounded inline-block leading-tight text-white"
              style={{ backgroundColor: classColor }}
            >
              {profile.character_class}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-3 bg-slate-800 hover:bg-slate-700 rounded-xl p-3 select-none border transition-colors
        ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
        ${isMaybe ? 'border-dashed border-amber-400/80' : 'border-slate-600 hover:border-indigo-500'}`}
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username} className="w-9 h-9 rounded-full shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-white text-sm shrink-0 font-bold">
          {profile.username.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">{profile.character_name ?? profile.username}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-slate-400 text-xs truncate">{profile.username}</span>
          {isMaybe && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Maybe
            </span>
          )}
          {profile.character_class && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium text-white"
              style={{ backgroundColor: classColor }}
            >
              {profile.character_class}
            </span>
          )}
        </div>
      </div>
      <div className="text-slate-500 text-lg select-none">⠿</div>
    </div>
  );
}
