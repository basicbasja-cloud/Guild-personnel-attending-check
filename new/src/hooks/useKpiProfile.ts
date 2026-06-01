import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { KpiProfileRow } from '../types';

interface UseKpiProfileResult {
  rows: KpiProfileRow[];
  loading: boolean;
  error: string | null;
}

export function useKpiProfile(
  userId: string | null,
  maxWeeks = 8,
): UseKpiProfileResult {
  const [rows, setRows]       = useState<KpiProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .rpc('get_kpi_profile', { target_user_id: userId, max_weeks: maxWeeks })
      .then(({ data, error: rpcErr }) => {
        if (cancelled) return;
        if (rpcErr) {
          setError(rpcErr.message);
          setRows([]);
        } else {
          setRows((data as KpiProfileRow[]) ?? []);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, maxWeeks]);

  return { rows, loading, error };
}
