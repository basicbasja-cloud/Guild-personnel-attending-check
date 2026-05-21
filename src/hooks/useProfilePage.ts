import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, ProfileSkill } from '../types';

const CACHE_PREFIX = 'gwm_profile_v1_';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface ProfilePageCache {
  at: number;
  profile: Profile;
  skills: ProfileSkill[];
}

function readCache(userId: string): ProfilePageCache | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as ProfilePageCache;
  } catch {
    return null;
  }
}

function writeCache(userId: string, profile: Profile, skills: ProfileSkill[]) {
  try {
    const entry: ProfilePageCache = { at: Date.now(), profile, skills };
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

export function evictProfilePageCache(userId: string) {
  try { localStorage.removeItem(CACHE_PREFIX + userId); } catch { /**/ }
}

export interface UseProfilePageReturn {
  profile: Profile | null;
  skills: ProfileSkill[];
  loading: boolean;
  error: string | null;
  addSkill: (type: ProfileSkill['skill_type'], name: string, level: number | null) => Promise<void>;
  updateSkill: (id: string, name: string, level: number | null) => Promise<void>;
  removeSkill: (id: string) => Promise<void>;
  updateNotes: (notes: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'character_name' | 'character_class' | 'main_skill_name' | 'main_skill_level' | 'sub_skill_name' | 'sub_skill_level'>>) => Promise<void>;
}

export function useProfilePage(userId: string | null): UseProfilePageReturn {
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (!userId) return null;
    return readCache(userId)?.profile ?? null;
  });
  const [skills, setSkills] = useState<ProfileSkill[]>(() => {
    if (!userId) return [];
    return readCache(userId)?.skills ?? [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (uid: string) => {
    const cached = readCache(uid);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setProfile(cached.profile);
      setSkills(cached.skills);
      return;
    }
    setLoading(true);
    const [profileRes, skillsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('profile_skills').select('*').eq('user_id', uid).order('skill_type').order('sort_order'),
    ]);
    setLoading(false);
    if (profileRes.error) { setError(profileRes.error.message); return; }
    const p = profileRes.data as Profile;
    const s = (skillsRes.data ?? []) as ProfileSkill[];
    setProfile(p);
    setSkills(s);
    writeCache(uid, p, s);
  }, []);

  useEffect(() => {
    if (!userId) { setProfile(null); setSkills([]); return; }
    fetchData(userId);
  }, [userId, fetchData]);

  const addSkill = useCallback(async (type: ProfileSkill['skill_type'], name: string, level: number | null) => {
    if (!userId || !profile) return;
    const sortOrder = skills.filter((s) => s.skill_type === type).length;
    const tempId = `tmp_${Date.now()}`;
    const optimistic: ProfileSkill = {
      id: tempId, user_id: userId, skill_type: type,
      skill_name: name, skill_level: level, sort_order: sortOrder,
      created_at: new Date().toISOString(),
    };
    setSkills((prev) => [...prev, optimistic]);

    const { data, error: err } = await supabase
      .from('profile_skills')
      .insert({ user_id: userId, skill_type: type, skill_name: name, skill_level: level, sort_order: sortOrder })
      .select().single();
    if (err) {
      setSkills((prev) => prev.filter((s) => s.id !== tempId));
      setError(err.message);
    } else {
      const saved = data as ProfileSkill;
      setSkills((prev) => {
        const next = prev.map((s) => s.id === tempId ? saved : s);
        writeCache(userId, profile, next);
        return next;
      });
    }
  }, [userId, profile, skills]);

  const updateSkill = useCallback(async (id: string, name: string, level: number | null) => {
    if (!userId || !profile) return;
    setSkills((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, skill_name: name, skill_level: level } : s);
      writeCache(userId, profile, next);
      return next;
    });
    await supabase.from('profile_skills').update({ skill_name: name, skill_level: level }).eq('id', id);
  }, [userId, profile]);

  const removeSkill = useCallback(async (id: string) => {
    if (!userId || !profile) return;
    setSkills((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeCache(userId, profile, next);
      return next;
    });
    await supabase.from('profile_skills').delete().eq('id', id);
  }, [userId, profile]);

  const updateNotes = useCallback(async (notes: string) => {
    if (!userId || !profile) return;
    const next = { ...profile, notes };
    setProfile(next);
    writeCache(userId, next, skills);
    await supabase.from('profiles').update({ notes, updated_at: new Date().toISOString() }).eq('id', userId);
  }, [userId, profile, skills]);

  const updateProfile = useCallback(async (patch: Partial<Pick<Profile,
    'character_name' | 'character_class' | 'main_skill_name' | 'main_skill_level' | 'sub_skill_name' | 'sub_skill_level'
  >>) => {
    if (!userId || !profile) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    writeCache(userId, next, skills);
    await supabase.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', userId);
  }, [userId, profile, skills]);

  return { profile, skills, loading, error, addSkill, updateSkill, removeSkill, updateNotes, updateProfile };
}
