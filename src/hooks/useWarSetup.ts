import { useState, useEffect, useCallback } from 'react';
import { formatISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import { getUpcomingSaturday } from '../lib/week';
import type { WarSetup, WarGroup, WarParty, WarPartyMember } from '../types';
import { MAX_PARTIES_PER_GROUP } from '../types';

export interface WarSetupData {
  setup: WarSetup;
  groups: GroupWithParties[];
  substitutes: WarPartyMember[];
}

export interface GroupWithParties {
  group: WarGroup;
  parties: PartyWithMembers[];
}

export interface PartyWithMembers {
  party: WarParty;
  members: WarPartyMember[];
}

async function loadSetupData(weekStartStr: string): Promise<WarSetupData | null> {
  const { data: setupData, error: setupErr } = await withDbTiming(
    'GET',
    `war_setups.byWeek week=${weekStartStr}`,
    () =>
      supabase
        .from('war_setups')
        .select('*')
        .eq('week_start', weekStartStr)
        .maybeSingle()
  );

  if (setupErr || !setupData) return null;
  const setup = setupData as WarSetup;

  // Fetch war_groups and war_party_members in parallel — both only need
  // setup.id which is now available. war_parties must wait for group IDs,
  // so it runs in a third round-trip after war_groups resolves.
  const [groupsResult, membersResult] = await Promise.all([
    withDbTiming(
      'GET',
      `war_groups.bySetup setup=${setup.id}`,
      () =>
        supabase
          .from('war_groups')
          .select('*')
          .eq('war_setup_id', setup.id)
          .order('group_number')
    ),
    withDbTiming(
      'GET',
      `war_party_members.bySetup setup=${setup.id}`,
      () =>
        supabase
          .from('war_party_members')
          .select('*, profile:profiles(*)')
          .eq('war_setup_id', setup.id)
          .order('position')
    ),
  ]);

  const groups = (groupsResult.data ?? []) as WarGroup[];
  const members = ((membersResult.data ?? []) as WarPartyMember[]).filter((m) => !!m.profile);

  let parties: WarParty[] = [];
  if (groups.length > 0) {
    const { data: partiesData } = await withDbTiming(
      'GET',
      `war_parties.byGroups groups=${groups.length}`,
      () =>
        supabase
          .from('war_parties')
          .select('*')
          .in('group_id', groups.map((g) => g.id))
          .order('party_number')
    );

    parties = (partiesData ?? []) as WarParty[];
  }
  const substitutes = members.filter((m) => m.is_substitute);

  const groupsWithParties: GroupWithParties[] = groups.map((group) => {
    const groupParties = parties.filter((p) => p.group_id === group.id);
    return {
      group,
      parties: groupParties.map((party) => ({
        party,
        members: members.filter((m) => m.party_id === party.id && !m.is_substitute),
      })),
    };
  });

  return { setup, groups: groupsWithParties, substitutes };
}

export function useWarSetup(weekStart?: Date) {
  const currentWeekStart = getUpcomingSaturday(weekStart ?? new Date());
  const weekStartStr = formatISO(currentWeekStart, { representation: 'date' });

  const [data, setData] = useState<WarSetupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadSetupData(weekStartStr);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [weekStartStr]);

  // Sync with Supabase on mount / week change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSetupData(weekStartStr)
      .then((result) => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Unknown error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [weekStartStr]);

  const createSetup = async (createdBy: string) => {
    const { data: existing } = await withDbTiming(
      'GET',
      `war_setups.exists week=${weekStartStr}`,
      () =>
        supabase
          .from('war_setups')
          .select('id')
          .eq('week_start', weekStartStr)
          .maybeSingle()
    );

    if (existing) { await fetchSetup(); return; }

    const { data: setup, error: err } = await withDbTiming(
      'POST',
      `war_setups.create week=${weekStartStr}`,
      () =>
        supabase
          .from('war_setups')
          .insert({ week_start: weekStartStr, created_by: createdBy })
          .select()
          .single()
    );

    if (err) { setError(err.message); return; }
    await fetchSetup();
    return setup as WarSetup;
  };

  const addGroup = async (setupId: string, groupNumber: number, name: string) => {
    const { error: err } = await withDbTiming(
      'POST',
      `war_groups.add setup=${setupId} group=${groupNumber}`,
      () => supabase.from('war_groups').insert({ war_setup_id: setupId, group_number: groupNumber, name })
    );
    const isDuplicateGroup = err?.code === '23505';
    if (err && !isDuplicateGroup) { setError(err.message); return; }

    const { data: newGroup } = await withDbTiming(
      'GET',
      `war_groups.find setup=${setupId} group=${groupNumber}`,
      () =>
        supabase
          .from('war_groups')
          .select('id')
          .eq('war_setup_id', setupId)
          .eq('group_number', groupNumber)
          .single()
    );

    if (newGroup) {
      const rows = Array.from({ length: MAX_PARTIES_PER_GROUP }, (_, index) => ({
        group_id: (newGroup as { id: string }).id,
        party_number: index + 1,
      }));

      await withDbTiming(
        'POST',
        `war_parties.ensureDefault group=${(newGroup as { id: string }).id}`,
        () =>
          supabase
            .from('war_parties')
            .upsert(rows, { onConflict: 'group_id,party_number', ignoreDuplicates: true })
      );
    }
    await fetchSetup();
  };

  const deleteGroup = async (groupId: string) => {
    const { error: err } = await withDbTiming(
      'DELETE',
      `war_groups.delete group=${groupId}`,
      () => supabase.from('war_groups').delete().eq('id', groupId)
    );

    if (err) {
      setError(err.message);
      return;
    }

    await fetchSetup();
  };

  const assignMember = async (
    setupId: string,
    userId: string,
    partyId: string | null,
    position: number,
    isSubstitute: boolean
  ) => {
    await withDbTiming(
      'DELETE',
      `war_party_members.clear setup=${setupId} user=${userId}`,
      () =>
        supabase
          .from('war_party_members')
          .delete()
          .eq('war_setup_id', setupId)
          .eq('user_id', userId)
    );

    if (partyId !== null || isSubstitute) {
      const { error: err } = await withDbTiming(
        'POST',
        `war_party_members.assign setup=${setupId} user=${userId}`,
        () =>
          supabase.from('war_party_members').insert({
            war_setup_id: setupId,
            user_id: userId,
            party_id: partyId,
            position,
            is_substitute: isSubstitute,
          })
      );
      if (err) setError(err.message);
    }
    await fetchSetup();
  };

  const removeMember = async (setupId: string, userId: string) => {
    await withDbTiming(
      'DELETE',
      `war_party_members.remove setup=${setupId} user=${userId}`,
      () =>
        supabase
          .from('war_party_members')
          .delete()
          .eq('war_setup_id', setupId)
          .eq('user_id', userId)
    );
    await fetchSetup();
  };

  const swapMembers = async (
    setupId: string,
    userId1: string,
    userId2: string,
    partyId1: string | null,
    position1: number,
    isSubstitute1: boolean,
    partyId2: string | null,
    position2: number,
    isSubstitute2: boolean
  ) => {
    await withDbTiming(
      'DELETE',
      `war_party_members.swap.clear setup=${setupId} users=${userId1},${userId2}`,
      () =>
        supabase
          .from('war_party_members')
          .delete()
          .eq('war_setup_id', setupId)
          .in('user_id', [userId1, userId2])
    );

    const { error: err } = await withDbTiming(
      'PUT',
      `war_party_members.swap.insert setup=${setupId} users=${userId1},${userId2}`,
      () =>
        supabase.from('war_party_members').insert([
          { war_setup_id: setupId, user_id: userId1, party_id: partyId2, position: position2, is_substitute: isSubstitute2 },
          { war_setup_id: setupId, user_id: userId2, party_id: partyId1, position: position1, is_substitute: isSubstitute1 },
        ])
    );
    if (err) setError(err.message);
    await fetchSetup();
  };

  return {
    data,
    loading,
    error,
    weekStartStr,
    refresh: fetchSetup,
    createSetup,
    addGroup,
    deleteGroup,
    assignMember,
    removeMember,
    swapMembers,
  };
}
