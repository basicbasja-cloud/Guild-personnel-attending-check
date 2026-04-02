import { useState, useCallback } from 'react';
import { format, addWeeks } from 'date-fns';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useAttendance } from '../../hooks/useAttendance';
import { useWarSetup } from '../../hooks/useWarSetup';
import { MemberCard } from './MemberCard';
import { GroupBoard, SubstituteBoard } from './GroupBoard';
import type { Profile } from '../../types';
import { MAX_ACTIVE_MEMBERS, MAX_SUBSTITUTE_MEMBERS } from '../../types';

interface ManagementPageProps {
  userId: string;
  canEdit: boolean;
}

interface ActiveDragData {
  id: string;
  profile: Profile;
  origin:
    | { type: 'available' }
    | { type: 'party'; partyId: string; position: number }
    | { type: 'substitute'; position: number };
}

export function ManagementPage({ userId, canEdit }: ManagementPageProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const targetWeek = weekOffset === 0 ? undefined : addWeeks(new Date(), weekOffset);

  const { weekAttendances, currentWeekStart } = useAttendance(null, targetWeek);
  const war = useWarSetup(targetWeek);

  const [activeDrag, setActiveDrag] = useState<ActiveDragData | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Touch sensor with delay/tolerance makes drag easier and avoids scroll conflict on phones.
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  const weekLabel = format(currentWeekStart, "EEEE MMM dd, yyyy");

  // Members who said join/maybe and are not yet assigned to any slot
  const assignedUserIds = new Set<string>();
  if (war.data) {
    war.data.groups.forEach((g) =>
      g.parties.forEach((p) => p.members.forEach((m) => assignedUserIds.add(m.user_id)))
    );
    war.data.substitutes.forEach((s) => assignedUserIds.add(s.user_id));
  }

  const availableMembers = weekAttendances
    .filter((a) => (a.status === 'join' || a.status === 'maybe') && !assignedUserIds.has(a.user_id))
    .map((a) => a.profile)
    .filter((p): p is Profile => !!p);

  const maybeUserIds = new Set(
    weekAttendances
      .filter((a) => a.status === 'maybe')
      .map((a) => a.user_id)
  );

  const activeAssignedCount = war.data
    ? war.data.groups.reduce((sum, g) => sum + g.parties.reduce((s, p) => s + p.members.length, 0), 0)
    : 0;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!canEdit) return;
    const { active } = event;
    setActiveDrag({
      id: active.id as string,
      profile: active.data.current?.profile as Profile,
      origin: active.data.current?.origin,
    });
  }, [canEdit]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!canEdit) return;
      setActiveDrag(null);
      const { active, over } = event;
      if (!over || !war.data) return;

      const dragData = active.data.current as {
        profile: Profile;
        origin: ActiveDragData['origin'];
      };
      const dropData = over.data.current as
        | { type: 'party'; partyId: string; groupId: string; position: number }
        | { type: 'substitute'; position: number }
        | { type: 'available' }
        | undefined;

      if (!dropData) return;

      const setupId = war.data.setup.id;
      const dragUserId = dragData.profile.id;

      if (dropData.type === 'available') {
        // Drop back to available → remove from setup
        await war.removeMember(setupId, dragUserId);
        return;
      }

      if (dropData.type === 'party') {
        const { partyId, position } = dropData;
        // Check capacity
        const groupData = war.data.groups.find((g) =>
          g.parties.some((p) => p.party.id === partyId)
        );
        const partyData = groupData?.parties.find((p) => p.party.id === partyId);
        const existingInSlot = partyData?.members.find((m) => m.position === position);

        if (existingInSlot && existingInSlot.user_id !== dragUserId) {
          // Swap
          const dragOrigin = dragData.origin;
          if (dragOrigin.type === 'party') {
            await war.swapMembers(
              setupId,
              dragUserId,
              existingInSlot.user_id,
              dragOrigin.partyId,
              dragOrigin.position,
              false,
              partyId,
              position,
              false
            );
          } else if (dragOrigin.type === 'substitute') {
            await war.swapMembers(
              setupId,
              dragUserId,
              existingInSlot.user_id,
              null,
              dragOrigin.position,
              true,
              partyId,
              position,
              false
            );
          } else {
            // From available → displace existing member back to available
            await war.removeMember(setupId, existingInSlot.user_id);
            await war.assignMember(setupId, dragUserId, partyId, position, false);
          }
        } else if (!existingInSlot) {
          if (activeAssignedCount >= MAX_ACTIVE_MEMBERS && dragData.origin.type === 'available') {
            return; // Capacity reached
          }
          await war.assignMember(setupId, dragUserId, partyId, position, false);
        }
        return;
      }

      if (dropData.type === 'substitute') {
        const { position } = dropData;
        const existingSub = war.data.substitutes.find((s) => s.position === position);

        if (existingSub && existingSub.user_id !== dragUserId) {
          // Swap substitute slots
          const dragOrigin = dragData.origin;
          if (dragOrigin.type === 'substitute') {
            await war.swapMembers(
              setupId,
              dragUserId,
              existingSub.user_id,
              null,
              dragOrigin.position,
              true,
              null,
              position,
              true
            );
          } else if (dragOrigin.type === 'party') {
            await war.swapMembers(
              setupId,
              dragUserId,
              existingSub.user_id,
              dragOrigin.partyId,
              dragOrigin.position,
              false,
              null,
              position,
              true
            );
          } else {
            await war.removeMember(setupId, existingSub.user_id);
            await war.assignMember(setupId, dragUserId, null, position, true);
          }
        } else if (!existingSub) {
          if (
            war.data.substitutes.length >= MAX_SUBSTITUTE_MEMBERS &&
            dragData.origin.type === 'available'
          ) {
            return;
          }
          await war.assignMember(setupId, dragUserId, null, position, true);
        }
      }
    },
    [war, activeAssignedCount, canEdit]
  );

  const handleCreateSetup = async () => {
    if (!canEdit) return;
    await war.createSetup(userId);
  };

  const handleAddGroup = async () => {
    if (!canEdit) return;
    if (!war.data || !newGroupName.trim()) return;
    const highestGroupNumber = war.data.groups.reduce(
      (max, g) => Math.max(max, g.group.group_number),
      0
    );
    const nextNum = highestGroupNumber + 1;
    await war.addGroup(war.data.setup.id, nextNum, newGroupName.trim());
    setNewGroupName('');
    setAddingGroup(false);
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!canEdit) return;
    if (!war.data) return;
    await war.removeMember(war.data.setup.id, memberUserId);
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!canEdit) return;
    if (!war.data) return;
    const confirmed = window.confirm(
      `Delete group "${groupName}"? This will remove all parties and assignments inside this group.`
    );
    if (!confirmed) return;
    await war.deleteGroup(groupId);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="p-3 sm:p-4 max-w-screen-2xl mx-auto">
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

        {war.error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm">
            {war.error}
          </div>
        )}

        {!canEdit && (
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 mb-4 text-slate-300 text-sm">
            Read-only mode: You can view war setup, but only management users can edit it.
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatCard
            label="Available"
            value={weekAttendances.filter((a) => a.status === 'join' || a.status === 'maybe').length}
            max={weekAttendances.length}
            color="emerald"
          />
          <StatCard label="Active" value={activeAssignedCount} max={MAX_ACTIVE_MEMBERS} color="indigo" />
          <StatCard
            label="Substitutes"
            value={war.data?.substitutes.length ?? 0}
            max={MAX_SUBSTITUTE_MEMBERS}
            color="amber"
          />
        </div>

        {!war.data ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⚔️</div>
            <h2 className="text-white text-xl font-bold mb-2">No War Setup Yet</h2>
            <p className="text-slate-400 mb-6">
              {canEdit
                ? 'Create a war setup to start organizing parties for this week.'
                : 'Management has not created a war setup for this week yet.'}
            </p>
            {canEdit && (
              <button
                onClick={handleCreateSetup}
                disabled={war.loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
              >
                {war.loading ? 'Creating…' : 'Create War Setup'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-start">
            {/* Left: Available members */}
            <AvailablePanel members={availableMembers} maybeUserIds={maybeUserIds} canEdit={canEdit} />

            {/* Right: Groups + Substitutes */}
            <div className="flex-1 space-y-6 min-w-0">
              {war.data.groups.map((g) => (
                <GroupBoard
                  key={g.group.id}
                  groupData={g}
                  onRemoveMember={handleRemoveMember}
                  onDeleteGroup={handleDeleteGroup}
                  maybeUserIds={maybeUserIds}
                  canEdit={canEdit}
                />
              ))}

              {/* Add Group button */}
              {canEdit && war.data.groups.length * 30 < MAX_ACTIVE_MEMBERS && (
                <div>
                  {addingGroup ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group name (e.g. Group A)"
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                        autoFocus
                      />
                      <button
                        onClick={handleAddGroup}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setAddingGroup(false)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm px-4 py-2 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingGroup(true)}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-slate-600 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 transition-colors text-sm font-medium"
                    >
                      + Add Group
                    </button>
                  )}
                </div>
              )}

              {/* Substitutes */}
              <SubstituteBoard
                substitutes={war.data.substitutes.map((s) => ({
                  userId: s.user_id,
                  profile: s.profile!,
                  position: s.position,
                }))}
                maxSubstitutes={MAX_SUBSTITUTE_MEMBERS}
                onRemoveMember={handleRemoveMember}
                maybeUserIds={maybeUserIds}
                canEdit={canEdit}
              />
            </div>
          </div>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDrag ? (
          <MemberCard
            id={`overlay::${activeDrag.id}`}
            profile={activeDrag.profile}
            origin={activeDrag.origin}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function AvailablePanel({ members, maybeUserIds, canEdit }: { members: Profile[]; maybeUserIds: Set<string>; canEdit: boolean }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'available-pool',
    data: { type: 'available' },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-full xl:w-64 xl:shrink-0 bg-slate-900 rounded-2xl border transition-colors xl:sticky xl:top-20 max-h-96 xl:max-h-[calc(100vh-6rem)] flex flex-col
        ${isOver ? 'border-indigo-500' : 'border-slate-700'}`}
    >
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
        <h3 className="text-white font-bold">Available</h3>
        <span className="bg-emerald-900/50 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-medium">
          {members.length}
        </span>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        {members.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            {canEdit
              ? 'Drop members here to unassign, or wait for members to submit attendance.'
              : 'No available members right now.'}
          </p>
        ) : (
          members.map((profile) => (
            <MemberCard
              key={profile.id}
              id={`available::${profile.id}`}
              profile={profile}
              origin={{ type: 'available' }}
              isMaybe={maybeUserIds.has(profile.id)}
              disabled={!canEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  max: number;
  color: 'emerald' | 'indigo' | 'amber';
}

const colorMap = {
  emerald: { bg: 'bg-emerald-900/30', text: 'text-emerald-300', bar: 'bg-emerald-500' },
  indigo: { bg: 'bg-indigo-900/30', text: 'text-indigo-300', bar: 'bg-indigo-500' },
  amber: { bg: 'bg-amber-900/30', text: 'text-amber-300', bar: 'bg-amber-500' },
};

function StatCard({ label, value, max, color }: StatCardProps) {
  const c = colorMap[color];
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`${c.bg} rounded-xl border border-slate-700 p-4`}>
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>
        {value}
        <span className="text-slate-500 text-sm font-normal">/{max}</span>
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
