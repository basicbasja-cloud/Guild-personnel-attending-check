// Follow this setup guide: https://supabase.com/docs/guides/functions/cron
// Deploy: supabase functions deploy attendance-reminder
// Set secrets: supabase secrets set DISCORD_WEBHOOK_URL=your_webhook_url

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AttendanceRow {
  user_id: string;
}

interface Profile {
  id: string;
  discord_id: string;
  username: string;
  character_name: string | null;
}

Deno.serve(async () => {
  if (!DISCORD_WEBHOOK_URL) {
    console.error('DISCORD_WEBHOOK_URL not configured');
    return new Response('Missing DISCORD_WEBHOOK_URL', { status: 500 });
  }

  // Get current ISO week start (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const weekStart = monday.toISOString().slice(0, 10);

  console.log(`Checking attendance for week starting ${weekStart}`);

  // 1. Fetch all profiles
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, discord_id, username, character_name');

  if (profileErr) {
    console.error('Failed to fetch profiles:', profileErr);
    return new Response('Error fetching profiles', { status: 500 });
  }

  // 2. Fetch attendance for this week
  const { data: attendance, error: attErr } = await supabase
    .from('attendance')
    .select('user_id')
    .eq('week_start', weekStart);

  if (attErr) {
    console.error('Failed to fetch attendance:', attErr);
    return new Response('Error fetching attendance', { status: 500 });
  }

  const respondedUserIds = new Set((attendance ?? []).map((a: AttendanceRow) => a.user_id));

  // 3. Find unresponsive members
  const unresponsive = (profiles ?? []).filter(
    (p: Profile) => !respondedUserIds.has(p.id) && p.discord_id
  );

  if (unresponsive.length === 0) {
    console.log('All members have responded. No reminders needed.');
    return new Response('All members responded', { status: 200 });
  }

  console.log(`${unresponsive.length} members have not responded yet`);

  // 4. Send Discord webhook
  const embed = {
    title: '📋 Attendance Reminder',
    description: `The following guild members haven't set their attendance for **week of ${weekStart}** yet:`,
    color: 0x6366f1, // Indigo
    fields: unresponsive.map((p: Profile) => ({
      name: p.character_name ?? p.username,
      value: p.discord_id ? `<@${p.discord_id}>` : p.username,
      inline: true,
    })),
    footer: {
      text: 'Guild War Manager • Please submit your attendance',
    },
    timestamp: new Date().toISOString(),
  };

  const discordPayload = {
    content: '@everyone Attendance reminder!',
    embeds: [embed],
  };

  const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordPayload),
  });

  if (!discordRes.ok) {
    console.error('Discord webhook failed:', await discordRes.text());
    return new Response('Discord webhook failed', { status: 500 });
  }

  console.log(`Discord reminder sent for ${unresponsive.length} members`);
  return new Response(`Reminded ${unresponsive.length} members`, { status: 200 });
});
