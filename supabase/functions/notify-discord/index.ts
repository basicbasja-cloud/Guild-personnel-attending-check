// Generic Discord notifier — lets the app post messages to a Discord channel.
// Deploy: supabase functions deploy notify-discord
// Set secrets: supabase secrets set DISCORD_WEBHOOK_URL=your_webhook_url
//
// Body (JSON):
// {
//   title?: string,           // Embed title
//   description?: string,     // Embed description (supports markdown)
//   color?: number,           // Hex color, e.g. 0x6366f1
//   mentionEveryone?: boolean // Prepend "@everyone" to the message
//   fields?: { name, value, inline? }[]
// }

const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') ?? '';

interface NotifyBody {
  title?: string;
  description?: string;
  color?: number;
  mentionEveryone?: boolean;
  fields?: { name: string; value: string; inline?: boolean }[];
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!DISCORD_WEBHOOK_URL) {
    console.error('DISCORD_WEBHOOK_URL not configured');
    return new Response('Missing DISCORD_WEBHOOK_URL', { status: 500 });
  }

  // Verify the caller is a logged-in user (uses the Supabase auth JWT)
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { title, description, color = 0x6366f1, mentionEveryone = false, fields = [] } = body;

  if (!title && !description && fields.length === 0) {
    return new Response('Nothing to send (provide title, description, or fields)', { status: 400 });
  }

  const embed: Record<string, unknown> = {
    color,
    timestamp: new Date().toISOString(),
    footer: { text: 'Guild War Manager' },
  };
  if (title) embed.title = title;
  if (description) embed.description = description.slice(0, 4000); // Discord limit
  if (fields.length > 0) {
    embed.fields = fields.slice(0, 25).map((f) => ({
      name: String(f.name).slice(0, 256),
      value: String(f.value).slice(0, 1024),
      inline: f.inline ?? false,
    }));
  }

  const payload = {
    content: mentionEveryone ? '@everyone' : null,
    embeds: [embed],
    allowed_mentions: {
      parse: mentionEveryone ? ['everyone'] : [],
    },
  };

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('Discord webhook failed:', await res.text());
    return new Response('Discord webhook failed', { status: 502 });
  }

  return new Response('Sent', { status: 200 });
});
