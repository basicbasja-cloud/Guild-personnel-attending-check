import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import type { Profile } from '../types';

// Hoist getSession() to module level so it runs ONCE at import time, before
// React mounts. React StrictMode double-mounts useEffect twice; if getSession()
// were called inside useEffect, the second mount would wait 5000ms for the
// IndexedDB auth lock held by the first call → visible F5 stall.
// Both mounts now await the same already-resolved promise — zero lock contention.
// Exported so main.tsx can chain pre-fetches off it without calling getSession() again.
export const sessionPromise = supabase.auth.getSession();

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

function getAuthCallbackError() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  for (const params of [searchParams, hashParams]) {
    const error = params.get('error');
    const description = params.get('error_description');

    if (error || description) {
      return description ?? error ?? 'Authentication failed.';
    }
  }

  if (searchParams.get('code')) {
    return 'OAuth returned successfully, but no Supabase session was created. Check Supabase Auth signup settings, provider credentials, and callback configuration.';
  }

  return null;
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 10000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out.')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

const AUTH_INIT_TIMEOUT_MS = 12000;
const PROFILE_REQUEST_TIMEOUT_MS = 7000;
const PROFILE_CACHE_KEY = 'gwm_profile_cache_v1';

function getSupabaseAuthStorageKey() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;

  try {
    const projectRef = new URL(url).hostname.split('.')[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
}

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed || parsed.id !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: Profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors (private mode/quota) and continue.
  }
}

function buildFallbackProfile(user: User): Profile {
  const username =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    'Unknown';
  const nowIso = new Date().toISOString();

  return {
    id: user.id,
    discord_id: (user.user_metadata?.provider_id as string | undefined) ?? '',
    username,
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    character_name: null,
    character_class: null,
    is_management: false,
    is_admin: false,
    created_at: nowIso,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ProfileFetchResult {
  profile: Profile | null;
  shouldUpsert: boolean;
}

function readBootstrapAuthSnapshot(): { user: User; session: Session } | null {
  if (typeof window === 'undefined') return null;

  const storageKey = getSupabaseAuthStorageKey();
  if (!storageKey) return null;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const maybeSession = (
      (parsed as { currentSession?: unknown }).currentSession ??
      (parsed as { session?: unknown }).session ??
      parsed
    ) as Partial<Session> | null;

    if (!maybeSession || typeof maybeSession !== 'object' || !('access_token' in maybeSession)) {
      return null;
    }

    let user = maybeSession.user as User | undefined;

    if (!user) {
      const rawUser = localStorage.getItem(`${storageKey}-user`);
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser) as { user?: User } | User;
        user = (parsedUser as { user?: User }).user ?? (parsedUser as User);
      }
    }

    if (!user || !user.id) return null;

    return {
      user,
      session: maybeSession as Session,
    };
  } catch {
    return null;
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    // Fast path: full Supabase session found in localStorage.
    const bootstrapAuth = readBootstrapAuthSnapshot();
    if (bootstrapAuth) {
      const cachedProfile = readCachedProfile(bootstrapAuth.user.id);
      return {
        user: bootstrapAuth.user,
        session: bootstrapAuth.session,
        profile: cachedProfile ?? buildFallbackProfile(bootstrapAuth.user),
        loading: false,
        error: null,
      };
    }

    // Fallback: bootstrap snapshot failed (expired access token that needs a
    // network refresh, SDK storage key change, private-mode quirk, etc.).
    // If a cached profile exists, show the app immediately with no loading
    // screen. initAuth() will validate/replace the session asynchronously
    // and redirect to login only if the session is truly gone.
    try {
      const raw = localStorage.getItem(PROFILE_CACHE_KEY);
      if (raw) {
        const cachedProfile = JSON.parse(raw) as Profile;
        if (cachedProfile?.id) {
          const syntheticUser = { id: cachedProfile.id } as User;
          return {
            user: syntheticUser,
            session: null,
            profile: cachedProfile,
            loading: false,
            error: null,
          };
        }
      }
    } catch { /* ignore storage errors */ }

    return { user: null, session: null, profile: null, loading: true, error: null };
  });

  const fetchProfile = useCallback(async (userId: string): Promise<ProfileFetchResult> => {
    try {
      const result = await withTimeout(
        withDbTiming('GET', `profiles.fetch user=${userId}`, () =>
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
            .then((r) => r as { data: Profile | null; error: { message: string; code?: string } | null })
        ),
        PROFILE_REQUEST_TIMEOUT_MS
      );

      if (!result.error && result.data) {
        return { profile: result.data as Profile, shouldUpsert: false };
      }

      // If there is no row yet, create one via upsert.
      if (!result.error && !result.data) {
        return { profile: null, shouldUpsert: true };
      }

      return { profile: null, shouldUpsert: false };
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('Request timed out'))) {
        console.warn('Profile fetch failed; continuing with cached/fallback profile.');
      }
      return { profile: null, shouldUpsert: false };
    }
  }, []);

  const upsertProfile = useCallback(async (user: User) => {
    const discordId = user.user_metadata?.provider_id as string | undefined;
    const username =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email ||
      'Unknown';
    const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

    try {
      const result = await withTimeout(
        withDbTiming('PUT', `profiles.upsert user=${user.id}`, () =>
          supabase
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
            .single()
            .then((r) => r as { data: Profile | null; error: { message: string } | null })
        ),
        PROFILE_REQUEST_TIMEOUT_MS
      );

      if (result.error) {
        console.error('Error upserting profile:', result.error);
        return null;
      }
      if (result.data) {
        writeCachedProfile(result.data as Profile);
      }
      return result.data as Profile;
    } catch (error) {
      console.error('Error upserting profile:', error);
      return null;
    }
  }, []);

  const loadProfileForSessionUser = useCallback(async (user: User) => {
    const fetched = await fetchProfile(user.id);
    if (fetched.profile) return fetched.profile;

    if (fetched.shouldUpsert) {
      return upsertProfile(user);
    }

    return null;
  }, [fetchProfile, upsertProfile]);

  const loadProfileForSessionUserWithRetry = useCallback(async (user: User, attempts = 2) => {
    const retryDelaysMs = [500];

    for (let i = 0; i < attempts; i += 1) {
      const profile = await loadProfileForSessionUser(user);
      if (profile) return profile;

      const isLastAttempt = i === attempts - 1;
      if (!isLastAttempt) {
        await sleep(retryDelaysMs[i] ?? 1500);
      }
    }

    return null;
  }, [loadProfileForSessionUser]);

  useEffect(() => {
    let mounted = true;
    const loadingWatchdog = setTimeout(() => {
      if (!mounted) return;
      setState((s) => {
        if (!s.loading) return s;
        return {
          ...s,
          loading: false,
          error: 'Authentication restore is slow on this browser. Please sign in again if needed.',
        };
      });
    }, AUTH_INIT_TIMEOUT_MS + 1000);

    const initAuth = async () => {
      try {
        const sessionResult = await sessionPromise;
        const {
          data: { session },
        } = sessionResult;
        const callbackError = getAuthCallbackError();

        if (!mounted) return;

        if (session?.user) {
          const cachedProfile = readCachedProfile(session.user.id);
          if (cachedProfile) {
            setState({ user: session.user, session, profile: cachedProfile, loading: false, error: null });
            void (async () => {
              const freshProfile = await loadProfileForSessionUserWithRetry(session.user);
              if (!mounted) return;
              if (!freshProfile) {
                setState((s) => ({
                  ...s,
                  error: 'Profile sync is delayed. You can continue, and it will retry automatically.',
                }));
                return;
              }
              writeCachedProfile(freshProfile);
              setState((s) => ({ ...s, user: session.user, session, profile: freshProfile, loading: false, error: null }));
            })();
            return;
          }

          const fallbackProfile = buildFallbackProfile(session.user);
          setState({ user: session.user, session, profile: fallbackProfile, loading: false, error: null });

          void (async () => {
            const profile = await loadProfileForSessionUserWithRetry(session.user);
            if (!mounted) return;
            if (!profile) {
              setState((s) => ({
                ...s,
                error: 'Profile sync is delayed. You can continue, and it will retry automatically.',
              }));
              return;
            }
            writeCachedProfile(profile);
            setState((s) => ({ ...s, user: session.user, session, profile, loading: false, error: null }));
          })();
        } else {
          // No valid session — clear any synthetic user/profile that was
          // pre-loaded from the profile cache, then show the login screen.
          setState({ user: null, session: null, profile: null, loading: false, error: callbackError });
        }
      } catch (error) {
        if (!mounted) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize authentication.',
        }));
      }
    };

    initAuth();

    const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (!mounted) return;

        // INITIAL_SESSION is handled by initAuth() above — skip to avoid
        // firing a duplicate profile fetch at startup.
        // TOKEN_REFRESHED only changes the access token — no need to re-fetch
        // the profile, just update the session in state.
        if (event === 'INITIAL_SESSION') return;

        if (session?.user) {
          if (event === 'TOKEN_REFRESHED') {
            setState((s) => s.profile ? { ...s, session } : s);
            return;
          }

          const cachedProfile = readCachedProfile(session.user.id);
          if (cachedProfile) {
            setState({ user: session.user, session, profile: cachedProfile, loading: false, error: null });
          } else {
            setState({ user: session.user, session, profile: buildFallbackProfile(session.user), loading: false, error: null });
          }

          const profile = await loadProfileForSessionUserWithRetry(session.user);
          if (!mounted) return;
          if (!profile) {
            setState((s) => ({
              ...s,
              error: 'Profile sync is delayed. You can continue, and it will retry automatically.',
            }));
            return;
          }
          writeCachedProfile(profile);
          setState({ user: session.user, session, profile, loading: false, error: null });
        } else {
          setState({ user: null, session: null, profile: null, loading: false, error: null });
        }
      } catch (error) {
        if (!mounted) return;
        setState({
          user: null,
          session: null,
          profile: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Authentication state change failed.',
        });
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingWatchdog);
      subscription.unsubscribe();
    };
  }, [fetchProfile, upsertProfile, loadProfileForSessionUser, loadProfileForSessionUserWithRetry]);

  const signInWithDiscord = async () => {
    setState((s) => ({ ...s, error: null }));
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo },
    });
    if (error) setState((s) => ({ ...s, error: error.message }));
  };

  const signInWithGoogle = async () => {
    setState((s) => ({ ...s, error: null }));

    // Keep Google auth disabled unless explicitly turned on for test usage.
    if (import.meta.env.VITE_ENABLE_TEST_GOOGLE_LOGIN !== 'true') {
      setState((s) => ({ ...s, error: 'Google login is disabled outside test environment.' }));
      return;
    }

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (error) setState((s) => ({ ...s, error: error.message }));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(PROFILE_CACHE_KEY);
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
      writeCachedProfile(data as Profile);
      setState((s) => ({ ...s, profile: data as Profile }));
    }
    return error;
  };

  return { ...state, signInWithDiscord, signInWithGoogle, signOut, updateProfile };
}
