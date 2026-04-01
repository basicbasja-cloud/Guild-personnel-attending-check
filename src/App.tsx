import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/layout/Header';
import { AttendancePage } from './components/attendance/AttendancePage';
import { ManagementPage } from './components/management/ManagementPage';
import { AttendanceList } from './components/management/AttendanceList';
import { AdminPinModal } from './components/management/AdminPinModal';
import { useAttendance } from './hooks/useAttendance';

type Tab = 'attendance' | 'management' | 'roster';

function AppContent() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('attendance');

  const { weekAttendances, weekStartStr } = useAttendance(
    auth.profile?.is_management ? null : null
  );

  const [showPinModal, setShowPinModal] = useState(false);

  // While we are still checking the auth state (e.g. fetching the profile
  // after an INITIAL_SESSION or SIGNED_IN event), show a neutral full-page
  // spinner.  This keeps the login page completely out of view until it is
  // actually needed, avoiding the confusing "Redirecting…" disabled-button
  // state that made PC users think the app was permanently stuck.
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!auth.user || !auth.profile) {
    return (
      <LoginPage
        onLogin={auth.signInWithDiscord}
        error={auth.error}
      />
    );
  }

  const tabs: { id: Tab; label: string; emoji: string; mgmtOnly?: boolean }[] = [
    { id: 'attendance', label: 'Attendance', emoji: '📋' },
    { id: 'roster', label: 'Roster', emoji: '👥', mgmtOnly: true },
    { id: 'management', label: 'War Setup', emoji: '⚔️', mgmtOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.mgmtOnly || auth.profile?.is_management);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header profile={auth.profile} onSignOut={auth.signOut} />

      {/* Tab navigation */}
      <div className="bg-slate-900 border-b border-slate-700 px-4">
        <div className="flex gap-1 max-w-screen-2xl mx-auto items-center">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
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

          {/* PIN management button – only visible to management users */}
          {auth.profile.is_management && (
            <button
              onClick={() => setShowPinModal(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-600"
              title="Set or change your admin PIN"
            >
              🔑 <span>Admin PIN</span>
            </button>
          )}
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
        {tab === 'management' && auth.profile.is_management && (
          <ManagementPage userId={auth.profile.id} />
        )}
      </main>

      {/* Admin PIN modal */}
      {showPinModal && auth.profile.is_management && (
        <AdminPinModal
          hasPinSet={auth.profile.admin_pin_hash != null}
          onSetPin={auth.setAdminPin}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
