import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/layout/Header';
import { AttendancePage } from './components/attendance/AttendancePage';
import { ManagementPage } from './components/management/ManagementPage';
import { RosterPage } from './components/management/RosterPage';
import { AdminModePage } from './components/management/AdminModePage';
import { PlayerStatsDashboard } from './components/management/PlayerStatsDashboard';
import { LeagueBoardPage } from './components/league/LeagueBoardPage';
import type { PartySummaryWithMembers } from './components/league/LeagueBoardPage';
import { GuildCalendarPage } from './components/calendar/GuildCalendarPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { KpiStatsPage } from './components/kpi/KpiStatsPage';
import { AnnouncementsPage } from './components/announcements/AnnouncementsPage';
import { MemberOfTheWeekBanner } from './components/motw/MemberOfTheWeekBanner';
import { Badge } from './components/ui/Badge';
import { preloadKpiBoard } from './hooks/useKpiBoard';
import { preloadLeagueBoard } from './hooks/useLeagueBoard';
import { preloadKpiProfile } from './hooks/useKpiProfile';
import { preloadProfiles } from './hooks/useAllProfiles';
import { preloadAttendance } from './hooks/useAttendance';
import { preloadWarSetup, useWarSetup } from './hooks/useWarSetup';
import { preloadGuildEvents } from './hooks/useGuildEvents';
import { ClassCatalogProvider } from './contexts/ClassCatalogContext';
import { supabaseConfigError } from './lib/supabase';

type Tab = 'attendance' | 'management' | 'roster' | 'admin' | 'dashboard' | 'league' | 'calendar' | 'kpi' | 'announcements';

function AppContent() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('attendance');
  const isGoogleLoginEnabled = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';
  const warSetup = useWarSetup();
  const [myProfileOpen, setMyProfileOpen] = useState(false);

  // ── Notification badges ────────────────────────────────────────────
  const [announcementIds, setAnnouncementIds] = useState<string[]>([]);
  const badgeUnread = useMemo(() => {
    if (announcementIds.length === 0) return 0;
    const lastRead = (() => { try { return localStorage.getItem('gwm_last_read_announcement'); } catch { return null; } })();
    if (!lastRead) return announcementIds.length;
    const idx = announcementIds.indexOf(lastRead);
    return idx > 0 ? idx : 0;
  }, [announcementIds]);

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

  // Preload all data into cache as soon as the user is authenticated
  // so every tab opens instantly with zero loading spinners.
  useEffect(() => {
    if (auth.user?.id) {
      preloadProfiles().catch(() => {});
      preloadAttendance().catch(() => {});
      preloadWarSetup().catch(() => {});
      preloadGuildEvents().catch(() => {});
      preloadKpiBoard().catch(() => {});
      preloadLeagueBoard().catch(() => {});
      preloadKpiProfile(auth.user.id).catch(() => {});
    }
  }, [auth.user?.id]);

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

  const tabs: { id: Tab; label: string; emoji: string; mgmtOnly?: boolean }[] = [
    { id: 'attendance', label: 'Attendance', emoji: '📋' },
    { id: 'roster', label: 'Roster', emoji: '👥' },
    { id: 'announcements', label: 'Announcements', emoji: '📢' },
    { id: 'management', label: 'War Setup', emoji: '⚔️', mgmtOnly: true },
    { id: 'dashboard', label: 'Dashboard', emoji: '📊', mgmtOnly: true },
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
        <div className="bg-slate-900 border-b border-slate-700 px-3 sm:px-4 overflow-x-auto">
          <div className="flex gap-1 max-w-screen-2xl mx-auto w-max min-w-full">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  if (t.id === 'announcements') {
                    try { localStorage.setItem('gwm_last_read_announcement', announcementIds[0] ?? ''); } catch {}
                  }
                }}
                className={`shrink-0 flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${
                    tab === t.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
              >
                <span>{t.emoji}</span>
                <span className="flex items-center gap-1.5">
                  {t.label}
                  {t.id === 'announcements' && <Badge count={badgeUnread} />}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {tab === 'attendance' && (
            <AttendancePage profile={auth.profile} onUpdateProfile={auth.updateProfile} />
          )}
          {tab === 'roster' && <RosterPage userId={auth.profile.id} isManagement={auth.profile.is_management} />}
          {tab === 'announcements' && (
            <AnnouncementsPage
              isManagement={auth.profile.is_management}
              userId={auth.profile.id}
              onAnnouncementsLoaded={(ids) => setAnnouncementIds(ids)}
              onTabOpened={() => {
                try { localStorage.setItem('gwm_last_read_announcement', announcementIds[0] ?? ''); } catch {}
              }}
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
          {/* League board stays mounted to preserve state across tab switches */}
          <div className={tab === 'league' ? '' : 'hidden'}>
            <LeagueBoardPage
              userId={auth.profile.id}
              isManagement={auth.profile.is_management}
              parties={partySummaries}
              onUpdatePartyIcon={async (partyId, icon) => {
                await warSetup.updatePartyIcon(partyId, icon);
              }}
            />
          </div>
          {/* Calendar stays mounted to preserve scroll position */}
          <div className={tab === 'calendar' ? '' : 'hidden'}>
            <GuildCalendarPage isManagement={auth.profile.is_management} userId={auth.profile.id} />
          </div>
          {tab === 'kpi' && (
            <KpiStatsPage
              currentUserId={auth.profile.id}
              isSuperManager={auth.profile.is_super_manager ?? false}
              isManager={auth.profile.is_management ?? false}
            />
          )}
        </main>
      </div>

      {/* My Profile modal — always editable (own profile) */}
      {myProfileOpen && (
        <ProfilePage
          userId={auth.profile.id}
          currentUserId={auth.profile.id}
          isManagement={auth.profile.is_management}
          readOnly={false}
          onClose={() => setMyProfileOpen(false)}
        />
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
