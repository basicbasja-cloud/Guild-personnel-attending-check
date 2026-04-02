import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary.tsx'
import { supabase, supabaseConfigError } from './lib/supabase.ts'
import { formatISO, addDays, startOfDay, getDay } from 'date-fns'

// Compute the current week string the same way useAttendance does.
function getWeekStr(): string {
  const now = startOfDay(new Date());
  const daysUntilSat = (6 - getDay(now) + 7) % 7;
  return formatISO(addDays(now, daysUntilSat), { representation: 'date' });
}

const WEEK_ATTENDANCE_STORAGE_PREFIX = 'gwm_att_v1_';

// Fire warm-up queries at module load time — before React even mounts.
// 1. Profile ping wakes the DB connection.
// 2. Attendance pre-fetch populates the localStorage cache so the
//    attendance page shows instantly on mount (no spinner at all).
if (!supabaseConfigError) {
  const weekStr = getWeekStr();

  // Only pre-fetch if cache is missing or stale (>30s old).
  let needsFetch = true;
  try {
    const raw = localStorage.getItem(WEEK_ATTENDANCE_STORAGE_PREFIX + weekStr);
    if (raw) {
      const cached = JSON.parse(raw) as { at: number };
      if (Date.now() - cached.at < 30000) needsFetch = false;
    }
  } catch { /* ignore */ }

  if (needsFetch) {
    // Fire both queries in parallel — profiles ping wakes the connection,
    // attendance fetch populates the cache for the component.
    supabase.from('profiles').select('id').limit(1).then(() => {});
    supabase
      .from('attendance')
      .select('id,user_id,week_start,status,created_at,updated_at')
      .eq('week_start', weekStr)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        try {
          localStorage.setItem(
            WEEK_ATTENDANCE_STORAGE_PREFIX + weekStr,
            JSON.stringify({ at: Date.now(), rows: data })
          );
        } catch { /* quota */ }
      });
  }

  // In-app keepalive: ping the DB every 4 minutes while the app is open.
  // GitHub Actions scheduled crons can be delayed 30-90 min on free repos,
  // so this ensures the DB stays warm whenever any user has the tab open.
  const dbPing = () => { supabase.from('profiles').select('id').limit(1).then(() => {}); };
  setInterval(dbPing, 4 * 60 * 1000);

  // Ping immediately when the user returns to the tab after it was hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') dbPing();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
