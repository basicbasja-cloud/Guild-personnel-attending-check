import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary.tsx'
import { supabase, supabaseConfigError } from './lib/supabase.ts'
import { readStoredUserId } from './hooks/useAuth.ts'
import { formatISO, addDays, startOfDay, getDay } from 'date-fns'

// Compute the current week string the same way useAttendance does.
function getWeekStr(): string {
  const now = startOfDay(new Date());
  const daysUntilSat = (6 - getDay(now) + 7) % 7;
  return formatISO(addDays(now, daysUntilSat), { representation: 'date' });
}

const WEEK_ATTENDANCE_STORAGE_PREFIX = 'gwm_att_v1_';
const PROFILE_CACHE_KEY = 'gwm_profile_cache_v1';
const CLASS_CATALOG_STORAGE_KEY = 'gwm_class_catalog_v1';

if (!supabaseConfigError) {
  const weekStr = getWeekStr();

  // ── 1. Attendance pre-fetch ─────────────────────────────────────────────
  let needsAttFetch = true;
  try {
    const raw = localStorage.getItem(WEEK_ATTENDANCE_STORAGE_PREFIX + weekStr);
    if (raw) {
      const cached = JSON.parse(raw) as { at: number };
      if (Date.now() - cached.at < 30000) needsAttFetch = false;
    }
  } catch { /* ignore */ }

  if (needsAttFetch) {
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

  // ── 2. Profile + class_catalog pre-fetch ───────────────────────────────
  // readStoredUserId() reads the userId directly from the stored auth token
  // (handles chunked storage introduced in @supabase/auth-js v2.64).
  // This fires BEFORE React mounts and without waiting for getSession(),
  // so useAuth finds a warm cache on first render instead of falling back
  // to a fallback profile (is_management: false).
  const storedUserId = readStoredUserId();

  if (storedUserId) {
    const hasCachedProfile = (() => {
      try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY);
        if (!raw) return false;
        const p = JSON.parse(raw) as { id?: string };
        return p?.id === storedUserId;
      } catch { return false; }
    })();

    if (!hasCachedProfile) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', storedUserId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
        });
    }

    const hasCatalogCache = (() => {
      try { return !!localStorage.getItem(CLASS_CATALOG_STORAGE_KEY); } catch { return false; }
    })();

    if (!hasCatalogCache) {
      supabase
        .from('class_catalog')
        .select('name,color_hex')
        .order('name', { ascending: true })
        .then(({ data }) => {
          if (!data || data.length === 0) return;
          try { localStorage.setItem(CLASS_CATALOG_STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
        });
    }
  }

  // ── 3. In-app keepalive: ping every 4 minutes ──────────────────────────
  const dbPing = () => { supabase.from('profiles').select('id').limit(1).then(() => {}); };
  setInterval(dbPing, 4 * 60 * 1000);
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
