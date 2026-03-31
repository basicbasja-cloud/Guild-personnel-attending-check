import { useDroppable } from '@dnd-kit/core';
import { MemberCard } from './MemberCard';
import type { PartyWithMembers } from '../../hooks/useWarSetup';
import { MAX_MEMBERS_PER_PARTY } from '../../types';

interface PartyCardProps {
  groupId: string;
  partyData: PartyWithMembers;
  onRemoveMember: (userId: string) => void;
}

export function PartyCard({ groupId, partyData, onRemoveMember }: PartyCardProps) {
  const { party, members } = partyData;

  const slots = Array.from({ length: MAX_MEMBERS_PER_PARTY }, (_, i) => {
    const member = members.find((m) => m.position === i + 1) ?? null;
    return { position: i + 1, member };
  });

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Party header */}
      <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <span className="text-slate-300 text-sm font-semibold">Party {party.party_number}</span>
        <span className="text-slate-500 text-xs">
          {members.length}/{MAX_MEMBERS_PER_PARTY}
        </span>
      </div>

      {/* Member slots */}
      <div className="p-2 space-y-1.5">
        {slots.map(({ position, member }) => (
          <PartySlot
            key={position}
            partyId={party.id}
            groupId={groupId}
            position={position}
            member={member ? { userId: member.user_id, profile: member.profile! } : null}
            onRemove={() => member && onRemoveMember(member.user_id)}
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
  onRemove: () => void;
}

function PartySlot({ partyId, groupId, position, member, onRemove }: PartySlotProps) {
  const dropId = `party::${partyId}::${position}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: 'party', partyId, groupId, position },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-lg min-h-[2.5rem] transition-all
        ${member ? '' : 'border border-dashed border-slate-600 bg-slate-900/40'}
        ${isOver ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900' : ''}
      `}
    >
      {member ? (
        <div className="relative group">
          <MemberCard
            id={`assigned::party::${partyId}::${position}::${member.userId}`}
            profile={member.profile}
            origin={{ type: 'party', partyId, position }}
            compact
          />
          <button
            onClick={onRemove}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-600 hover:bg-red-600 text-slate-300 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
            title="Remove from slot"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center h-10 text-slate-600 text-xs select-none">
          Slot {position}
        </div>
      )}
    </div>
  );
}
