import { useDroppable } from '@dnd-kit/core';
import { PartyCard } from './PartyCard';
import { MemberCard } from './MemberCard';
import type { GroupWithParties } from '../../hooks/useWarSetup';
import type { Profile } from '../../types';
import { MAX_MEMBERS_PER_GROUP } from '../../types';

interface GroupBoardProps {
  groupData: GroupWithParties;
  onRemoveMember: (userId: string) => void;
  maybeUserIds: Set<string>;
  canEdit: boolean;
  partyNumberOffset?: number;
}

export function GroupBoard({ groupData, onRemoveMember, maybeUserIds, canEdit, partyNumberOffset = 0 }: GroupBoardProps) {
  const { group, parties } = groupData;
  const totalMembers = parties.reduce((sum, p) => sum + p.members.length, 0);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-700 flex items-center justify-center text-white text-xs font-bold">
            {group.group_number}
          </div>
          <h3 className="text-white font-bold">{group.name}</h3>
        </div>
        <div
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            totalMembers >= MAX_MEMBERS_PER_GROUP
              ? 'bg-red-900/60 text-red-300'
              : 'bg-slate-700 text-slate-400'
          }`}
        >
          {totalMembers}/{MAX_MEMBERS_PER_GROUP}
        </div>

      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {parties.map((partyData) => (
          <PartyCard
            key={partyData.party.id}
            groupId={group.id}
            partyData={partyData}
            onRemoveMember={onRemoveMember}
            maybeUserIds={maybeUserIds}
            canEdit={canEdit}
            partyNumberOffset={partyNumberOffset}
          />
        ))}
      </div>
    </div>
  );
}

interface SubstituteBoardProps {
  substitutes: { userId: string; profile: Profile; position: number }[];
  maxSubstitutes: number;
  onRemoveMember: (userId: string) => void;
  maybeUserIds: Set<string>;
  canEdit: boolean;
}

export function SubstituteBoard({ substitutes, maxSubstitutes, onRemoveMember, maybeUserIds, canEdit }: SubstituteBoardProps) {
  const slots = Array.from({ length: maxSubstitutes }, (_, i) => {
    const sub = substitutes.find((s) => s.position === i + 1) ?? null;
    return { position: i + 1, sub };
  });

  return (
    <div className="bg-slate-900 rounded-2xl border border-amber-800/50 overflow-hidden">
      <div className="px-4 py-3 bg-slate-800 border-b border-amber-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">🔄</span>
          <h3 className="text-white font-bold">Substitutes</h3>
        </div>
        <div className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 font-medium">
          {substitutes.length}/{maxSubstitutes}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {slots.map(({ position, sub }) => (
          <SubstituteSlot
            key={position}
            position={position}
            member={sub}
            isMaybe={sub ? maybeUserIds.has(sub.userId) : false}
            onRemove={() => sub && onRemoveMember(sub.userId)}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

interface SubstituteSlotProps {
  position: number;
  member: { userId: string; profile: Profile } | null;
  isMaybe: boolean;
  onRemove: () => void;
  canEdit: boolean;
}

function SubstituteSlot({ position, member, isMaybe, onRemove, canEdit }: SubstituteSlotProps) {
  const dropId = `substitute::${position}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: 'substitute', position },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-lg min-h-10 transition-all
        ${member ? '' : 'border border-dashed border-amber-800/60 bg-amber-950/20'}
        ${isOver ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-slate-900' : ''}
      `}
    >
      {member ? (
        <div className="relative group">
          <MemberCard
            id={`assigned::substitute::${position}::${member.userId}`}
            profile={member.profile}
            origin={{ type: 'substitute', position }}
            compact
            isMaybe={isMaybe}
            disabled={!canEdit}
          />
          {canEdit && (
            <button
              onClick={onRemove}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-600 hover:bg-red-600 text-slate-300 hover:text-white text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all flex items-center justify-center"
              title="Remove"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-10 text-amber-900 text-xs select-none">
          Sub {position}
        </div>
      )}
    </div>
  );
}
