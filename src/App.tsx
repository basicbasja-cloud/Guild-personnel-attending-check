import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/layout/Header';
import { AttendancePage } from './components/attendance/AttendancePage';
import { ManagementPage } from './components/management/ManagementPage';
import { AttendanceList } from './components/management/AttendanceList';
import { AdminModePage } from './components/management/AdminModePage';
import { useAttendance } from './hooks/useAttendance';
import { useAllProfiles } from './hooks/useAllProfiles';
import { ClassCatalogProvider } from './contexts/ClassCatalogContext';
import { supabaseConfigError } from './lib/supabase';

type Tab = 'attendance' | 'management' | 'roster' | 'admin';

function AppContent() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('attendance');
  const isGoogleLoginEnabled = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';
  const isRosterActive = tab === 'roster';
  const shouldLoadRosterAttendance = isRosterActive;

  const { weekAttendances, weekStartStr } = useAttendance(
    null,
    undefined,
    shouldLoadRosterAttendance
  );

  const { profiles: allProfiles, loading: profilesLoading } = useAllProfiles(shouldLoadRosterAttendance);

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
    { id: 'management', label: 'War Setup', emoji: '⚔️', mgmtOnly: true },
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
        <Header profile={auth.profile} onSignOut={auth.signOut} />

        {/* Tab navigation */}
        <div className="bg-slate-900 border-b border-slate-700 px-3 sm:px-4 overflow-x-auto">
          <div className="flex gap-1 max-w-screen-2xl mx-auto w-max min-w-full">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${
                    tab === t.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {tab === 'attendance' && (
            <AttendancePage profile={auth.profile} onUpdateProfile={auth.updateProfile} />
          )}
          {tab === 'roster' && (
            <div className="max-w-2xl mx-auto p-4 pt-6">
              <AttendanceList attendances={weekAttendances} weekStartStr={weekStartStr} allProfiles={allProfiles} profilesLoading={profilesLoading} />
            </div>
          )}
          {tab === 'management' && (
            <ManagementPage userId={auth.profile.id} canEdit={auth.profile.is_management} />
          )}
          {tab === 'admin' && (
            <AdminModePage userId={auth.profile.id} />
          )}
        </main>
      </div>
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
