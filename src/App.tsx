import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/layout/Header';
import { AttendancePage } from './components/attendance/AttendancePage';
import { ManagementPage } from './components/management/ManagementPage';
import { AttendanceList } from './components/management/AttendanceList';
import { AdminModePage } from './components/management/AdminModePage';
import { useAttendance } from './hooks/useAttendance';
import { ClassCatalogProvider } from './contexts/ClassCatalogContext';

type Tab = 'attendance' | 'management' | 'roster' | 'admin';

function AppContent() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('attendance');
  const isTestGoogleLoginEnabled = import.meta.env.VITE_ENABLE_TEST_GOOGLE_LOGIN === 'true';

  const { weekAttendances, weekStartStr } = useAttendance(
    auth.profile?.is_management ? null : null
  );

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!auth.user || !auth.profile) {
    return (
      <LoginPage
        onLogin={auth.signInWithDiscord}
        onGoogleLogin={auth.signInWithGoogle}
        showGoogleLogin={isTestGoogleLoginEnabled}
        error={auth.error}
        loading={auth.loading}
      />
    );
  }

  const tabs: { id: Tab; label: string; emoji: string; mgmtOnly?: boolean }[] = [
    { id: 'attendance', label: 'Attendance', emoji: '📋' },
    { id: 'roster', label: 'Roster', emoji: '👥', mgmtOnly: true },
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
          {tab === 'roster' && auth.profile.is_management && (
            <div className="max-w-2xl mx-auto p-4 pt-6">
              <AttendanceList attendances={weekAttendances} weekStartStr={weekStartStr} />
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
  return <AppContent />;
}
