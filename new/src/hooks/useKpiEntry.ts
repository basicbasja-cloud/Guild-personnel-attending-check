import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { KpiWeeklyEntry, KpiEntryInput } from '../types';

interface UseKpiEntryResult {
  entry:   KpiWeeklyEntry | null;
  loading: boolean;
  saving:  boolean;
  error:   string | null;
  fetch:   (userId: string, weekStart: string) => Promise<void>;
  save:    (userId: string, weekStart: string, data: KpiEntryInput) => Promise<boolean>;
}

export function useKpiEntry(): UseKpiEntryResult {
  const [entry, setEntry]     = useState<KpiWeeklyEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async (userId: string, weekStart: string) => {
    setLoading(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc('get_kpi_entry_for_editor', {
      target_user_id:    userId,
      target_week_start: weekStart,
    });
    setLoading(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    const rows = (data as KpiWeeklyEntry[]) ?? [];
    setEntry(rows[0] ?? null);
  }, []);

  const save = useCallback(async (
    userId:    string,
    weekStart: string,
    d:         KpiEntryInput,
  ): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc('upsert_kpi_weekly_entry', {
      target_user_id:           userId,
      target_week_start:        weekStart,
      target_role_tag:          d.role_tag,
      damage_dealt_value:       d.damage_dealt,
      siege_damage_value:       d.siege_damage,
      damage_taken_value:       d.damage_taken,
      kills_value:              d.kills,
      deaths_value:             d.deaths,
      assists_value:            d.assists,
      healing_done_value:       d.healing_done,
      ally_revives_value:       d.ally_revives,
      resources_gathered_value: d.resources_gathered,
    });
    setSaving(false);
    if (rpcErr) { setError(rpcErr.message); return false; }
    return true;
  }, []);

  return { entry, loading, saving, error, fetch, save };
}
