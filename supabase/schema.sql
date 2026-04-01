-- Guild War Manager – Supabase Database Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES
--    Extended user info linked to auth.users via Discord OAuth.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  discord_id      text not null default '',
  username        text not null default 'Unknown',
  avatar_url      text,
  character_name  text,
  character_class text,
  is_management   boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone can read all profiles (needed for party builder)
create policy "profiles_select_all"
  on public.profiles for select using (true);

-- Users can only update their own profile
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

-- Users can insert their own profile (handled by upsert on sign-in)
create policy "profiles_insert_own"
  on public.profiles for insert with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ATTENDANCE
--    Each member records their status for a given ISO week.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  week_start  date not null,   -- Monday of the ISO week, e.g. '2025-01-06'
  status      text not null check (status in ('join', 'not_join', 'maybe')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.attendance enable row level security;

-- Anyone authenticated can read attendance (management needs it)
create policy "attendance_select_auth"
  on public.attendance for select using (auth.role() = 'authenticated');

-- Users manage their own attendance rows
create policy "attendance_insert_own"
  on public.attendance for insert with check (auth.uid() = user_id);

create policy "attendance_update_own"
  on public.attendance for update using (auth.uid() = user_id);

create policy "attendance_delete_own"
  on public.attendance for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. WAR SETUPS
--    One setup per week, created by management.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.war_setups (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null unique,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.war_setups enable row level security;

create policy "war_setups_select_auth"
  on public.war_setups for select using (auth.role() = 'authenticated');

-- Only management can create/modify war setups
create policy "war_setups_insert_mgmt"
  on public.war_setups for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_management = true
    )
  );

create policy "war_setups_update_mgmt"
  on public.war_setups for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_management = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. WAR GROUPS
--    Each war setup can have multiple groups (max 2 for 60 active players).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.war_groups (
  id           uuid primary key default gen_random_uuid(),
  war_setup_id uuid not null references public.war_setups(id) on delete cascade,
  group_number int  not null,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (war_setup_id, group_number)
);

alter table public.war_groups enable row level security;

create policy "war_groups_select_auth"
  on public.war_groups for select using (auth.role() = 'authenticated');

create policy "war_groups_insert_mgmt"
  on public.war_groups for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_management = true)
  );

create policy "war_groups_delete_mgmt"
  on public.war_groups for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_management = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. WAR PARTIES
--    Each group has up to 5 parties.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.war_parties (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.war_groups(id) on delete cascade,
  party_number int  not null,
  created_at   timestamptz not null default now(),
  unique (group_id, party_number)
);

alter table public.war_parties enable row level security;

create policy "war_parties_select_auth"
  on public.war_parties for select using (auth.role() = 'authenticated');

create policy "war_parties_insert_mgmt"
  on public.war_parties for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_management = true)
  );

create policy "war_parties_delete_mgmt"
  on public.war_parties for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_management = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. WAR PARTY MEMBERS
--    Assignment of users to party slots or the substitute list.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.war_party_members (
  id           uuid primary key default gen_random_uuid(),
  war_setup_id uuid not null references public.war_setups(id) on delete cascade,
  party_id     uuid references public.war_parties(id) on delete cascade,  -- null = substitute
  user_id      uuid not null references public.profiles(id) on delete cascade,
  position     int  not null,
  is_substitute boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (war_setup_id, user_id)  -- a member can only be in one slot per war
);

alter table public.war_party_members enable row level security;

create policy "war_party_members_select_auth"
  on public.war_party_members for select using (auth.role() = 'authenticated');

create policy "war_party_members_insert_mgmt"
  on public.war_party_members for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_management = true)
  );

create policy "war_party_members_update_mgmt"
  on public.war_party_members for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_management = true)
  );

create policy "war_party_members_delete_mgmt"
  on public.war_party_members for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_management = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: promote a user to management
-- Usage: UPDATE public.profiles SET is_management = true WHERE discord_id = '<id>';
-- ─────────────────────────────────────────────────────────────────────────────
