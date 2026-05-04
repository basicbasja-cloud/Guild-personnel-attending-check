import { useState, useEffect, useCallback } from 'react';
import { formatISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import { getUpcomingSaturday } from '../lib/week';
import { syncEngine } from '../lib/syncEngine';
import type { WarSetup, WarGroup, WarParty, WarPartyMember, Profile } from '../types';
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

// ── LocalStorage cache ──────────────────────────────────────────────────────
const CACHE_PREFIX = 'gwm_war_v1_';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function readCache(weekStr: string): { at: number; data: WarSetupData } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + weekStr);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Guard against old cache format with missing/null arrays
    if (!parsed?.data || !Array.isArray(parsed.data.groups) || !Array.isArray(parsed.data.substitutes)) return null;
    return parsed as { at: number; data: WarSetupData };
  } catch {
    return null;
  }
}

function writeCache(weekStr: string, data: WarSetupData) {
  try {
    localStorage.setItem(CACHE_PREFIX + weekStr, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Ignore quota errors.
  }
}

// ── Optimistic state helpers ────────────────────────────────────────────────

/** Remove a user from all slots/substitutes in a WarSetupData snapshot. */
function removeUserFromData(data: WarSetupData, userId: string): WarSetupData {
  return {
    ...data,
    groups: data.groups.map((g) => ({
      ...g,
      parties: g.parties.map((p) => ({
        ...p,
        members: p.members.filter((m) => m.user_id !== userId),
      })),
    })),
    substitutes: data.substitutes.filter((s) => s.user_id !== userId),
  };
}

/**
 * Place a user into a slot, displacing any existing occupant at that position.
 * Caller should pass the base data already stripped of the user's old slot.
 */
function placeUserInData(
  data: WarSetupData,
  userId: string,
  partyId: string | null,
  position: number,
  isSubstitute: boolean,
  profile: Profile
): WarSetupData {
  const base = removeUserFromData(data, userId);
  const newMember: WarPartyMember = {
    id: `opt-${userId}`,
    war_setup_id: data.setup.id,
    party_id: partyId,
    user_id: userId,
    position,
    is_substitute: isSubstitute,
    created_at: new Date().toISOString(),
    profile,
  };

  if (isSubstitute) {
    const substitutes = base.substitutes.filter((s) => s.position !== position);
    return { ...base, substitutes: [...substitutes, newMember] };
  }

  if (partyId) {
    const groups = base.groups.map((g) => ({
      ...g,
      parties: g.parties.map((p) => {
        if (p.party.id !== partyId) return p;
        const members = p.members.filter((m) => m.position !== position);
        return { ...p, members: [...members, newMember] };
      }),
    }));
    return { ...base, groups };
  }

  return base;
}

// ── Database loader ─────────────────────────────────────────────────────────

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

  const result: WarSetupData = { setup, groups: groupsWithParties, substitutes };
  writeCache(weekStartStr, result);
  return result;
}

/**
 * Eagerly warm the war setup cache for the current week.
 * Call this right after login so the War Setup tab opens instantly.
 */
export async function preloadWarSetup(weekStart?: Date): Promise<void> {
  const weekStartStr = formatISO(getUpcomingSaturday(weekStart ?? new Date()), { representation: 'date' });
  const cached = readCache(weekStartStr);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return;
  await loadSetupData(weekStartStr).catch(() => {});
}

export function useWarSetup(weekStart?: Date) {
  const currentWeekStart = getUpcomingSaturday(weekStart ?? new Date());
  const weekStartStr = formatISO(currentWeekStart, { representation: 'date' });

  // Seed state from localStorage cache so UI is instantly populated
  const [data, setData] = useState<WarSetupData | null>(() => {
    const cached = readCache(weekStartStr);
    return cached?.data ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSetup = useCallback(async () => {
    setError(null);
    try {
      const result = await loadSetupData(weekStartStr);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [weekStartStr]);

  // Initial load: serve cache instantly, then refresh in background
  useEffect(() => {
    let cancelled = false;
    const cached = readCache(weekStartStr);
    if (cached?.data) {
      setData(cached.data);
      if (Date.now() - cached.at < CACHE_TTL_MS) return; // Cache is fresh
    } else {
      setLoading(true);
    }
    loadSetupData(weekStartStr)
      .then((result) => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Unknown error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [weekStartStr]);

  // Realtime subscription — watch war_party_members for this setup.
  // The syncEngine tick writes to DB; the realtime event re-confirms server
  // state. We skip the refresh while mutations are still pending to avoid
  // overwriting in-flight optimistic updates.
  useEffect(() => {
    if (!data?.setup.id) return;
    const setupId = data.setup.id;
    let refreshInFlight = false;
    let pendingRefresh = false;

    async function handleChange() {
      if (syncEngine.getPendingCount() > 0) { pendingRefresh = true; return; }
      if (refreshInFlight) { pendingRefresh = true; return; }
      refreshInFlight = true;
      pendingRefresh = false;
      try {
        const result = await loadSetupData(weekStartStr);
        setData(result);
      } finally {
        refreshInFlight = false;
        if (pendingRefresh && syncEngine.getPendingCount() === 0) {
          pendingRefresh = false;
          void handleChange();
        }
      }
    }

    const channel = supabase
      .channel(`war-${setupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'war_party_members', filter: `war_setup_id=eq.${setupId}` }, () => void handleChange())
      .subscribe((status) => syncEngine.setLive(status === 'SUBSCRIBED'));

    return () => {
      syncEngine.setLive(false);
      channel.unsubscribe().finally(() => supabase.removeChannel(channel));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.setup.id, weekStartStr]);

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

    // Auto-create fixed Group A (parties 1-5) and Group B (parties 6-10)
    const setupId = (setup as WarSetup).id;
    const FIXED_GROUPS = [
      { group_number: 1, name: 'Group A' },
      { group_number: 2, name: 'Group B' },
    ];
    for (const g of FIXED_GROUPS) {
      const { data: groupData } = await supabase
        .from('war_groups')
        .insert({ war_setup_id: setupId, group_number: g.group_number, name: g.name })
        .select('id')
        .single();
      if (groupData) {
        const partyRows = Array.from({ length: MAX_PARTIES_PER_GROUP }, (_, i) => ({
          group_id: (groupData as { id: string }).id,
          party_number: i + 1,
        }));
        await supabase.from('war_parties').insert(partyRows);
      }
    }

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

  /**
   * Assign a member to a party slot or substitute list.
   * Applies an optimistic UI update immediately, then queues a background DB
   * write through the syncEngine (flushed every ~400 ms).
   */
  const assignMember = async (
    setupId: string,
    userId: string,
    partyId: string | null,
    position: number,
    isSubstitute: boolean,
    profile?: Profile
  ) => {
    if (profile) {
      setData((prev) =>
        prev ? placeUserInData(prev, userId, partyId, position, isSubstitute, profile) : prev
      );
    }
    syncEngine.enqueue({
      key: `${setupId}:${userId}`,
      setupId, userId, op: 'assign', partyId, position, isSubstitute,
    });
  };

  /** Remove a member from all slots. Optimistic: vanishes from UI instantly. */
  const removeMember = async (setupId: string, userId: string) => {
    setData((prev) => (prev ? removeUserFromData(prev, userId) : prev));
    syncEngine.enqueue({
      key: `${setupId}:${userId}`,
      setupId, userId, op: 'remove', partyId: null, position: 0, isSubstitute: false,
    });
  };

  /**
   * Swap two members' positions. Optimistic: both positions update instantly.
   * Pass profiles so the UI reflects the new occupants without waiting for DB.
   */
  const swapMembers = async (
    setupId: string,
    userId1: string,
    userId2: string,
    partyId1: string | null,
    position1: number,
    isSubstitute1: boolean,
    partyId2: string | null,
    position2: number,
    isSubstitute2: boolean,
    profile1?: Profile,
    profile2?: Profile
  ) => {
    if (profile1 && profile2) {
      setData((prev) => {
        if (!prev) return prev;
        let next = removeUserFromData(prev, userId1);
        next = removeUserFromData(next, userId2);
        next = placeUserInData(next, userId1, partyId2, position2, isSubstitute2, profile1);
        next = placeUserInData(next, userId2, partyId1, position1, isSubstitute1, profile2);
        return next;
      });
    }
    syncEngine.enqueue({ key: `${setupId}:${userId1}`, setupId, userId: userId1, op: 'assign', partyId: partyId2, position: position2, isSubstitute: isSubstitute2 });
    syncEngine.enqueue({ key: `${setupId}:${userId2}`, setupId, userId: userId2, op: 'assign', partyId: partyId1, position: position1, isSubstitute: isSubstitute1 });
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
