// Follow this setup guide: https://supabase.com/docs/guides/functions/cron
// Deploy: supabase functions deploy attendance-reminder
// Set secrets: supabase secrets set DISCORD_WEBHOOK_URL=your_webhook_url

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') ?? '';

// Discord role ping for the GENESIS ❇️ role + public app link
const GENESIS_ROLE_MENTION = '<@&1488127804754104460>';
const APP_URL = 'https://basicbasja-cloud.github.io/Guild-personnel-attending-check/';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AttendanceRow {
  user_id: string;
}

type ReminderMode = 'early' | 'last_chance' | 'late';

function getReminderMode(now: Date): ReminderMode {
  const day = now.getDay(); // 0=Sun, 1=Mon, ... 3=Wed, 4=Thu, 5=Fri
  if (day === 1) return 'early'; // Mon: polite reminder + GENESIS ping
  if (day === 3) return 'last_chance'; // Wed: deadline day + GENESIS ping
  return 'late'; // Thu/Fri: overdue + GENESIS ping
}

const MODE_CONFIG: Record<ReminderMode, { title: string; color: number; mentionGenesisRole: boolean }> = {
  early: { title: '📋 Attendance Reminder', color: 0x22c55e, mentionGenesisRole: true },
  last_chance: { title: '⏰ PLEASE SELECT YOUR ATTENDANCE STATUS WITHIN TODAY', color: 0xf59e0b, mentionGenesisRole: true },
  late: { title: "🚨 IT'S LATE!!!! PLEASE SELECT YOUR ATTENDANCE STATUS RIGHT NOW", color: 0xef4444, mentionGenesisRole: true },
};

function buildDescription(mode: ReminderMode, weekStart: string, count: number): string {
  switch (mode) {
    case 'early':
      return `**${count} member(s)** haven't responded yet for the week of **${weekStart}**.\nPlease press **JOIN / NOT JOIN / MAYBE** in the app!`;
    case 'last_chance':
      return `**${count} member(s)** haven't responded yet for the week of **${weekStart}**.\nToday is the **last day** — don't wait, press **JOIN / NOT JOIN / MAYBE** now!`;
    case 'late':
      return `**${count} member(s)** still haven't responded for the week of **${weekStart}**.\nThe deadline has passed — **you're late!** ⏱️ Press **JOIN / NOT JOIN / MAYBE** right now.`;
  }
}

Deno.serve(async () => {
  if (!DISCORD_WEBHOOK_URL) {
    console.error('DISCORD_WEBHOOK_URL not configured');
    return new Response('Missing DISCORD_WEBHOOK_URL', { status: 500 });
  }

  const now = new Date();
  const mode = getReminderMode(now);

  // Week key must match the app: attendance is keyed by the UPCOMING SATURDAY
  // (war day), not Monday. See src/lib/week.ts getUpcomingSaturday().
  const dayOfWeek = now.getDay(); // 0=Sun ... 6=Sat
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSaturday);
  const weekStart = saturday.toISOString().slice(0, 10);

  console.log(`Checking attendance for week starting ${weekStart} (mode: ${mode})`);

  // 1. Fetch attendance for this week (only what we need — no profile list required)
  const { data: attendance, error: attErr } = await supabase
    .from('attendance')
    .select('user_id')
    .eq('week_start', weekStart);

  if (attErr) {
    console.error('Failed to fetch attendance:', attErr);
    return new Response('Error fetching attendance', { status: 500 });
  }

  // 2. Count total members
  const { count: totalMembers, error: cntErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  if (cntErr) {
    console.error('Failed to count profiles:', cntErr);
    return new Response('Error counting profiles', { status: 500 });
  }

  const respondedCount = new Set((attendance ?? []).map((a: AttendanceRow) => a.user_id)).size;
  const unresponsiveCount = Math.max((totalMembers ?? 0) - respondedCount, 0);

  if (unresponsiveCount === 0) {
    console.log('All members have responded. No reminders needed.');
    return new Response('All members responded', { status: 200 });
  }

  console.log(`${unresponsiveCount} members have not responded yet`);

  // 3. Build Discord payload based on mode
  const config = MODE_CONFIG[mode];

  // 4. Build embed — no member list (some are test accounts), just a count
  const embed = {
    title: config.title,
    url: APP_URL,
    description: [
      `## 👉 [OPEN THE APP TO RESPOND](${APP_URL}) ⬅️`,
      '',
      buildDescription(mode, weekStart, unresponsiveCount),
    ].join('\n'),
    color: config.color,
    footer: {
      text: 'Guild War Manager • Attendance',
    },
    timestamp: new Date().toISOString(),
  };

  const discordPayload = {
    content: config.mentionGenesisRole
      ? `${GENESIS_ROLE_MENTION} Please select your attendance status now! 👉 ${APP_URL}`
      : null,
    embeds: [embed],
    allowed_mentions: {
      // Only allow the GENESIS role ping — never individual users
      parse: config.mentionGenesisRole ? ['roles'] : [],
    },
  };

  const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordPayload),
  });

  if (!discordRes.ok) {
    const errBody = await discordRes.text();
    console.error('Discord webhook failed:', discordRes.status, errBody);
    return new Response(`Discord webhook failed: ${discordRes.status}`, { status: 500 });
  }

  console.log(`Discord ${mode} reminder sent for ${unresponsiveCount} members`);
  return new Response(`Reminded ${unresponsiveCount} members (${mode})`, { status: 200 });
});
