import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { useClassCatalog } from '../../contexts/ClassCatalogContext';

interface AdminModePageProps {
  userId: string;
}

type RoleOption = 'member' | 'management';

function getRole(profile: Profile): RoleOption {
  if (profile.is_management) return 'management';
  return 'member';
}

function toFriendlyAdminError(message: string | undefined) {
  if (!message) return 'Admin unlock failed. Please try again.';

  if (message.includes('Admin PIN is not configured')) {
    return 'Admin PIN is not configured in Supabase yet. Run the SQL setup for admin_runtime_config first.';
  }

  if (message.includes('Could not find the function') || message.includes('verify_admin_pin')) {
    return 'Admin RPC functions are missing in Supabase. Re-run supabase/schema.sql in the SQL Editor.';
  }

  if (message.includes('Not authenticated')) {
    return 'Please sign in again before using Admin Mode.';
  }

  return message;
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 10000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

export function AdminModePage({ userId }: AdminModePageProps) {
  const { classCatalog, refreshClassCatalog } = useClassCatalog();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [storedPin, setStoredPin] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassColor, setNewClassColor] = useState('#64748B');
  const [classSaving, setClassSaving] = useState(false);

  const hasPinLength = useMemo(() => /^\d{6}$/.test(pin), [pin]);

  const loadProfiles = useCallback(async () => {
    if (!isUnlocked) return;

    setAdminLoading(true);
    setAdminError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true });

    if (error) {
      setAdminError(error.message);
      setAdminLoading(false);
      return;
    }

    setProfiles((data as Profile[]) ?? []);
    setAdminLoading(false);
  }, [isUnlocked]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleUnlock = useCallback(async () => {
    if (!hasPinLength) {
      setPinError('PIN must be exactly 6 digits.');
      return;
    }

    setPinError(null);
    setUnlocking(true);
    let data: boolean | null = null;
    let errorMessage: string | undefined;

    try {
      const rpcPromise = supabase
        .rpc('verify_admin_pin', {
          provided_pin: pin,
        })
        .then((result) => result as { data: boolean | null; error: { message: string } | null });

      const result = await withTimeout(rpcPromise, 12000);
      data = result.data as boolean | null;
      errorMessage = result.error?.message;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Admin verification failed.';
    }

    if (errorMessage || !data) {
      setPinError(toFriendlyAdminError(errorMessage ?? 'Incorrect admin PIN.'));
      setPin('');
      setUnlocking(false);
      return;
    }

    setStoredPin(pin);
    setIsUnlocked(true);
    setPinError(null);
    setPin('');
    setUnlocking(false);
  }, [hasPinLength, pin]);

  useEffect(() => {
    if (pin.length === 6 && !unlocking) {
      handleUnlock();
    }
  }, [handleUnlock, pin, unlocking]);

  const handlePinChange = (value: string) => {
    const nextPin = value.replace(/\D/g, '').slice(0, 6);
    setPin(nextPin);
    if (pinError) {
      setPinError(null);
    }
  };

  const handleDeleteUser = async (targetProfile: Profile) => {
    setDeletingId(targetProfile.id);
    setAdminError(null);

    const { error } = await supabase.rpc('delete_user_with_pin', {
      target_user_id: targetProfile.id,
      provided_pin: storedPin,
    });

    if (error) {
      setAdminError(error.message);
      setDeletingId(null);
      setConfirmDeleteId(null);
      return;
    }

    setProfiles((prev) => prev.filter((p) => p.id !== targetProfile.id));
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const handleRoleChange = async (targetProfile: Profile, nextRole: RoleOption) => {
    setSavingRoleId(targetProfile.id);
    setAdminError(null);

    const { data, error } = await supabase.rpc('set_management_level_with_pin', {
      target_user_id: targetProfile.id,
      next_role: nextRole,
      provided_pin: storedPin,
    });

    if (error) {
      setAdminError(error.message);
      setSavingRoleId(null);
      return;
    }

    setProfiles((currentProfiles) =>
      currentProfiles.map((currentProfile) =>
        currentProfile.id === targetProfile.id
          ? { ...currentProfile, ...(data as Profile) }
          : currentProfile
      )
    );
    setSavingRoleId(null);
  };

  const handleAddClass = async () => {
    const className = newClassName.trim();
    const colorHex = newClassColor.trim();

    if (!className) {
      setAdminError('Class name is required.');
      return;
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
      setAdminError('Color must be a valid hex code like #1E3A8A.');
      return;
    }

    setClassSaving(true);
    setAdminError(null);

    const { error } = await supabase.rpc('add_class_with_pin', {
      class_name: className,
      color_hex: colorHex,
      provided_pin: storedPin,
    });

    if (error) {
      setAdminError(error.message);
      setClassSaving(false);
      return;
    }

    setNewClassName('');
    await refreshClassCatalog();
    setClassSaving(false);
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setStoredPin('');
    setPin('');
    setPinError(null);
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-2xl mx-auto p-4 pt-6">
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-white font-bold text-2xl mb-2">Admin Mode</h2>
            <p className="text-slate-400 text-sm">
              Enter the 6-digit PIN to unlock role management. Access continues automatically after the sixth digit.
            </p>
          </div>

          <label className="block mb-3 text-slate-300 text-sm font-medium">6-digit admin PIN</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(event) => handlePinChange(event.target.value)}
            maxLength={6}
            placeholder="Enter 6-digit PIN"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-3"
            aria-label="Admin PIN"
            autoFocus
          />

          <div
            className="grid grid-cols-6 gap-2 mb-4"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <label key={index} className="cursor-text">
                <span className="sr-only">PIN digit {index + 1}</span>
                <div className="h-14 rounded-xl border border-slate-600 bg-slate-800 flex items-center justify-center text-white text-xl font-bold tracking-widest">
                  {pin[index] ? '•' : ''}
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={() => {
              void handleUnlock();
            }}
            disabled={!hasPinLength || unlocking}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition-colors mb-4"
          >
            {unlocking ? 'Unlocking…' : 'Unlock Admin Mode'}
          </button>

          {unlocking && (
            <p className="text-slate-400 text-xs mb-3">Verifying admin PIN…</p>
          )}

          <p className="text-slate-500 text-xs mb-4">Type or paste digits. Validation runs automatically at 6 digits, and the PIN stays only in this tab session.</p>

          {pinError && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
              {pinError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-4 pt-6">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Admin Mode</h2>
            <p className="text-slate-400 text-sm">
              Manually assign member, management, or admin access.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => loadProfiles()}
              disabled={adminLoading}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              {adminLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={handleLock}
              className="bg-amber-700 hover:bg-amber-600 text-amber-100 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              Lock
            </button>
          </div>
        </div>

        {adminError && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm">
            {adminError}
          </div>
        )}

        <div className="space-y-2">
          {profiles.map((listedProfile) => (
            <div
              key={listedProfile.id}
              className="bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3 flex flex-col gap-3"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{listedProfile.username}</p>
                  <p className="text-slate-400 text-sm truncate">
                    {listedProfile.character_name || 'No character name set'}
                    {listedProfile.character_class ? ` · ${listedProfile.character_class}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {listedProfile.id === userId && (
                    <span className="text-xs text-amber-300 bg-amber-900/40 border border-amber-700 rounded-full px-2 py-1">
                      Current account
                    </span>
                  )}
                  <select
                    value={getRole(listedProfile)}
                    onChange={(event) => handleRoleChange(listedProfile, event.target.value as RoleOption)}
                    disabled={savingRoleId === listedProfile.id}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="member">Member</option>
                    <option value="management">Management</option>
                  </select>
                  {listedProfile.id !== userId && (
                    <button
                      onClick={() => setConfirmDeleteId(listedProfile.id)}
                      disabled={deletingId === listedProfile.id}
                      className="text-xs px-3 py-2 rounded-lg bg-red-900/40 border border-red-800 text-red-300 hover:bg-red-800/60 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Inline delete confirmation */}
              {confirmDeleteId === listedProfile.id && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg bg-red-950/60 border border-red-800">
                  <p className="text-red-300 text-sm flex-1">
                    Permanently delete <strong>{listedProfile.username}</strong>? This removes their account and all data.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteUser(listedProfile)}
                      disabled={deletingId === listedProfile.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50"
                    >
                      {deletingId === listedProfile.id ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 mb-6">
        <h3 className="text-white font-bold text-base mb-2">Class Catalog</h3>
        <p className="text-slate-400 text-sm mb-4">
          Add new classes for future updates and assign their color badges.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 mb-4">
          <input
            type="text"
            value={newClassName}
            onChange={(event) => setNewClassName(event.target.value)}
            placeholder="Class name (e.g. Shadowcaster)"
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <input
            type="color"
            value={newClassColor}
            onChange={(event) => setNewClassColor(event.target.value.toUpperCase())}
            className="h-10 w-full md:w-14 rounded-lg border border-slate-600 bg-slate-800 p-1"
            title="Class color"
          />
          <button
            onClick={handleAddClass}
            disabled={classSaving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
          >
            {classSaving ? 'Adding…' : 'Add class'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {classCatalog.map((item) => (
            <span
              key={item.name}
              className="text-xs font-medium text-white px-2 py-1 rounded-full"
              style={{ backgroundColor: item.color_hex }}
            >
              {item.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}