interface LoginPageProps {
  onLogin: () => void;
  error: string | null;
  loading: boolean;
}

function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\//i.test(userAgent);
}

export function LoginPage({ onLogin, error, loading }: LoginPageProps) {
  const showInAppBrowserWarning = isInAppBrowser();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-900/50">
            <span className="text-4xl">⚔️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Guild War Manager</h1>
          <p className="text-slate-400">Attendance check &amp; party organizer</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8 shadow-xl">
          <h2 className="text-white font-semibold text-lg mb-2">Sign in to continue</h2>
          <p className="text-slate-400 text-sm mb-6">
            Use your Discord account to join the guild roster and submit your attendance.
          </p>


          {showInAppBrowserWarning && (
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 mb-4 text-amber-200 text-sm">
              This browser is opened inside another app and may block Discord login from saving your session.
              Open this page in Safari or Chrome, then try again.
            </div>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={onLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.102 18.08.114 18.1.128 18.112a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            )}
            {loading ? 'Redirecting…' : 'Continue with Discord'}
          </button>

        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Guild War Manager · Only guild members can access this app
        </p>
      </div>
    </div>
  );
}
