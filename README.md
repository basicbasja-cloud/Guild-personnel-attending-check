# ⚔️ Guild War Manager

A web application for guild attendance tracking and guild-war party management.  
Hosted on **GitHub Pages** · Backend by **Supabase** · Auth via **Discord OAuth2** (+ optional test-only Google OAuth)

---

## Features

- 🔐 **Discord OAuth login** — every member uses their unique Discord account
- 🧪 **Optional Google OAuth login (test only)** — hidden unless explicitly enabled with env flag
- 📋 **Attendance submission** — members pick **Join / Can't Join / Maybe** for each week
- 🏋️ **Training System** — separate training event management:
  - **Training Events** on the calendar with flexible event types (War, Training, Internal Event, etc.)
  - **Training Attendance** — members respond Join/Can't Join/Maybe per training event
  - **Training War Setup** — full drag-and-drop party builder for training, identical to main war setup
  - **Auto-announcements** and **floating toast notifications** when training is scheduled
- 📊 **Player Stats Dashboard** _(management only)_ — 3 tabs:
  - **Summary** — combined war (×0.7) + training (×0.3) active score with visual progress bars
  - **War** — 12-week war attendance history
  - **Training** — all training event attendance history
- 👥 **Roster view** — see all responses for the current week, including who set attendance on behalf of others
- 📢 **Announcements Board** — guild-wide posts by management with pin-to-top and real-time sync; unread count badge on the tab
- ⚔️ **War setup builder** _(management only)_:
  - Drag-and-drop members from the available pool into party slots
  - **Up to 60 active members** across groups (each group: 5 parties × 6 people = 30)
  - **Up to 20 substitutes** in a dedicated substitute list
  - Drag overlay with scale + shadow, drop targets with pulsing glow
  - Swap members between slots, or drag back to the available pool to unassign
- 🗺️ **League Board** — interactive war map with phase planning, draggable party markers, enemy markers, and freehand drawing
- 📅 **Guild Event Calendar** — drag-and-drop event scheduling with color coding
- 🏆 **KPI Stats** — post-war performance tracking with 6 role classifications, scoring boards, progressive metrics, and **animated score tier scenes** (Recruit 🗡️ → Demon King 👑)
- 🔥 **Attendance Streaks** — consecutive war attendance tracked with milestone badges (5 = "Hot streak!", 10 = "On fire!", 15 = "Legendary!")
- 👑 **Title System** — earn titles through attendance milestones (Stalwart, Iron Will, Legendary) or get officer-assigned titles (MVP, custom); active title displays on your member card
- 🌟 **Member of the Week** — officer-nominated recognition with gold banner on every page
- 🔐 **Admin Mode** — PIN-protected account management
- 🌗 **Light/Dark Theme** — toggle with sun/moon icon in the header; preference saved across sessions
- 🎨 **Logo color picker** — customize the app logo color; syncs across devices
- 🏷️ Each member can set their **character name**, **class / school**, and **ultimate skills**

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript (Vite) |
| Styling | Tailwind CSS v4 |
| Drag & Drop | [@dnd-kit](https://dndkit.com) |
| Backend / DB | [Supabase](https://supabase.com) (PostgreSQL + Auth) |
| Hosting | GitHub Pages |

---

## Setup Guide

### 1. Clone & install

```bash
git clone https://github.com/basicbasja-cloud/Guild-personnel-attending-check.git
cd Guild-personnel-attending-check
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.
3. In **Authentication → Providers**, enable **Discord** and fill in your Discord OAuth app credentials.
   - Discord app: [discord.com/developers/applications](https://discord.com/developers/applications)
   - Redirect URL to add in Discord: `https://<your-project>.supabase.co/auth/v1/callback`
4. (Optional, test environment only) Enable **Google** provider with redirect URL `https://<your-project>.supabase.co/auth/v1/callback`.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ENABLE_TEST_GOOGLE_LOGIN=false
```

Get these from **Supabase → Project Settings → API**.

Set `VITE_ENABLE_TEST_GOOGLE_LOGIN=true` only in your test environment to show the Google login button.

### 4. Run locally

```bash
npm run dev
```

### 5. Deploy to GitHub Pages

```bash
npm run deploy
```

This runs `npm run build` then pushes the `dist/` folder to the `gh-pages` branch.

Make sure GitHub Pages is set to serve from the **`gh-pages` branch** in your repository settings.

### 6. Deploy test build to a separate branch

```bash
npm run deploy:test
```

This runs `npm run build:test` (Vite test mode) and publishes `dist/` to the **`gh-pages-test`** branch.

- `gh-pages` branch: production deployment (Discord-only)
- `gh-pages-test` branch: test deployment (Google login button enabled via `.env.test`)

If you want to open the test build as GitHub Pages, switch the Pages source branch to `gh-pages-test` temporarily.

---

## Granting Management Access

After a user signs in for the first time, promote them to management via the Supabase dashboard:

```sql
UPDATE public.profiles
SET is_management = true
WHERE username = 'DiscordUsername';
```

Management users see the **Roster** and **War Setup** tabs.

---

## Guild Member & Class List

Character names and classes are self-registered — each member sets their own character name and class after logging in via the **Attendance** tab → **Character Info → Edit**.

---

## Project Structure

```
src/
├── components/
│   ├── auth/          # LoginPage
│   ├── attendance/    # AttendancePage (join/not_join/maybe)
│   ├── layout/        # Header
│   └── management/    # ManagementPage, GroupBoard, PartyCard, MemberCard, AttendanceList
├── hooks/
│   ├── useAuth.ts      # Discord OAuth + profile management
│   ├── useAttendance.ts
│   └── useWarSetup.ts
├── lib/
│   └── supabase.ts
└── types/
    └── index.ts
supabase/
└── schema.sql          # Full DB schema with RLS policies
```
