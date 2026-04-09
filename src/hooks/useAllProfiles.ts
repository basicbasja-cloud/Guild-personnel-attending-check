import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { withDbTiming } from '../lib/dbTiming';
import type { Profile } from '../types';

export function useAllProfiles(enabled = true) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);

    withDbTiming('GET', 'profiles.all', () =>
      supabase
        .from('profiles')
        .select(
          'id,discord_id,username,avatar_url,character_name,character_class,is_management,is_admin,created_at'
        )
        .order('username')
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('useAllProfiles: failed to fetch profiles', error);
          setLoading(false);
          return;
        }
        setProfiles((data as Profile[] | null) ?? []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('useAllProfiles: failed to fetch profiles', error);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { profiles, loading };
}
