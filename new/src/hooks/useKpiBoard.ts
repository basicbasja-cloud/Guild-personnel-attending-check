import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUpcomingSaturday } from '../lib/week';
import { formatISO } from 'date-fns';
import type { KpiBoardRow } from '../types';

interface UseKpiBoardResult {
  rows: KpiBoardRow[];
  loading: boolean;
  error: string | null;
  weekStart: string;
  setWeekStart: (d: string) => void;
  refresh: () => void;
}

function defaultWeek(): string {
  return formatISO(getUpcomingSaturday(new Date()), { representation: 'date' });
}

export function useKpiBoard(): UseKpiBoardResult {
  const [weekStart, setWeekStart] = useState<string>(defaultWeek);
  const [rows, setRows]           = useState<KpiBoardRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tick, setTick]           = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .rpc('get_kpi_public_board', { target_week_start: weekStart })
      .then(({ data, error: rpcErr }) => {
        if (cancelled) return;
        if (rpcErr) {
          setError(rpcErr.message);
          setRows([]);
        } else {
          setRows((data as KpiBoardRow[]) ?? []);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [weekStart, tick]);

  return { rows, loading, error, weekStart, setWeekStart, refresh };
}
