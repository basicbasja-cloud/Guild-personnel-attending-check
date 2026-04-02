import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are not set. ' +
      'Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://zpxyunxpakuetqfxcuhe.supabase.co',
  supabaseAnonKey || 'sb_publishable_62RRtXPMzeT2LtQ4pVJbVg_GAxW-EVY'
);