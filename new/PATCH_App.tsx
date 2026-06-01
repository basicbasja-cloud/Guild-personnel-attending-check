// ─── PATCH: src/App.tsx ────────────────────────────────────────────────────────
// Make the following 4 targeted changes:

// ── Change 1: Add import (after existing component imports) ──────────────────
import { KpiStatsPage } from './components/kpi/KpiStatsPage';

// ── Change 2: Update Tab type ────────────────────────────────────────────────
// FIND:
type Tab = 'attendance' | 'management' | 'roster' | 'admin' | 'dashboard' | 'league' | 'calendar';
// REPLACE WITH:
type Tab = 'attendance' | 'management' | 'roster' | 'admin' | 'dashboard' | 'league' | 'calendar' | 'kpi';

// ── Change 3: Add to tabs array (after the 'calendar' entry) ─────────────────
{ id: 'kpi', label: 'KPI Stats', emoji: '🏆' },
// Note: no mgmtOnly → visible to all members

// ── Change 4: Add render inside <main> (after the calendar div) ──────────────
{tab === 'kpi' && (
  <KpiStatsPage
    currentUserId={auth.profile.id}
    isSuperManager={auth.profile.is_super_manager ?? false}
  />
)}
