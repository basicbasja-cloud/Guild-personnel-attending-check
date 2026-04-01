import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Profile } from '../../types';

interface MemberCardProps {
  id: string;
  profile: Profile;
  /** Where this card originates from: available pool, party slot, or substitute */
  origin:
    | { type: 'available' }
    | { type: 'party'; partyId: string; position: number }
    | { type: 'substitute'; position: number };
  compact?: boolean;
}

const CLASS_COLORS: Record<string, string> = {
  warrior: 'bg-red-800/60 text-red-200',
  mage: 'bg-blue-800/60 text-blue-200',
  wizard: 'bg-blue-800/60 text-blue-200',
  archer: 'bg-green-800/60 text-green-200',
  healer: 'bg-yellow-800/60 text-yellow-200',
  priest: 'bg-yellow-800/60 text-yellow-200',
  rogue: 'bg-purple-800/60 text-purple-200',
  assassin: 'bg-purple-800/60 text-purple-200',
  tank: 'bg-orange-800/60 text-orange-200',
  default: 'bg-slate-700/60 text-slate-300',
};

function getClassColor(charClass: string | null) {
  if (!charClass) return CLASS_COLORS.default;
  const key = charClass.toLowerCase();
  return CLASS_COLORS[key] ?? CLASS_COLORS.default;
}

export function MemberCard({ id, profile, origin, compact = false }: MemberCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { profile, origin },
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
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg p-2 cursor-grab active:cursor-grabbing select-none border border-slate-600 hover:border-indigo-500 transition-colors"
      >
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.username} className="w-6 h-6 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs flex-shrink-0 font-bold">
            {profile.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-white text-xs font-medium truncate leading-tight">
            {profile.character_name ?? profile.username}
          </p>
          {profile.character_class && (
            <p className={`text-xs px-1 rounded inline-block leading-tight ${classColor}`}>
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
      className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 rounded-xl p-3 cursor-grab active:cursor-grabbing select-none border border-slate-600 hover:border-indigo-500 transition-colors"
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username} className="w-9 h-9 rounded-full flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-white text-sm flex-shrink-0 font-bold">
          {profile.username.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">{profile.character_name ?? profile.username}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-slate-400 text-xs truncate">{profile.username}</span>
          {profile.character_class && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${classColor}`}>
              {profile.character_class}
            </span>
          )}
        </div>
      </div>
      <div className="text-slate-500 text-lg select-none">⠿</div>
    </div>
  );
}
