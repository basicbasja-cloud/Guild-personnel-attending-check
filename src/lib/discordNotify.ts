import { supabase } from './supabase';

// ── Discord notify helper ───────────────────────────────────────────────────
// Fire-and-forget posts to a Discord channel via the `notify-discord`
// Edge Function. Never throws — Discord failures must not break app flows.

export interface DiscordNotifyOptions {
  title?: string;
  description?: string;
  color?: number;
  mentionEveryone?: boolean;
  fields?: { name: string; value: string; inline?: boolean }[];
}

// Shared brand colors — keep in sync with the KPI tier colors
export const DiscordColors = {
  indigo: 0x6366f1,
  green: 0x22c55e,
  amber: 0xf59e0b,
  red: 0xef4444,
} as const;

export async function notifyDiscord(options: DiscordNotifyOptions): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-discord', {
      body: options,
    });
    if (error) {
      console.warn('[Discord] notify failed:', error.message);
    }
  } catch (e) {
    console.warn('[Discord] notify error:', e);
  }
}
