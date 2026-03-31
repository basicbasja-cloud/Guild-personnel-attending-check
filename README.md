# ⚔️ Guild War Manager

A web application for guild attendance tracking and guild-war party management.  
Hosted on **GitHub Pages** · Backend by **Supabase** · Auth via **Discord OAuth2**

---

## Features

- 🔐 **Discord OAuth login** — every member uses their unique Discord account
- 📋 **Attendance submission** — members pick **Join / Can't Join / Maybe** for each week
- 👥 **Roster view** _(management only)_ — see all responses for the current week at a glance
- ⚔️ **War setup builder** _(management only)_:
  - Drag-and-drop members from the available pool into party slots
  - **Up to 60 active members** across groups (each group: 5 parties × 6 people = 30)
  - **Up to 20 substitutes** in a dedicated substitute list
  - Multiple groups supported
  - Swap members between slots, or drag back to the available pool to unassign
- 🏷️ Each member can set their **character name** and **class / school (job)**

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

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from **Supabase → Project Settings → API**.

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
