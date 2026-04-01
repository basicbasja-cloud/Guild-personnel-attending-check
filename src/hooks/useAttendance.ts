import { useState, useEffect, useCallback } from 'react';
import { startOfISOWeek, formatISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { Attendance, AttendanceStatus } from '../types';

export function useAttendance(userId: string | null, weekStart?: Date) {
  const currentWeekStart = weekStart ?? startOfISOWeek(new Date());
  const weekStartStr = formatISO(currentWeekStart, { representation: 'date' });

  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [weekAttendances, setWeekAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetches the full week list without toggling the loading flag.
  // Returns the fetched rows so callers can reuse the data (e.g. to update
  // the user's own attendance record without an extra round-trip).
  // Used by the real-time subscription and setStatus so the attendance
  // buttons are never left permanently disabled if a network call hangs.
  const refreshSilent = useCallback(async (): Promise<Attendance[]> => {
    const { data, error: err } = await supabase
      .from('attendance')
      .select('*, profile:profiles(*)')
      .eq('week_start', weekStartStr)
      .order('created_at', { ascending: true });
    const rows = (data as Attendance[]) ?? [];
    if (err) setError(err.message);
    else setWeekAttendances(rows);
    return rows;
  }, [weekStartStr]);

  const fetchWeekAttendances = useCallback(async () => {
    setLoading(true);
    await refreshSilent();
    setLoading(false);
  }, [refreshSilent]);

  // Initial data fetch on mount or when week / user changes.
  useEffect(() => {
    let cancelled = false;

    const fetchMine = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekStartStr)
        .maybeSingle();
      if (!cancelled) setAttendance(data as Attendance | null);
    };

    const fetchAll = async () => {
      const { data, error: err } = await supabase
        .from('attendance')
        .select('*, profile:profiles(*)')
        .eq('week_start', weekStartStr)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (err) setError(err.message);
      else setWeekAttendances((data as Attendance[]) ?? []);
    };

    fetchMine();
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [userId, weekStartStr]);

  // Real-time subscription – updates all open clients the moment any
  // attendance record for the current week is inserted, updated, or deleted.
  useEffect(() => {
    const channel = supabase
      .channel(`attendance-${weekStartStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `week_start=eq.${weekStartStr}`,
        },
        async () => {
          // Refresh the full list (with profile data) so the roster is in sync.
          // Reuse the returned rows to update the current user's own record
          // without an additional round-trip.
          const allData = await refreshSilent();
          if (userId) {
            const ownRecord = allData.find((a) => a.user_id === userId) ?? null;
            setAttendance(ownRecord);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekStartStr, userId, refreshSilent]);

  const setStatus = async (status: AttendanceStatus) => {
    if (!userId) return;
    setError(null);
    const { data, error: err } = await supabase
      .from('attendance')
      .upsert(
        {
          user_id: userId,
          week_start: weekStartStr,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setAttendance(data as Attendance);
    // Refresh without a loading spinner so buttons are never permanently
    // disabled. The real-time subscription also fires for other clients.
    await refreshSilent();
  };

  return {
    attendance,
    weekAttendances,
    loading,
    error,
    setStatus,
    currentWeekStart,
    weekStartStr,
    refresh: fetchWeekAttendances,
  };
}
