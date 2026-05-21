import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── Domain types ────────────────────────────────────────────────────────────

export interface LeagueSeason {
  id: string;
  name: string;
  created_at: string;
}

export interface LeaguePlan {
  id: string;
  season_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

/** A party placed freely on the war map within a strategy plan */
export interface LeagueZoneAssignment {
  id: string;
  plan_id: string;
  zone_id: string | null;        // optional zone label (legacy)
  party_id: string | null;
  status: 'friendly' | 'enemy' | 'neutral';
  note: string | null;
  pos_x: number;                 // % of map width  (0–100)
  pos_y: number;                 // % of map height (0–100)
  updated_at: string;
}

/** A directed attack-wave arrow between two placed parties */
export interface LeagueArrow {
  id: string;
  plan_id: string;
  from_zone_id: string | null;   // legacy
  to_zone_id: string | null;     // legacy
  from_party_id: string | null;
  to_party_id: string | null;
  phase: 1 | 2 | 3;
  label: string | null;
  created_at: string;
}

/** A freehand-drawn stroke on the war map */
export interface LeagueDrawing {
  id: string;
  plan_id: string;
  phase: 1 | 2 | 3;
  points: { x: number; y: number }[];
  created_at: string;
}

// ─── Hook state ──────────────────────────────────────────────────────────────

/** Minimal party info fetched from war_parties for plans that reference older weeks */
export interface HistoricParty {
  id: string;
  groupName: string;
  partyNumber: number;
  icon: string | null;
}

interface LeagueBoardState {
  seasons: LeagueSeason[];
  plans: LeaguePlan[];
  assignments: LeagueZoneAssignment[];
  arrows: LeagueArrow[];
  drawings: LeagueDrawing[];
  /** Party stubs fetched when a plan is loaded, keyed by party id */
  historicParties: HistoricParty[];
  activePlanId: string | null;
  loading: boolean;
  error: string | null;
}

interface LeagueBoardActions {
  setActivePlanId: (id: string) => void;
  createSeason: (name: string) => Promise<LeagueSeason | null>;
  createPlan: (seasonId: string, name: string) => Promise<LeaguePlan | null>;
  /** Place or move a party on the map */
  upsertAssignment: (
    planId: string,
    partyId: string,
    posX: number,
    posY: number,
    status?: LeagueZoneAssignment['status'],
    note?: string | null
  ) => Promise<void>;
  removeAssignment: (id: string) => Promise<void>;
  /** Move any assignment by its primary-key id (used for enemy markers) */
  moveAssignment: (id: string, posX: number, posY: number) => Promise<void>;
  /** Add a free-form enemy unit marker to the map */
  addEnemyMarker: (planId: string, posX: number, posY: number) => Promise<void>;
  /** Draw an attack arrow between two placed parties */
  upsertArrow: (
    planId: string,
    fromPartyId: string,
    toPartyId: string,
    phase: 1 | 2 | 3,
    label?: string | null
  ) => Promise<void>;
  deleteArrow: (id: string) => Promise<void>;
  /** Save a freehand-drawn stroke to the map */
  addDrawing: (planId: string, phase: 1 | 2 | 3, points: { x: number; y: number }[]) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;
  reload: () => void;
}

export type UseLeagueBoardReturn = LeagueBoardState & LeagueBoardActions;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLeagueBoard(): UseLeagueBoardReturn {
  const [state, setState] = useState<LeagueBoardState>({
    seasons: [],
    plans: [],
    assignments: [],
    arrows: [],
    drawings: [],
    historicParties: [],
    activePlanId: null,
    loading: true,
    error: null,
  });

  const reloadCounter = useRef(0);

  const loadData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [seasonsRes, plansRes] = await Promise.all([
        supabase.from('league_seasons').select('*').order('created_at', { ascending: false }),
        supabase.from('league_plans').select('*').order('sort_order'),
      ]);
      if (seasonsRes.error) throw seasonsRes.error;
      if (plansRes.error) throw plansRes.error;

      const seasons = (seasonsRes.data ?? []) as LeagueSeason[];
      const plans = (plansRes.data ?? []) as LeaguePlan[];
      const firstPlanId = plans[0]?.id ?? null;

      setState((s) => ({
        ...s,
        seasons,
        plans,
        loading: false,
        activePlanId: s.activePlanId ?? firstPlanId,
      }));
    } catch (err) {
      console.error('[useLeagueBoard] loadData:', err);
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, []);

  const loadPlanData = useCallback(async (planId: string) => {
    try {
      const [assignRes, arrowRes, drawRes] = await Promise.all([
        supabase.from('league_zone_assignments').select('*').eq('plan_id', planId),
        supabase.from('league_arrows').select('*').eq('plan_id', planId).order('phase'),
        supabase.from('league_drawings').select('*').eq('plan_id', planId).order('created_at'),
      ]);
      if (assignRes.error) throw assignRes.error;
      if (arrowRes.error) throw arrowRes.error;
      if (drawRes.error) throw drawRes.error;

      const assignments = (assignRes.data ?? []) as LeagueZoneAssignment[];

      // Fetch party icon + name for every party referenced in this plan so icons
      // render correctly even when the plan was created in a previous week.
      const partyIds = [...new Set(assignments.map((a) => a.party_id).filter(Boolean) as string[])];
      let historicParties: HistoricParty[] = [];
      if (partyIds.length > 0) {
        const { data: partyRows } = await supabase
          .from('war_parties')
          .select('id, icon, party_number, group_id, war_groups!inner(name)')
          .in('id', partyIds);
        if (partyRows) {
          historicParties = (partyRows as unknown as Array<{
            id: string;
            icon: string | null;
            party_number: number;
            war_groups: { name: string };
          }>).map((r) => ({
            id: r.id,
            icon: r.icon,
            partyNumber: r.party_number,
            groupName: r.war_groups.name,
          }));
        }
      }

      setState((s) => ({
        ...s,
        assignments,
        historicParties,
        arrows: (arrowRes.data ?? []) as LeagueArrow[],
        drawings: (drawRes.data ?? []).map((d) => ({
          ...d,
          points: (d.points ?? []) as { x: number; y: number }[],
        })) as LeagueDrawing[],
      }));
    } catch (err) {
      console.error('[useLeagueBoard] loadPlanData:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData, reloadCounter.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload plan data when active plan changes
  useEffect(() => {
    if (state.activePlanId) loadPlanData(state.activePlanId);
  }, [state.activePlanId, loadPlanData]);

  // Realtime subscriptions for the active plan
  useEffect(() => {
    if (!state.activePlanId) return;
    const planId = state.activePlanId;

    const channel = supabase
      .channel(`league_plan_${planId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'league_zone_assignments',
        filter: `plan_id=eq.${planId}`,
      }, () => { loadPlanData(planId); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'league_arrows',
        filter: `plan_id=eq.${planId}`,
      }, () => { loadPlanData(planId); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'league_drawings',
        filter: `plan_id=eq.${planId}`,
      }, () => { loadPlanData(planId); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [state.activePlanId, loadPlanData]);

  // ── Actions ──────────────────────────────────────────────────────────

  const setActivePlanId = useCallback((id: string) => {
    setState((s) => ({ ...s, activePlanId: id }));
  }, []);

  const createSeason = useCallback(async (name: string): Promise<LeagueSeason | null> => {
    const { data, error } = await supabase
      .from('league_seasons').insert({ name }).select().single();
    if (error) { console.error('[useLeagueBoard] createSeason:', error); return null; }
    const season = data as LeagueSeason;
    setState((s) => ({ ...s, seasons: [season, ...s.seasons] }));
    return season;
  }, []);

  const createPlan = useCallback(async (seasonId: string, name: string): Promise<LeaguePlan | null> => {
    const { data: last } = await supabase
      .from('league_plans').select('sort_order').eq('season_id', seasonId)
      .order('sort_order', { ascending: false }).limit(1).single();
    const nextOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('league_plans').insert({ season_id: seasonId, name, sort_order: nextOrder })
      .select().single();
    if (error) { console.error('[useLeagueBoard] createPlan:', error); return null; }
    const plan = data as LeaguePlan;
    setState((s) => ({ ...s, plans: [...s.plans, plan], activePlanId: plan.id }));
    return plan;
  }, []);

  const upsertAssignment = useCallback(async (
    planId: string,
    partyId: string,
    posX: number,
    posY: number,
    status: LeagueZoneAssignment['status'] = 'neutral',
    note: string | null = null
  ) => {
    const now = new Date().toISOString();
    const payload = { plan_id: planId, party_id: partyId, pos_x: posX, pos_y: posY, status, note, updated_at: now };

    // Optimistic update
    setState((s) => {
      const existing = s.assignments.find((a) => a.plan_id === planId && a.party_id === partyId);
      if (existing) {
        return {
          ...s,
          assignments: s.assignments.map((a) =>
            a.id === existing.id ? { ...a, pos_x: posX, pos_y: posY, status, note, updated_at: now } : a
          ),
        };
      }
      return {
        ...s,
        assignments: [
          ...s.assignments,
          { id: `tmp_${Date.now()}`, zone_id: null, ...payload } as LeagueZoneAssignment,
        ],
      };
    });

    const { error } = await supabase
      .from('league_zone_assignments')
      .upsert(payload, { onConflict: 'plan_id,party_id' });
    if (error) {
      console.error('[useLeagueBoard] upsertAssignment:', error);
      if (planId) loadPlanData(planId);
    }
  }, [loadPlanData]);

  const removeAssignment = useCallback(async (id: string) => {
    setState((s) => ({ ...s, assignments: s.assignments.filter((a) => a.id !== id) }));
    const { error } = await supabase.from('league_zone_assignments').delete().eq('id', id);
    if (error) console.error('[useLeagueBoard] removeAssignment:', error);
  }, []);

  const upsertArrow = useCallback(async (
    planId: string,
    fromPartyId: string,
    toPartyId: string,
    phase: 1 | 2 | 3,
    label: string | null = null
  ) => {
    const tempId = `tmp_${Date.now()}`;
    const optimistic: LeagueArrow = {
      id: tempId, plan_id: planId,
      from_zone_id: null, to_zone_id: null,
      from_party_id: fromPartyId, to_party_id: toPartyId,
      phase, label: label ?? null,
      created_at: new Date().toISOString(),
    };

    // Optimistic: show arrow immediately
    setState((s) => {
      const exists = s.arrows.find(
        (a) => a.plan_id === planId && a.from_party_id === fromPartyId && a.to_party_id === toPartyId && a.phase === phase
      );
      if (exists) return s;
      return { ...s, arrows: [...s.arrows, optimistic] };
    });

    const payload = { plan_id: planId, from_party_id: fromPartyId, to_party_id: toPartyId, phase, label };
    const { data, error } = await supabase
      .from('league_arrows')
      .upsert(payload, { onConflict: 'plan_id,from_party_id,to_party_id,phase' })
      .select().single();

    if (error) {
      console.error('[useLeagueBoard] upsertArrow:', error);
      // Revert optimistic
      setState((s) => ({ ...s, arrows: s.arrows.filter((a) => a.id !== tempId) }));
      return;
    }
    const arrow = data as LeagueArrow;
    setState((s) => ({
      ...s,
      arrows: s.arrows.map((a) => a.id === tempId ? arrow : a),
    }));
  }, []);

  const deleteArrow = useCallback(async (id: string) => {
    setState((s) => ({ ...s, arrows: s.arrows.filter((a) => a.id !== id) }));
    const { error } = await supabase.from('league_arrows').delete().eq('id', id);
    if (error) console.error('[useLeagueBoard] deleteArrow:', error);
  }, []);

  const moveAssignment = useCallback(async (id: string, posX: number, posY: number) => {
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      assignments: s.assignments.map((a) =>
        a.id === id ? { ...a, pos_x: posX, pos_y: posY, updated_at: now } : a
      ),
    }));
    const { error } = await supabase
      .from('league_zone_assignments')
      .update({ pos_x: posX, pos_y: posY, updated_at: now })
      .eq('id', id);
    if (error) console.error('[useLeagueBoard] moveAssignment:', error);
  }, []);

  const addEnemyMarker = useCallback(async (planId: string, posX: number, posY: number) => {
    const zoneId = `enemy_${Date.now()}`;
    const now = new Date().toISOString();
    const tempId = `tmp_${Date.now()}`;
    const optimistic: LeagueZoneAssignment = {
      id: tempId, plan_id: planId, zone_id: zoneId, party_id: null,
      status: 'enemy', note: null, pos_x: posX, pos_y: posY, updated_at: now,
    };
    setState((s) => ({ ...s, assignments: [...s.assignments, optimistic] }));

    const { data, error } = await supabase
      .from('league_zone_assignments')
      .insert({ plan_id: planId, zone_id: zoneId, party_id: null,
                pos_x: posX, pos_y: posY, status: 'enemy', updated_at: now })
      .select().single();

    if (error) {
      console.error('[useLeagueBoard] addEnemyMarker:', error);
      setState((s) => ({ ...s, assignments: s.assignments.filter((a) => a.id !== tempId) }));
      return;
    }
    setState((s) => ({
      ...s,
      assignments: s.assignments.map((a) => a.id === tempId ? (data as LeagueZoneAssignment) : a),
    }));
  }, []);

  const reload = useCallback(() => {
    reloadCounter.current += 1;
    loadData();
  }, [loadData]);

  const addDrawing = useCallback(async (
    planId: string,
    phase: 1 | 2 | 3,
    points: { x: number; y: number }[]
  ) => {
    const tempId = `tmp_${Date.now()}`;
    const optimistic: LeagueDrawing = {
      id: tempId, plan_id: planId, phase, points,
      created_at: new Date().toISOString(),
    };
    setState((s) => ({ ...s, drawings: [...s.drawings, optimistic] }));

    const { data, error } = await supabase
      .from('league_drawings')
      .insert({ plan_id: planId, phase, points })
      .select().single();

    if (error) {
      console.error('[useLeagueBoard] addDrawing:', error);
      setState((s) => ({ ...s, drawings: s.drawings.filter((d) => d.id !== tempId) }));
      return;
    }
    const saved = data as { id: string; plan_id: string; phase: number; points: { x: number; y: number }[]; created_at: string };
    setState((s) => ({
      ...s,
      drawings: s.drawings.map((d) => d.id === tempId
        ? { ...saved, phase: saved.phase as 1 | 2 | 3 }
        : d),
    }));
  }, []);

  const deleteDrawing = useCallback(async (id: string) => {
    setState((s) => ({ ...s, drawings: s.drawings.filter((d) => d.id !== id) }));
    const { error } = await supabase.from('league_drawings').delete().eq('id', id);
    if (error) console.error('[useLeagueBoard] deleteDrawing:', error);
  }, []);

  return {
    ...state,
    setActivePlanId,
    createSeason,
    createPlan,
    upsertAssignment,
    removeAssignment,
    moveAssignment,
    addEnemyMarker,
    upsertArrow,
    deleteArrow,
    addDrawing,
    deleteDrawing,
    reload,
  };
}
