import { useState, useCallback, useMemo } from 'react';
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
import { useTrainingAttendance } from '../../hooks/useTrainingAttendance';
import { useWarSetup } from '../../hooks/useWarSetup';
import { useAllProfiles } from '../../hooks/useAllProfiles';
import { GroupBoard, SubstituteBoard } from '../management/GroupBoard';
import { MemberCard } from '../management/MemberCard';
import type { Profile, GuildEvent, WarPartyMember } from '../../types';
import { MAX_ACTIVE_MEMBERS, MAX_SUBSTITUTE_MEMBERS } from '../../types';

interface ActiveDragData {
  id: string;
  profile: Profile;
  origin:
    | { type: 'available' }
    | { type: 'party'; partyId: string; position: number }
    | { type: 'substitute'; position: number };
}

interface TrainingSetupModalProps {
  event: GuildEvent;
  currentUserId: string;
  isManagement: boolean;
  onClose: () => void;
}

export function TrainingSetupModal({
  event,
  currentUserId,
  isManagement,
  onClose,
}: TrainingSetupModalProps) {
  const { eventAttendances } = useTrainingAttendance(event.id, currentUserId);
  const war = useWarSetup(undefined, 'training', event.id);
  const { profiles: allProfiles } = useAllProfiles();

  const [activeDrag, setActiveDrag] = useState<ActiveDragData | null>(null);
  const [swappingPartyId, setSwappingPartyId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  const canEdit = isManagement;

  // Members who said join/maybe for this training event, not yet assigned
  const assignedUserIds = new Set<string>();
  if (war.data) {
    war.data.groups.forEach((g) =>
      (g.parties ?? []).forEach((p) =>
        (p.members ?? []).forEach((m) => assignedUserIds.add(m.user_id))
      )
    );
    (war.data.substitutes ?? []).forEach((s) => assignedUserIds.add(s.user_id));
  }

  const availableProfiles = eventAttendances
    .filter((a) => (a.status === 'join' || a.status === 'maybe') && !assignedUserIds.has(a.user_id))
    .map((a) => a.profile)
    .filter((p): p is Profile => !!p);

  const respondedUserIds = new Set(eventAttendances.map((a) => a.user_id));
  const nonSelectProfiles = allProfiles.filter(
    (p) => !respondedUserIds.has(p.id) && !assignedUserIds.has(p.id)
  );

  const maybeUserIds = new Set(
    eventAttendances
      .filter((a) => a.status === 'maybe')
      .map((a) => a.user_id)
  );

  const activeAssignedCount = war.data
    ? war.data.groups.reduce((sum, g) => sum + g.parties.reduce((s, p) => s + p.members.length, 0), 0)
    : 0;

  // Remap war.data.substitutes to the format SubstituteBoard expects
  const substituteSlots = useMemo(() => {
    if (!war.data) return [];
    return war.data.substitutes.map((s) => ({
      userId: s.user_id,
      profile: s.profile!,
      position: s.position,
    }));
  }, [war.data]);

  // Class distribution across all assigned members (like the main war setup)
  const classDistribution = useMemo(() => {
    if (!war.data) return [];
    const counts = new Map<string, number>();
    const allMembers: WarPartyMember[] = [];
    for (const g of war.data.groups) {
      for (const p of g.parties) {
        for (const m of p.members) {
          if (m) allMembers.push(m);
        }
      }
    }
    for (const m of allMembers) {
      const cls = m.profile?.character_class ?? 'Unknown';
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cls, count]) => ({ cls, count }));
  }, [war.data]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!canEdit) return;
      setSwappingPartyId(null);
      const { active } = event;
      setActiveDrag({
        id: active.id as string,
        profile: active.data.current?.profile as Profile,
        origin: active.data.current?.origin,
      });
    },
    [canEdit]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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
        war.removeMember(setupId, dragUserId);
        return;
      }

      if (dropData.type === 'party') {
        const { partyId, position } = dropData;
        const groupData = war.data.groups.find((g) =>
          g.parties.some((p) => p.party.id === partyId)
        );
        const partyData = groupData?.parties.find((p) => p.party.id === partyId);
        const existingInSlot = partyData?.members.find((m) => m.position === position);

        if (existingInSlot && existingInSlot.user_id !== dragUserId) {
          const dragOrigin = dragData.origin;
          if (dragOrigin.type === 'party') {
            war.swapMembers(
              setupId, dragUserId, existingInSlot.user_id,
              dragOrigin.partyId, dragOrigin.position, false,
              partyId, position, false,
              dragData.profile, existingInSlot.profile
            );
          } else if (dragOrigin.type === 'substitute') {
            war.swapMembers(
              setupId, dragUserId, existingInSlot.user_id,
              null, dragOrigin.position, true,
              partyId, position, false,
              dragData.profile, existingInSlot.profile
            );
          } else {
            war.removeMember(setupId, existingInSlot.user_id);
            war.assignMember(setupId, dragUserId, partyId, position, false, dragData.profile);
          }
        } else if (!existingInSlot) {
          if (activeAssignedCount >= MAX_ACTIVE_MEMBERS && dragData.origin.type === 'available') return;
          war.assignMember(setupId, dragUserId, partyId, position, false, dragData.profile);
        }
        return;
      }

      if (dropData.type === 'substitute') {
        const { position } = dropData;
        const existingSub = war.data.substitutes.find((s) => s.position === position);
        if (existingSub && existingSub.user_id !== dragUserId) {
          const dragOrigin = dragData.origin;
          if (dragOrigin.type === 'substitute') {
            war.swapMembers(
              setupId, dragUserId, existingSub.user_id,
              null, dragOrigin.position, true,
              null, position, true,
              dragData.profile, existingSub.profile
            );
          } else if (dragOrigin.type === 'party') {
            war.swapMembers(
              setupId, dragUserId, existingSub.user_id,
              dragOrigin.partyId, dragOrigin.position, false,
              null, position, true,
              dragData.profile, existingSub.profile
            );
          } else {
            war.removeMember(setupId, existingSub.user_id);
            war.assignMember(setupId, dragUserId, null, position, true, dragData.profile);
          }
        } else if (!existingSub) {
          if (war.data.substitutes.length >= MAX_SUBSTITUTE_MEMBERS && dragData.origin.type === 'available') return;
          war.assignMember(setupId, dragUserId, null, position, true, dragData.profile);
        }
      }
    },
    [war, activeAssignedCount, canEdit]
  );

  const handleCreateSetup = async () => {
    if (!canEdit) return;
    await war.createSetup(currentUserId);
  };

  const handleRemoveMember = (memberUserId: string) => {
    if (!canEdit || !war.data) return;
    war.removeMember(war.data.setup.id, memberUserId);
  };

  const handlePartySwapClick = (partyId: string) => {
    if (!canEdit || !war.data) return;
    if (swappingPartyId === null) {
      setSwappingPartyId(partyId);
      return;
    }
    if (swappingPartyId === partyId) {
      setSwappingPartyId(null);
      return;
    }
    war.swapEntireParty(war.data.setup.id, swappingPartyId, partyId);
    setSwappingPartyId(null);
  };

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Unscheduled';

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Full page layout — no modal overlay */}
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Fixed top bar */}
        <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors text-lg"
              title="Back to calendar"
            >
              ← Back
            </button>
            <div>
              <h1 className="font-bold text-white text-lg flex items-center gap-2">
                🏋️ Training Setup: {event.title}
              </h1>
              <p className="text-slate-400 text-xs">{eventDate}{event.start_time ? ` at ${event.start_time}` : ''}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-screen-2xl mx-auto w-full space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 rounded-xl border border-emerald-800/50 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Available</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{eventAttendances.filter((a) => a.status === 'join' || a.status === 'maybe').length}</p>
              <p className="text-xs text-slate-500">{eventAttendances.length} total responses</p>
            </div>
            <div className="bg-slate-900 rounded-xl border border-indigo-800/50 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{activeAssignedCount}</p>
              <p className="text-xs text-slate-500">Max {MAX_ACTIVE_MEMBERS}</p>
            </div>
            <div className="bg-slate-900 rounded-xl border border-amber-800/50 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Substitutes</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{war.data?.substitutes.length ?? 0}</p>
              <p className="text-xs text-slate-500">Max {MAX_SUBSTITUTE_MEMBERS}</p>
            </div>
          </div>

          {war.error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{war.error}</div>
          )}

          {/* Class distribution (like the main war setup) */}
          {classDistribution.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Class Distribution</h3>
              <div className="flex flex-wrap gap-2">
                {classDistribution.map(({ cls, count }) => (
                  <span
                    key={cls}
                    className="text-xs px-2 py-1 rounded-full bg-slate-800 border border-slate-600 text-slate-300"
                  >
                    {cls}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Create setup button or war board */}
          {!war.data ? (
            <div className="text-center py-16">
              {canEdit ? (
                <>
                  <p className="text-slate-400 mb-4">No training setup created yet for this event.</p>
                  <button
                    onClick={handleCreateSetup}
                    className="px-6 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-semibold transition-colors"
                  >
                    ⚔️ Create Training Setup
                  </button>
                </>
              ) : (
                <p className="text-slate-400">No training setup has been created yet.</p>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              {/* Left sidebar — non-responded compact list */}
              {nonSelectProfiles.length > 0 && (
                <aside className="w-44 shrink-0 hidden lg:block">
                  <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden sticky top-4">
                    <div className="px-3 py-2 bg-slate-800 border-b border-slate-700">
                      <p className="text-xs text-slate-400 font-semibold">
                        ❓ Non-Select ({nonSelectProfiles.length})
                      </p>
                    </div>
                    <div className="overflow-y-auto max-h-[70vh] p-2 space-y-1.5">
                      {nonSelectProfiles.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/60 opacity-60"
                        >
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {p.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-white text-xs font-medium truncate leading-tight">
                              {p.character_name ?? p.username}
                            </p>
                            {p.character_name && (
                              <p className="text-slate-500 text-[10px] truncate leading-tight">{p.username}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              )}

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-6">
                {/* Available members section */}
                <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm">
                      ✅ Available Members{' '}
                      <span className="text-slate-400 font-normal">({availableProfiles.length})</span>
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableProfiles.map((p) => (
                      <MemberCard key={p.id} id={p.id} profile={p} origin={{ type: 'available' }} />
                    ))}
                    {availableProfiles.length === 0 && (
                      <p className="text-slate-500 text-xs py-2">All join/maybe members are assigned.</p>
                    )}
                  </div>
                </div>

                {/* Groups / Parties */}
                <div className="space-y-4">
                  {war.data.groups.map((g) => (
                    <GroupBoard
                      key={g.group.id}
                      groupData={g}
                      canEdit={canEdit}
                      swappingPartyId={swappingPartyId}
                      onPartySwapClick={handlePartySwapClick}
                      onRemoveMember={handleRemoveMember}
                      maybeUserIds={maybeUserIds}
                    />
                  ))}
                </div>

                {/* Substitutes */}
                {war.data && (
                  <SubstituteBoard
                    substitutes={substituteSlots}
                    maxSubstitutes={MAX_SUBSTITUTE_MEMBERS}
                    canEdit={canEdit}
                    onRemoveMember={handleRemoveMember}
                    maybeUserIds={maybeUserIds}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <MemberCard
            id={activeDrag.id}
            profile={activeDrag.profile}
            origin={activeDrag.origin}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
