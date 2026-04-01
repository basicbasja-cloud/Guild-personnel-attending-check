import { useState, useEffect, useCallback } from 'react';
import { startOfISOWeek, formatISO } from 'date-fns';
import { supabase } from '../lib/supabase';
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
  const { data: setupData, error: setupErr } = await supabase
    .from('war_setups')
    .select('*')
    .eq('week_start', weekStartStr)
    .maybeSingle();

  if (setupErr || !setupData) return null;
  const setup = setupData as WarSetup;

  const { data: groupsData } = await supabase
    .from('war_groups')
    .select('*')
    .eq('war_setup_id', setup.id)
    .order('group_number');

  const groups = (groupsData ?? []) as WarGroup[];

  const { data: partiesData } = await supabase
    .from('war_parties')
    .select('*')
    .in('group_id', groups.map((g) => g.id))
    .order('party_number');

  const parties = (partiesData ?? []) as WarParty[];

  const { data: membersData } = await supabase
    .from('war_party_members')
    .select('*, profile:profiles(*)')
    .eq('war_setup_id', setup.id)
    .order('position');

  const members = (membersData ?? []) as WarPartyMember[];
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
  const currentWeekStart = weekStart ?? startOfISOWeek(new Date());
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
    const { data: existing } = await supabase
      .from('war_setups')
      .select('id')
      .eq('week_start', weekStartStr)
      .maybeSingle();

    if (existing) { await fetchSetup(); return; }

    const { data: setup, error: err } = await supabase
      .from('war_setups')
      .insert({ week_start: weekStartStr, created_by: createdBy })
      .select()
      .single();

    if (err) { setError(err.message); return; }
    await fetchSetup();
    return setup as WarSetup;
  };

  const addGroup = async (setupId: string, groupNumber: number, name: string) => {
    const { error: err } = await supabase
      .from('war_groups')
      .insert({ war_setup_id: setupId, group_number: groupNumber, name });
    if (err) { setError(err.message); return; }

    const { data: newGroup } = await supabase
      .from('war_groups')
      .select('id')
      .eq('war_setup_id', setupId)
      .eq('group_number', groupNumber)
      .single();

    if (newGroup) {
      for (let i = 1; i <= MAX_PARTIES_PER_GROUP; i++) {
        await supabase
          .from('war_parties')
          .insert({ group_id: (newGroup as { id: string }).id, party_number: i });
      }
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
    await supabase
      .from('war_party_members')
      .delete()
      .eq('war_setup_id', setupId)
      .eq('user_id', userId);

    if (partyId !== null || isSubstitute) {
      const { error: err } = await supabase.from('war_party_members').insert({
        war_setup_id: setupId,
        user_id: userId,
        party_id: partyId,
        position,
        is_substitute: isSubstitute,
      });
      if (err) setError(err.message);
    }
    await fetchSetup();
  };

  const removeMember = async (setupId: string, userId: string) => {
    await supabase
      .from('war_party_members')
      .delete()
      .eq('war_setup_id', setupId)
      .eq('user_id', userId);
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
    await supabase
      .from('war_party_members')
      .delete()
      .eq('war_setup_id', setupId)
      .in('user_id', [userId1, userId2]);

    const { error: err } = await supabase.from('war_party_members').insert([
      { war_setup_id: setupId, user_id: userId1, party_id: partyId2, position: position2, is_substitute: isSubstitute2 },
      { war_setup_id: setupId, user_id: userId2, party_id: partyId1, position: position1, is_substitute: isSubstitute1 },
    ]);
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
    assignMember,
    removeMember,
    swapMembers,
  };
}
