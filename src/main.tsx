import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { formatISO } from 'date-fns'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary.tsx'
import { supabaseConfigError } from './lib/supabase.ts'
import { readStoredUserId } from './hooks/useAuth.ts'
import { warmAttendanceForWeek } from './hooks/useAttendance.ts'
import { getUpcomingSaturday } from './lib/week.ts'
import { evictOldWeekCaches } from './lib/cacheEviction.ts'

if (!supabaseConfigError) {
  evictOldWeekCaches();
}

if (!supabaseConfigError && readStoredUserId()) {
  // Joined attendance query shared with useAttendance (one in-flight request).
  // This seeds the board before React mounts without ever writing partial rows.
  const weekStr = formatISO(getUpcomingSaturday(new Date()), { representation: 'date' });
  void warmAttendanceForWeek(weekStr).catch((err) => {
    // Non-fatal: useAttendance retries when it mounts.
    if (import.meta.env.DEV) console.warn('[warmAttendance]', err);
  });
}

// Database keepalive is handled by the scheduled deployment workflow.
// Avoid one timer and an extra query per open browser tab.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
