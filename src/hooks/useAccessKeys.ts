import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AccessKey {
  id: string;
  key_code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  notes: string | null;
}

export function useAccessKeys(adminPin: string | null) {
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('access_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setKeys(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load access keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const generateKey = async (): Promise<string | null> => {
    if (!adminPin) {
      setError('Admin PIN is required');
      return null;
    }
    setError(null);
    try {
      const { data, error: genError } = await supabase
        .rpc('generate_access_key', { admin_pin: adminPin });

      if (genError) throw genError;
      await fetchKeys();
      return data as string;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate key';
      setError(msg);
      return null;
    }
  };

  const deactivateKey = async (keyId: string): Promise<boolean> => {
    if (!adminPin) {
      setError('Admin PIN is required');
      return false;
    }
    setError(null);
    try {
      const { error: deactError } = await supabase
        .rpc('deactivate_access_key', { key_id: keyId, admin_pin: adminPin });

      if (deactError) throw deactError;
      await fetchKeys();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deactivate key';
      setError(msg);
      return false;
    }
  };

  const getKeyStatus = (key: AccessKey): { label: string; color: string } => {
    if (!key.is_active) return { label: 'Deactivated', color: 'text-red-400' };
    if (new Date(key.expires_at) < new Date()) return { label: 'Expired', color: 'text-amber-400' };
    return { label: 'Active', color: 'text-emerald-400' };
  };

  return {
    keys,
    loading,
    error,
    fetchKeys,
    generateKey,
    deactivateKey,
    getKeyStatus,
  };
}
