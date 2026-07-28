import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function AccessKeyGatePage() {
  const [keyCode, setKeyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = keyCode.trim();
    if (trimmed.length !== 6) {
      setError('Please enter a 6-digit key.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify the key
      const { data: isValid, error: verifyError } = await supabase
        .rpc('verify_access_key', { key_code: trimmed });

      if (verifyError) throw verifyError;

      if (!isValid) {
        setError('Invalid or expired key. Contact your guild officer for a new one.');
        setLoading(false);
        return;
      }

      // 2. Grant access to this user
      const { error: grantError } = await supabase
        .rpc('grant_user_access');

      if (grantError) throw grantError;

      // 3. Update local profile cache
      try {
        const cacheKey = 'gwm_profile_cache_v1';
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          cached.access_granted = true;
          localStorage.setItem(cacheKey, JSON.stringify(cached));
        }
      } catch { /* ignore cache errors */ }

      // 4. Reload to pick up the updated profile from cache
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-900/50">
            <span className="text-4xl">⚔️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Guild War Manager</h1>
          <p className="text-slate-400">Authentication required</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8 shadow-xl">
          <h2 className="text-white font-semibold text-lg mb-2">Enter Access Key</h2>
          <p className="text-slate-400 text-sm mb-6">
            This guild uses a key system for security. Please enter the 6-digit key
            provided by your guild officer to continue.
          </p>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="access-key" className="block text-sm font-medium text-slate-300 mb-2">
              Access Key
            </label>
            <input
              id="access-key"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={keyCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setKeyCode(val);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="000000"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              disabled={loading}
              autoFocus
            />
            {/* Visual dots indicator */}
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    i < keyCode.length ? 'bg-indigo-500' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || keyCode.length !== 6}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying…
              </>
            ) : (
              'Unlock Access'
            )}
          </button>

          <p className="text-slate-500 text-xs text-center mt-4">
            Don't have a key? Contact your guild officer on Discord.
          </p>
        </div>
      </div>
    </div>
  );
}
