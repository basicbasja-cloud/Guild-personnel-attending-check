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
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // Use implicit flow so OAuth tokens are returned in the URL hash
      // fragment (#access_token=…) and processed entirely client-side,
      // instead of requiring an async PKCE code-exchange network round-trip.
      // The PKCE exchange hangs on desktop browsers on slow / VPN / corporate
      // networks, causing the loading screen to get stuck on PC while mobile
      // (which completes redirects more cleanly) is unaffected.
      //
      // Security note: this is a static SPA deployed on GitHub Pages — there
      // is no backend available to perform a server-side token exchange.
      // Hash fragments are never sent to servers (no referer leakage), and
      // the Supabase JS client removes the hash from the URL immediately
      // after reading the token, so the exposure window is negligible.
      flowType: 'implicit',
    },
  }
);
