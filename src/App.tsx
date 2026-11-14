import { useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { AccessKeyGatePage } from './components/auth/AccessKeyGatePage';
import { Header } from './components/layout/Header';
import { AttendancePage } from './components/attendance/AttendancePage';
import type { PartySummaryWithMembers } from './components/league/LeagueBoardPage';
import { MemberOfTheWeekBanner } from './components/motw/MemberOfTheWeekBanner';
import { Badge } from './components/ui/Badge';
import { useWarSetup } from './hooks/useWarSetup';
import { useGuildEvents } from './hooks/useGuildEvents';
import { useTrainingNotification } from './hooks/useTrainingNotification';
import { FloatingNotification } from './components/ui/FloatingNotification';
import { ClassCatalogProvider } from './contexts/ClassCatalogContext';
import { supabaseConfigError } from './lib/supabase';

// Heavy tabs are split into their own chunks and loaded on first visit.
const ManagementPage = lazy(() =>
  import('./components/management/ManagementPage').then((m) => ({ default: m.ManagementPage }))
);
const RosterPage = lazy(() =>
  import('./components/management/RosterPage').then((m) => ({ default: m.RosterPage }))
);
const AdminModePage = lazy(() =>
  import('./components/management/AdminModePage').then((m) => ({ default: m.AdminModePage }))
);
const PlayerStatsDashboard = lazy(() =>
  import('./components/management/PlayerStatsDashboard').then((m) => ({ default: m.PlayerStatsDashboard }))
);
const ResponseLogPage = lazy(() =>
  import('./components/management/ResponseLogPage').then((m) => ({ default: m.ResponseLogPage }))
);
const LeagueBoardPage = lazy(() =>
  import('./components/league/LeagueBoardPage').then((m) => ({ default: m.LeagueBoardPage }))
);
const GuildCalendarPage = lazy(() =>
  import('./components/calendar/GuildCalendarPage').then((m) => ({ default: m.GuildCalendarPage }))
);
const ProfilePage = lazy(() =>
  import('./components/profile/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const KpiStatsPage = lazy(() =>
  import('./components/kpi/KpiStatsPage').then((m) => ({ default: m.KpiStatsPage }))
);
const AnnouncementsPage = lazy(() =>
  import('./components/announcements/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage }))
);

type Tab = 'attendance' | 'management' | 'roster' | 'admin' | 'dashboard' | 'response-log' | 'league' | 'calendar' | 'kpi' | 'announcements';

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500 text-sm animate-pulse">
      Loading…
    </div>
  );
}

function AppContent() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('attendance');
  // Once a tab has been opened it stays mounted (hidden) to preserve state.
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set<Tab>(['attendance']));
  const openTab = useCallback((id: Tab) => {
    setTab(id);
    setVisitedTabs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const isGoogleLoginEnabled = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';
  // War setup is only needed by the League Board here; ManagementPage owns its
  // own instance. Loading it lazily avoids 4 requests for every visitor.
  const warSetup = useWarSetup(undefined, undefined, undefined, tab === 'league');
  const [myProfileOpen, setMyProfileOpen] = useState(false);

  // ── Training notification ──────────────────────────────────────────
  const { notification: trainingNotif, dismissed: trainingNotifDismissed, dismiss: dismissTrainingNotif } =
    useTrainingNotification(auth.profile?.id ?? '');

  // ── Guild events (for training badge on calendar tab) ──────────────
  // The Calendar tab has its own instance; keep only one subscription active.
  const { events: guildEvents } = useGuildEvents(tab !== 'calendar');

  // ── Notification badges ────────────────────────────────────────────
  const [announcementIds, setAnnouncementIds] = useState<string[]>([]);

  const handleAnnouncementsLoaded = useCallback((ids: string[]) => {
    setAnnouncementIds(ids);
  }, []);

  const handleTabOpened = useCallback(() => {
    try { localStorage.setItem('gwm_last_read_announcement', announcementIds[0] ?? ''); } catch {}
  }, [announcementIds]);
  const badgeUnread = useMemo(() => {
    if (announcementIds.length === 0) return 0;
    const lastRead = (() => { try { return localStorage.getItem('gwm_last_read_announcement'); } catch { return null; } })();
    if (!lastRead) return announcementIds.length;
    const idx = announcementIds.indexOf(lastRead);
    return idx > 0 ? idx : 0;
  }, [announcementIds]);

  const trainingBadgeCount = useMemo(
    () => guildEvents.filter((e) => e.event_type === 'training' && Date.now() - new Date(e.created_at).getTime() < 86400000).length,
    [guildEvents]
  );

  // Flat list of all parties with full member data (for League Board).
  // Preserve the last non-empty list so the board never briefly shows empty
  // icons while warSetup data reloads (e.g. after a tab switch).
  const lastPartiesRef = useRef<PartySummaryWithMembers[]>([]);
  const partySummaries = useMemo((): PartySummaryWithMembers[] => {
    if (!warSetup.data) return lastPartiesRef.current;
    const fresh = warSetup.data.groups.flatMap((g) =>
      g.parties.map((p) => ({
        id: p.party.id,
        groupName: g.group.name,
        partyNumber: p.party.party_number,
        icon: p.party.icon,
        members: p.members
          .filter((m) => m.profile != null)
          .map((m) => ({
            id: m.user_id,
            username: m.profile!.username,
            characterName: m.profile!.character_name,
            characterClass: m.profile!.character_class,
            mainSkillName: m.profile!.main_skill_name,
            mainSkillLevel: m.profile!.main_skill_level,
            subSkillName: m.profile!.sub_skill_name,
            subSkillLevel: m.profile!.sub_skill_level,
            avatarUrl: m.profile!.avatar_url,
          })),
      }))
    );
    if (fresh.length > 0) lastPartiesRef.current = fresh;
    return fresh.length > 0 ? fresh : lastPartiesRef.current;
  }, [warSetup.data]);

  // Data is loaded on demand by each tab (and warmed by main.tsx for the
  // default Attendance tab) so login does not fan out across every feature.

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-600 mb-6 shadow-lg shadow-indigo-900/50">
            <span className="text-4xl">⚔️</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Guild War Manager</h1>
          <p className="text-slate-400 text-sm mb-8">Attendance check &amp; party organizer</p>

          {/* Animated bar */}
          <div className="w-48 mx-auto h-1 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-indigo-500 rounded-full animate-[loading-bar_1.8s_ease-in-out_infinite]" />
          </div>

          <p className="text-slate-400 text-sm">Connecting to server…</p>
          <p className="text-slate-600 text-xs mt-1">First load may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (!auth.user || !auth.profile) {
    return (
      <LoginPage
        onLogin={auth.signInWithDiscord}
        onGoogleLogin={auth.signInWithGoogle}
        showGoogleLogin={isGoogleLoginEnabled}
        error={auth.error}
        loading={auth.loading}
      />
    );
  }

  // Access key gate — new users must enter a valid key before using the app
  if (!auth.profile.access_granted) {
    return <AccessKeyGatePage />;
  }

  const tabs: { id: Tab; label: string; emoji: string; mgmtOnly?: boolean }[] = [
    { id: 'attendance', label: 'Attendance', emoji: '📋' },
    { id: 'roster', label: 'Roster', emoji: '👥' },
    { id: 'announcements', label: 'Announcements', emoji: '📢' },
    { id: 'management', label: 'War Setup', emoji: '⚔️', mgmtOnly: true },
    { id: 'dashboard', label: 'Analytics', emoji: '📊', mgmtOnly: true },
    { id: 'response-log', label: 'Response Times', emoji: '🕒', mgmtOnly: true },
    { id: 'league', label: 'League Board', emoji: '🗺️' },
    { id: 'calendar', label: 'Guild Event Schedule', emoji: '📅' },
    { id: 'kpi',   label: 'KPI Stats',  emoji: '🏆' },
    { id: 'admin', label: 'Admin Mode', emoji: '🔐', mgmtOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => {
    if (!t.mgmtOnly) return true;
    if (t.id === 'admin') return true;
    if (t.id === 'management') return true;
    return auth.profile?.is_management;
  });

  return (
    <ClassCatalogProvider>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header
            profile={auth.profile}
            onSignOut={auth.signOut}
            onProfileClick={() => setMyProfileOpen(true)}
          />
        <MemberOfTheWeekBanner
          isManagement={auth.profile.is_management}
          userId={auth.profile.id}
        />

        {/* Tab navigation */}
        <div className="bg-slate-900 border-b border-slate-700 px-2 sm:px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 max-w-screen-2xl mx-auto w-max min-w-full">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  openTab(t.id);
                  if (t.id === 'calendar') {
                    dismissTrainingNotif();
                  }
                  if (t.id === 'announcements') {
                    try { localStorage.setItem('gwm_last_read_announcement', announcementIds[0] ?? ''); } catch {}
                  }
                }}
                className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] touch-manipulation
                  ${
                    tab === t.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
              >
                <span className="text-base sm:text-base leading-none">{t.emoji}</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  {t.label}
                  {t.id === 'announcements' && <Badge count={badgeUnread} />}
                  {t.id === 'calendar' && <Badge count={trainingBadgeCount} pulse />}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<PageFallback />}>
          {tab === 'attendance' && (
            <AttendancePage profile={auth.profile} onUpdateProfile={auth.updateProfile} />
          )}
          {tab === 'roster' && <RosterPage userId={auth.profile.id} isManagement={auth.profile.is_management} />}
          {tab === 'announcements' && (
            <AnnouncementsPage
              isManagement={auth.profile.is_management}
              userId={auth.profile.id}
              onAnnouncementsLoaded={handleAnnouncementsLoaded}
              onTabOpened={handleTabOpened}
            />
          )}
          {tab === 'management' && (
            <ManagementPage userId={auth.profile.id} canEdit={auth.profile.is_management} />
          )}
          {tab === 'admin' && (
            <AdminModePage userId={auth.profile.id} />
          )}
          {tab === 'dashboard' && auth.profile.is_management && (
            <PlayerStatsDashboard />
          )}
          {tab === 'response-log' && auth.profile.is_management && (
            <ResponseLogPage />
          )}
          {/* League board stays mounted after first visit to preserve state.
              Realtime + fetches pause while hidden (active=false) so background
              tabs don't burn Disk IO budget; cache still renders on return. */}
          {visitedTabs.has('league') && (
            <div className={tab === 'league' ? '' : 'hidden'}>
              <LeagueBoardPage
                userId={auth.profile.id}
                isManagement={auth.profile.is_management}
                parties={partySummaries}
                active={tab === 'league'}
                onUpdatePartyIcon={async (partyId, icon) => {
                  await warSetup.updatePartyIcon(partyId, icon);
                }}
              />
            </div>
          )}
          {/* Calendar stays mounted after first visit to preserve scroll position */}
          {visitedTabs.has('calendar') && (
            <div className={tab === 'calendar' ? '' : 'hidden'}>
              <GuildCalendarPage
                isManagement={auth.profile.is_management}
                userId={auth.profile.id}
                isDisabled={auth.profile.is_disabled === true}
                active={tab === 'calendar'}
              />
            </div>
          )}
          {tab === 'kpi' && (
            <KpiStatsPage
              currentUserId={auth.profile.id}
              isSuperManager={auth.profile.is_super_manager ?? false}
              isManager={auth.profile.is_management ?? false}
              isDisabled={auth.profile.is_disabled === true}
            />
          )}
          </Suspense>
        </main>

        {/* Floating training notification */}
        {trainingNotif && !trainingNotifDismissed && (
          <FloatingNotification
            event={trainingNotif.event}
            onDismiss={dismissTrainingNotif}
            onClick={() => {
              dismissTrainingNotif();
              openTab('calendar');
            }}
          />
        )}
      </div>

      {/* My Profile modal — always editable (own profile) */}
      {myProfileOpen && (
        <Suspense fallback={null}>
          <ProfilePage
            userId={auth.profile.id}
            currentUserId={auth.profile.id}
            isManagement={auth.profile.is_management}
            readOnly={false}
            onClose={() => setMyProfileOpen(false)}
          />
        </Suspense>
      )}
    </ClassCatalogProvider>
  );
}

export default function App() {
  if (supabaseConfigError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-slate-900 border border-red-700/60 rounded-2xl p-6">
          <h1 className="text-xl font-bold text-red-300 mb-2">Configuration Error</h1>
          <p className="text-slate-300 text-sm mb-3">The app cannot connect to Supabase.</p>
          <p className="text-slate-400 text-sm mb-3">{supabaseConfigError}</p>
          <p className="text-slate-500 text-xs">If you are on GitHub Pages, redeploy with environment variables configured for this target.</p>
        </div>
      </div>
    );
  }

  return <AppContent />;
}
