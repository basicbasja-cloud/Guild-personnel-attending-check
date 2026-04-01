import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data as Profile;
  }, []);

  const upsertProfile = useCallback(async (user: User) => {
    const discordId = user.user_metadata?.provider_id as string | undefined;
    const username =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email ||
      'Unknown';
    const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          discord_id: discordId ?? '',
          username,
          avatar_url: avatarUrl ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting profile:', error);
      return null;
    }
    return data as Profile;
  }, []);

  // Safety timeout: if onAuthStateChange never fires (e.g. token refresh
  // hangs on a slow or restricted network), force loading to false after
  // AUTH_TIMEOUT_MS so the user sees the login page instead of a stuck spinner.
  const AUTH_TIMEOUT_MS = 8000;

  useEffect(() => {
    let mounted = true;

    const timeoutId = setTimeout(() => {
      if (mounted) {
        setState((s) => (s.loading ? { ...s, loading: false } : s));
      }
    }, AUTH_TIMEOUT_MS);

    // onAuthStateChange fires INITIAL_SESSION immediately on mount with the
    // cached session, so we no longer need a separate getSession() call.
    // Removing the duplicate avoids fetching the profile twice on page load,
    // which was the primary cause of the slow initial render.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      try {
        if (session?.user) {
          const profile =
            (await fetchProfile(session.user.id)) ||
            (await upsertProfile(session.user));
          if (mounted) {
            setState({ user: session.user, session, profile, loading: false, error: null });
          }
        } else {
          if (mounted) {
            setState({ user: null, session: null, profile: null, loading: false, error: null });
          }
        }
      } catch (err) {
        // If profile fetch/upsert throws (e.g. network error), ensure loading
        // is always cleared so users are never permanently stuck on the spinner.
        if (mounted) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'Unexpected error during sign-in',
          }));
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile, upsertProfile]);

  const signInWithDiscord = async () => {
    setState((s) => ({ ...s, error: null }));
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo },
    });
    if (error) setState((s) => ({ ...s, error: error.message }));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: Partial<Pick<Profile, 'character_name' | 'character_class'>>) => {
    if (!state.user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', state.user.id)
      .select()
      .single();
    if (!error && data) {
      setState((s) => ({ ...s, profile: data as Profile }));
    }
    return error;
  };

  const setAdminPin = async (pin: string): Promise<string | null> => {
    const { error } = await supabase.rpc('set_admin_pin', { pin });
    return error ? error.message : null;
  };

  const verifyAdminPin = async (pin: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('verify_admin_pin', { pin });
    if (error) return false;
    return data === true;
  };

  return { ...state, signInWithDiscord, signOut, updateProfile, setAdminPin, verifyAdminPin };
}
