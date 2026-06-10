import { useState, useRef, useEffect } from 'react';
import type { Profile } from '../../types';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  profile: Profile | null;
  onSignOut: () => void;
  onLogoColorChange?: (color: string) => void;
  /** When provided the avatar/name area becomes a clickable button to open the user's own profile */
  onProfileClick?: () => void;
}

function ConnectionBadge() {
  const { status, isLive, pendingCount } = useSyncStatus();

  if (status === 'offline') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-900/60 text-red-400 text-xs font-medium select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        OFFLINE
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 text-xs font-medium select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse" />
        ERROR
      </span>
    );
  }

  if (status === 'syncing' || pendingCount > 0) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 text-xs font-medium select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        {pendingCount > 0 ? `SYNCING ${pendingCount}` : 'SYNCING'}
      </span>
    );
  }

  if (isLive) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400 text-xs font-medium select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        LIVE
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 text-xs font-medium select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      ONLINE
    </span>
  );
}

export function Header({ profile, onSignOut, onLogoColorChange, onProfileClick }: HeaderProps) {
  // ── Theme toggle ────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('gwm_theme', theme); } catch { /* noop */ }
  };

  const LOGO_COLORS = [
    { name: 'Indigo',   hex: '#4f46e5' },
    { name: 'Violet',   hex: '#7c3aed' },
    { name: 'Cyan',     hex: '#0891b2' },
    { name: 'Rose',     hex: '#e11d48' },
    { name: 'Amber',    hex: '#d97706' },
    { name: 'Emerald',  hex: '#059669' },
  ];

  const savedColor = profile?.logo_color ?? localStorage.getItem('gwm_logo_color') ?? '#4f46e5';
  const [logoColor, setLogoColor] = useState<string>(savedColor);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync color when profile loads (e.g. on first render after auth)
  useEffect(() => {
    if (profile?.logo_color) {
      setLogoColor(profile.logo_color);
    }
  }, [profile?.logo_color]);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const handleColorSelect = async (hex: string) => {
    setLogoColor(hex);
    localStorage.setItem('gwm_logo_color', hex); // fallback cache
    setShowPicker(false);
    onLogoColorChange?.(hex);
    // Save to DB so it persists across devices
    if (profile?.id) {
      await supabase.from('profiles').update({ logo_color: hex }).eq('id', profile.id);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div ref={pickerRef} className="relative">
          <button
            onClick={() => setShowPicker((p) => !p)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm hover:opacity-80 transition-opacity"
            style={{ backgroundColor: logoColor }}
            title="Change logo color"
          >
            ⚔
          </button>
          {showPicker && (
            <div className="absolute top-10 left-0 z-50 bg-slate-800 border border-slate-600 rounded-xl p-2 flex gap-1.5 shadow-2xl">
              {LOGO_COLORS.map(({ name, hex }) => (
                <button
                  key={name}
                  onClick={() => handleColorSelect(hex)}
                  className="w-6 h-6 rounded-full hover:scale-125 transition-transform ring-offset-slate-800"
                  style={{ backgroundColor: hex, outline: logoColor === hex ? `2px solid white` : 'none', outlineOffset: '2px' }}
                  title={name}
                />
              ))}
            </div>
          )}
        </div>
        <h1 className="text-white font-bold text-lg hidden sm:block">Guild War Manager</h1>
      </div>

      {profile && (
        <div className="flex items-center gap-3">
          <ConnectionBadge />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <button
            onClick={onProfileClick}
            disabled={!onProfileClick}
            className={`flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors
              ${onProfileClick ? 'hover:bg-slate-700 cursor-pointer' : 'cursor-default'}`}
            title={onProfileClick ? 'My Profile' : undefined}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-8 h-8 rounded-full border-2 border-indigo-500"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-white text-sm font-medium leading-tight">{profile.username}</p>
              {profile.character_name && (
                <p className="text-slate-400 text-xs leading-tight">
                  {profile.character_name}
                  {profile.character_class ? ` · ${profile.character_class}` : ''}
                </p>
              )}
            </div>
          </button>
          {profile.is_management ? (
            <span className="bg-indigo-700 text-indigo-100 text-xs px-2 py-0.5 rounded-full font-medium">
              GM
            </span>
          ) : null}
          <button
            onClick={onSignOut}
            className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
