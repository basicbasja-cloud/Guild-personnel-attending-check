import { useDroppable } from '@dnd-kit/core';
import { MemberCard } from './MemberCard';
import type { PartyWithMembers } from '../../hooks/useWarSetup';
import { MAX_MEMBERS_PER_PARTY } from '../../types';

interface PartyCardProps {
  groupId: string;
  partyData: PartyWithMembers;
  onRemoveMember: (userId: string) => void;
  maybeUserIds: Set<string>;
  canEdit: boolean;
  partyNumberOffset?: number;
  isSwapSource?: boolean;
  isSwapTarget?: boolean;
  onSwapClick?: () => void;
}

export function PartyCard({ groupId, partyData, onRemoveMember, maybeUserIds, canEdit, partyNumberOffset = 0, isSwapSource = false, isSwapTarget = false, onSwapClick }: PartyCardProps) {
  const { party, members } = partyData;

  const slots = Array.from({ length: MAX_MEMBERS_PER_PARTY }, (_, i) => {
    const member = members.find((m) => m.position === i + 1) ?? null;
    return { position: i + 1, member };
  });

  return (
    <div className={`rounded-xl border overflow-hidden transition-all
      ${isSwapSource ? 'border-amber-500 ring-1 ring-amber-500/60' : isSwapTarget ? 'border-indigo-500 ring-1 ring-indigo-500/60' : 'bg-slate-800/50 border-slate-700'}`}>
      {/* Party header */}
      <div className={`px-3 py-2 border-b flex items-center justify-between transition-colors
        ${isSwapSource ? 'bg-amber-900/40 border-amber-700' : isSwapTarget ? 'bg-indigo-900/40 border-indigo-700' : 'bg-slate-800 border-slate-700'}`}>
        <span className="text-slate-300 text-sm font-semibold">Party {party.party_number + partyNumberOffset}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-xs">
            {members.length}/{MAX_MEMBERS_PER_PARTY}
          </span>
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwapClick?.(); }}
              title={isSwapSource ? 'Cancel swap' : isSwapTarget ? 'Swap with this party' : 'Swap party members'}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all
                ${isSwapSource
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : isSwapTarget
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white'
                }`}
            >
              ⇄
            </button>
          )}
        </div>
      </div>

      {/* Member slots */}
      <div className="p-2 space-y-1.5">
        {slots.map(({ position, member }) => (
          <PartySlot
            key={position}
            partyId={party.id}
            groupId={groupId}
            position={position}
            member={member && member.profile ? { userId: member.user_id, profile: member.profile } : null}
            isMaybe={member ? maybeUserIds.has(member.user_id) : false}
            onRemove={() => member && onRemoveMember(member.user_id)}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

interface PartySlotProps {
  partyId: string;
  groupId: string;
  position: number;
  member: { userId: string; profile: import('../../types').Profile } | null;
  isMaybe: boolean;
  onRemove: () => void;
  canEdit: boolean;
}

function PartySlot({ partyId, groupId, position, member, isMaybe, onRemove, canEdit }: PartySlotProps) {
  const dropId = `party::${partyId}::${position}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: 'party', partyId, groupId, position },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-lg min-h-10 transition-all duration-200
        ${member ? '' : 'border border-dashed border-slate-600 bg-slate-900/40'}
        ${isOver ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900 drag-glow scale-[1.02]' : ''}
        ${isOver && !member ? 'bg-indigo-900/20 border-indigo-500/60' : ''}
      `}
    >
      {member ? (
        <div className="relative group">
          <MemberCard
            id={`assigned::party::${partyId}::${position}::${member.userId}`}
            profile={member.profile}
            origin={{ type: 'party', partyId, position }}
            compact
            isMaybe={isMaybe}
            disabled={!canEdit}
          />
          {canEdit && (
            <button
              onClick={onRemove}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-600 hover:bg-red-600 text-slate-300 hover:text-white text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all flex items-center justify-center"
              title="Remove from slot"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-10 text-slate-600 text-xs select-none">
          Slot {position}
        </div>
      )}
    </div>
  );
}
