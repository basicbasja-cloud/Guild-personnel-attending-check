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

  const fetchWeekAttendances = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('attendance')
      .select('*, profile:profiles(*)')
      .eq('week_start', weekStartStr)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setWeekAttendances((data as Attendance[]) ?? []);
  }, [weekStartStr]);

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
    await fetchWeekAttendances();
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
