-- Guild War Manager – Supabase Database Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

create extension if not exists pgcrypto;

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
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles add column if not exists is_admin boolean not null default false;

alter table public.profiles enable row level security;

-- Everyone can read all profiles (needed for party builder)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select using (true);

-- Users can update their own profile, and admins can update any profile.
-- Single policy avoids multiple permissive UPDATE policy overhead.
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_admin = true
    )
  );

-- Users can insert their own profile (handled by upsert on sign-in)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert with check ((select auth.uid()) = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ATTENDANCE
--    Each member records their status for a given ISO week.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  week_start  date not null,   -- Monday of the ISO week, e.g. '2025-01-06'
  status      text not null check (status in ('join', 'not_join', 'maybe')),
  set_by      uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.attendance enable row level security;

-- Anyone authenticated can read attendance (management needs it)
drop policy if exists "attendance_select_auth" on public.attendance;
create policy "attendance_select_auth"
  on public.attendance for select using ((select auth.role()) = 'authenticated');

-- Any authenticated user can insert or update attendance (on behalf of others)
drop policy if exists "attendance_insert_own" on public.attendance;
drop policy if exists "attendance_insert_own_or_management" on public.attendance;
drop policy if exists "attendance_insert_own_or_mgmt" on public.attendance;
create policy "attendance_insert_auth"
  on public.attendance for insert with check (
    (select auth.role()) = 'authenticated'
  );

drop policy if exists "attendance_update_own" on public.attendance;
drop policy if exists "attendance_update_own_or_management" on public.attendance;
drop policy if exists "attendance_update_own_or_mgmt" on public.attendance;
create policy "attendance_update_auth"
  on public.attendance for update using (
    (select auth.role()) = 'authenticated'
  );

drop policy if exists "attendance_delete_own" on public.attendance;
create policy "attendance_delete_own"
  on public.attendance for delete using ((select auth.uid()) = user_id);

-- Indexes: speed up the most common query pattern (fetch all rows for a week)
create index if not exists idx_attendance_week_start
  on public.attendance (week_start, created_at);
create index if not exists idx_attendance_user_week
  on public.attendance (user_id, week_start);
create index if not exists idx_attendance_set_by
  on public.attendance (set_by);

-- Trigger to set `set_by` when a row is inserted/updated by someone other than the target user
drop function if exists public.attendance_set_set_by();
create or replace function public.attendance_set_set_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    new.set_by := null;
    return new;
  end if;

  if new.user_id IS DISTINCT FROM (select auth.uid()) then
    new.set_by := (select auth.uid());
  else
    new.set_by := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Trigger functions must not be callable via REST API
revoke execute on function public.attendance_set_set_by() from public;

drop trigger if exists attendance_set_by_trigger on public.attendance;
create trigger attendance_set_by_trigger
before insert or update on public.attendance
for each row execute procedure public.attendance_set_set_by();

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

drop policy if exists "war_setups_select_auth" on public.war_setups;
create policy "war_setups_select_auth"
  on public.war_setups for select using ((select auth.role()) = 'authenticated');

-- Only management can create/modify war setups
drop policy if exists "war_setups_insert_mgmt" on public.war_setups;
create policy "war_setups_insert_mgmt"
  on public.war_setups for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_management = true
    )
  );

drop policy if exists "war_setups_update_mgmt" on public.war_setups;
create policy "war_setups_update_mgmt"
  on public.war_setups for update
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_management = true
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

-- Index: Postgres does NOT auto-create indexes for FK constraints.
-- war_groups.bySetup query filters on war_setup_id for every management page load.
create index if not exists idx_war_groups_setup_id
  on public.war_groups (war_setup_id);

drop policy if exists "war_groups_select_auth" on public.war_groups;
create policy "war_groups_select_auth"
  on public.war_groups for select using ((select auth.role()) = 'authenticated');

drop policy if exists "war_groups_insert_mgmt" on public.war_groups;
create policy "war_groups_insert_mgmt"
  on public.war_groups for insert
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

drop policy if exists "war_groups_delete_mgmt" on public.war_groups;
create policy "war_groups_delete_mgmt"
  on public.war_groups for delete
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
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

-- Index: war_parties.byGroups filters on group_id (IN query over group IDs).
create index if not exists idx_war_parties_group_id
  on public.war_parties (group_id);

drop policy if exists "war_parties_select_auth" on public.war_parties;
create policy "war_parties_select_auth"
  on public.war_parties for select using ((select auth.role()) = 'authenticated');

drop policy if exists "war_parties_insert_mgmt" on public.war_parties;
create policy "war_parties_insert_mgmt"
  on public.war_parties for insert
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

drop policy if exists "war_parties_delete_mgmt" on public.war_parties;
create policy "war_parties_delete_mgmt"
  on public.war_parties for delete
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
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

-- Index: war_party_members.bySetup filters on war_setup_id (fetches all members for a war).
create index if not exists idx_war_party_members_setup_id
  on public.war_party_members (war_setup_id);

drop policy if exists "war_party_members_select_auth" on public.war_party_members;
create policy "war_party_members_select_auth"
  on public.war_party_members for select using ((select auth.role()) = 'authenticated');

drop policy if exists "war_party_members_insert_mgmt" on public.war_party_members;
create policy "war_party_members_insert_mgmt"
  on public.war_party_members for insert
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

drop policy if exists "war_party_members_update_mgmt" on public.war_party_members;
create policy "war_party_members_update_mgmt"
  on public.war_party_members for update
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

drop policy if exists "war_party_members_delete_mgmt" on public.war_party_members;
create policy "war_party_members_delete_mgmt"
  on public.war_party_members for delete
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: promote a user to management
-- Usage: UPDATE public.profiles SET is_management = true WHERE discord_id = '<id>';
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: promote a user to admin
-- Usage: UPDATE public.profiles SET is_management = true, is_admin = true WHERE discord_id = '<id>';

create table if not exists public.admin_runtime_config (
  singleton      boolean primary key default true check (singleton),
  admin_pin_hash text
);

alter table public.admin_runtime_config enable row level security;

-- Configure the admin PIN manually in the Supabase SQL editor with a command like:
-- insert into public.admin_runtime_config (singleton, admin_pin_hash)
-- values (true, encode(digest('REPLACE_WITH_A_SECRET_6_DIGIT_PIN', 'sha256'), 'hex'))
-- on conflict (singleton) do update set admin_pin_hash = excluded.admin_pin_hash;

create table if not exists public.class_catalog (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color_hex   text not null,
  created_at  timestamptz not null default now(),
  unique (name)
);

alter table public.class_catalog enable row level security;

drop policy if exists "class_catalog_select_auth" on public.class_catalog;
create policy "class_catalog_select_auth"
  on public.class_catalog for select using ((select auth.role()) = 'authenticated');

insert into public.class_catalog (name, color_hex)
values
  ('Ironclad (หมัด)', '#C2A500'),
  ('Celestune (พิณ)', '#1E3A8A'),
  ('Numina (โคม)', '#7C3AED'),
  ('Night walker (ดาบ)', '#1D9BF0'),
  ('Dragonsvale (กระบี่)', '#0F766E'),
  ('Bloodstrom (หอก)', '#DC2626'),
  ('Sylphs (พระ)', '#EC4899')
on conflict (name) do update set color_hex = excluded.color_hex;

drop function if exists public.verify_admin_pin(text);
create or replace function public.verify_admin_pin(provided_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  configured_pin_hash text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select admin_pin_hash
    into configured_pin_hash
  from public.admin_runtime_config
  where singleton = true;

  if configured_pin_hash is null or btrim(configured_pin_hash) = '' then
    raise exception 'Admin PIN is not configured in public.admin_runtime_config';
  end if;

  return encode(digest(provided_pin, 'sha256'), 'hex') = configured_pin_hash;
end;
$$;

grant execute on function public.verify_admin_pin(text) to authenticated;
revoke execute on function public.verify_admin_pin(text) from public;

drop function if exists public.set_management_level_with_pin(uuid, text, text);
create or replace function public.set_management_level_with_pin(
  target_user_id uuid,
  next_role text,
  provided_pin text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  updated_profile public.profiles;
  configured_pin_hash text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select admin_pin_hash
    into configured_pin_hash
  from public.admin_runtime_config
  where singleton = true;

  if configured_pin_hash is null or btrim(configured_pin_hash) = '' then
    raise exception 'Admin PIN is not configured in public.admin_runtime_config';
  end if;

  if encode(digest(provided_pin, 'sha256'), 'hex') <> configured_pin_hash then
    raise exception 'Incorrect admin PIN';
  end if;

  if next_role not in ('member', 'management') then
    raise exception 'Unsupported role';
  end if;

  update public.profiles
  set is_management = (next_role = 'management'),
      is_admin = false,
      updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.set_management_level_with_pin(uuid, text, text) to authenticated;
revoke execute on function public.set_management_level_with_pin(uuid, text, text) from public;

drop function if exists public.add_class_with_pin(text, text, text);
create or replace function public.add_class_with_pin(
  class_name text,
  color_hex text,
  provided_pin text
)
returns public.class_catalog
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  upserted_class public.class_catalog;
  configured_pin_hash text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select admin_pin_hash
    into configured_pin_hash
  from public.admin_runtime_config
  where singleton = true;

  if configured_pin_hash is null or btrim(configured_pin_hash) = '' then
    raise exception 'Admin PIN is not configured in public.admin_runtime_config';
  end if;

  if encode(digest(provided_pin, 'sha256'), 'hex') <> configured_pin_hash then
    raise exception 'Incorrect admin PIN';
  end if;

  if class_name is null or btrim(class_name) = '' then
    raise exception 'Class name is required';
  end if;

  if color_hex is null or color_hex !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Color must be a hex value like #1E3A8A';
  end if;

  insert into public.class_catalog (name, color_hex)
  values (btrim(class_name), upper(color_hex))
  on conflict (name)
  do update set color_hex = excluded.color_hex
  returning * into upserted_class;

  return upserted_class;
end;
$$;

grant execute on function public.add_class_with_pin(text, text, text) to authenticated;
revoke execute on function public.add_class_with_pin(text, text, text) from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- DELETE USER WITH PIN
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.delete_user_with_pin(target_user_id uuid, provided_pin text)
returns void
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
declare
  configured_pin_hash text;
  recent_failures     int;
  is_correct          boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)
    into recent_failures
  from public.admin_pin_attempts
  where user_id = auth.uid()
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if recent_failures >= 5 then
    raise exception 'Too many failed attempts. Please wait 15 minutes before trying again.';
  end if;

  select admin_pin_hash
    into configured_pin_hash
  from public.admin_runtime_config
  where singleton = true;

  if configured_pin_hash is null or btrim(configured_pin_hash) = '' then
    raise exception 'Admin PIN is not configured in public.admin_runtime_config';
  end if;

  is_correct := crypt(provided_pin, configured_pin_hash) = configured_pin_hash;
  insert into public.admin_pin_attempts (user_id, success) values (auth.uid(), is_correct);

  if not is_correct then
    raise exception 'Incorrect admin PIN';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.delete_user_with_pin(uuid, text) to authenticated;
revoke execute on function public.delete_user_with_pin(uuid, text) from public;
revoke execute on function public.delete_user_with_pin(uuid, text) from anon;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, discord_id, username, avatar_url, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'provider_id', ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.email,
      'Unknown'
    ),
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    now()
  )
  on conflict (id)
  do update set
    discord_id = excluded.discord_id,
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

-- Trigger function must not be callable via REST API
revoke execute on function public.handle_new_user_profile() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, discord_id, username, avatar_url, updated_at)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'provider_id', ''),
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.email,
    'Unknown'
  ),
  nullif(u.raw_user_meta_data->>'avatar_url', ''),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- ADDITIVE MIGRATIONS (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

-- Dual ultimate skill fields on profiles
alter table public.profiles add column if not exists main_skill_name  text;
alter table public.profiles add column if not exists main_skill_level int;
alter table public.profiles add column if not exists sub_skill_name   text;
alter table public.profiles add column if not exists sub_skill_level  int;

-- Party icon identifier on war_parties
alter table public.war_parties add column if not exists icon text;

-- ─────────────────────────────────────────────────────────────────────────────
-- ADMIN PIN ATTEMPTS TABLE
-- (Referenced by delete_user_with_pin but was not explicitly created)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_pin_attempts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  success      boolean     not null,
  attempted_at timestamptz not null default now()
);
alter table public.admin_pin_attempts enable row level security;
create index if not exists idx_admin_pin_attempts_user_time
  on public.admin_pin_attempts(user_id, attempted_at desc);
-- Only the security-definer functions can insert; users cannot read
drop policy if exists "pin_attempts_insert_auth" on public.admin_pin_attempts;
create policy "pin_attempts_insert_auth"
  on public.admin_pin_attempts for insert
  with check ((select auth.role()) = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- RATE-LIMITED verify_admin_pin
-- Replace the plain version with one that checks admin_pin_attempts.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.verify_admin_pin(text);
create or replace function public.verify_admin_pin(provided_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  configured_pin_hash text;
  recent_failures     int;
  is_correct          boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)
    into recent_failures
  from public.admin_pin_attempts
  where user_id = auth.uid()
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if recent_failures >= 5 then
    raise exception 'Too many failed attempts. Please wait 15 minutes before trying again.';
  end if;

  select admin_pin_hash
    into configured_pin_hash
  from public.admin_runtime_config
  where singleton = true;

  if configured_pin_hash is null or btrim(configured_pin_hash) = '' then
    raise exception 'Admin PIN is not configured in public.admin_runtime_config';
  end if;

  is_correct := encode(digest(provided_pin, 'sha256'), 'hex') = configured_pin_hash;
  insert into public.admin_pin_attempts (user_id, success) values (auth.uid(), is_correct);

  return is_correct;
end;
$$;

grant execute on function public.verify_admin_pin(text) to authenticated;
revoke execute on function public.verify_admin_pin(text) from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOG TABLE
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        references public.profiles(id) on delete set null,
  action      text        not null,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists idx_audit_log_actor_id   on public.audit_log(actor_id);
-- Management can read; any authenticated user can insert (via app code)
drop policy if exists "audit_log_select_mgmt" on public.audit_log;
create policy "audit_log_select_mgmt"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_management = true
    )
  );
drop policy if exists "audit_log_insert_auth" on public.audit_log;
create policy "audit_log_insert_auth"
  on public.audit_log for insert
  with check ((select auth.role()) = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- GUILD LEAGUE STRATEGIC MAP BOARD TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- Seasons group a set of strategy plans
create table if not exists public.league_seasons (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);
alter table public.league_seasons enable row level security;
drop policy if exists "league_seasons_select_mgmt" on public.league_seasons;
create policy "league_seasons_select_mgmt"
  on public.league_seasons for select
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );
drop policy if exists "league_seasons_write_mgmt" on public.league_seasons;
create policy "league_seasons_write_mgmt"
  on public.league_seasons for all
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  )
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

-- Named strategy plans (up to N per season)
create table if not exists public.league_plans (
  id         uuid        primary key default gen_random_uuid(),
  season_id  uuid        not null references public.league_seasons(id) on delete cascade,
  name       text        not null,
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);
alter table public.league_plans enable row level security;
drop policy if exists "league_plans_select_mgmt" on public.league_plans;
create policy "league_plans_select_mgmt"
  on public.league_plans for select
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );
drop policy if exists "league_plans_write_mgmt" on public.league_plans;
create policy "league_plans_write_mgmt"
  on public.league_plans for all
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  )
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

-- Assigns a war party to a map zone with a status within a plan
create table if not exists public.league_zone_assignments (
  id         uuid        primary key default gen_random_uuid(),
  plan_id    uuid        not null references public.league_plans(id) on delete cascade,
  zone_id    text        not null,   -- matches leagueMapLayout.ts zone id strings
  party_id   uuid        references public.war_parties(id) on delete set null,
  status     text        not null default 'neutral' check (status in ('friendly','enemy','neutral')),
  note       text,
  updated_at timestamptz not null default now(),
  constraint uq_plan_zone_party unique (plan_id, zone_id, party_id)
);
alter table public.league_zone_assignments enable row level security;
create index if not exists idx_lza_plan_id on public.league_zone_assignments(plan_id);
drop policy if exists "league_zone_assignments_select_mgmt" on public.league_zone_assignments;
create policy "league_zone_assignments_select_mgmt"
  on public.league_zone_assignments for select
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );
drop policy if exists "league_zone_assignments_write_mgmt" on public.league_zone_assignments;
create policy "league_zone_assignments_write_mgmt"
  on public.league_zone_assignments for all
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  )
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

-- Attack wave arrows: directed edges between map zones
create table if not exists public.league_arrows (
  id           uuid        primary key default gen_random_uuid(),
  plan_id      uuid        not null references public.league_plans(id) on delete cascade,
  from_zone_id text        not null,
  to_zone_id   text        not null,
  phase        int         not null default 1 check (phase between 1 and 3),
  label        text,
  created_at   timestamptz not null default now(),
  constraint uq_arrow_plan_zones unique (plan_id, from_zone_id, to_zone_id, phase)
);
alter table public.league_arrows enable row level security;
create index if not exists idx_arrows_plan_id on public.league_arrows(plan_id);
drop policy if exists "league_arrows_select_mgmt" on public.league_arrows;
create policy "league_arrows_select_mgmt"
  on public.league_arrows for select
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );
drop policy if exists "league_arrows_write_mgmt" on public.league_arrows;
create policy "league_arrows_write_mgmt"
  on public.league_arrows for all
  using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  )
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and is_management = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: League board – party-based free-placement system
-- Run this block once in your Supabase SQL editor (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Make zone_id nullable in league_zone_assignments (party rows use party_id instead)
do $$ begin
  alter table public.league_zone_assignments alter column zone_id drop not null;
exception when others then null;
end $$;

-- 2. Add free-placement position columns (0–100 %) to league_zone_assignments
alter table public.league_zone_assignments
  add column if not exists pos_x float not null default 50,
  add column if not exists pos_y float not null default 50;

-- 3. Replace the (plan_id, zone_id, party_id) constraint with (plan_id, party_id)
do $$ begin
  alter table public.league_zone_assignments drop constraint uq_plan_zone_party;
exception when others then null;
end $$;
-- Unique index allows multiple NULL party_ids (enemy markers) while preventing
-- the same war-party from being placed twice in one plan.
create unique index if not exists uq_lza_plan_party
  on public.league_zone_assignments (plan_id, party_id)
  where party_id is not null;

-- 4. Add party_id reference columns to league_arrows
alter table public.league_arrows
  add column if not exists from_party_id uuid references public.war_parties(id) on delete cascade,
  add column if not exists to_party_id   uuid references public.war_parties(id) on delete cascade;

-- 5. Make legacy zone columns nullable in league_arrows
do $$ begin
  alter table public.league_arrows alter column from_zone_id drop not null;
exception when others then null;
end $$;
do $$ begin
  alter table public.league_arrows alter column to_zone_id drop not null;
exception when others then null;
end $$;

-- 6. Replace the zone-based unique constraint with a party-based one
do $$ begin
  alter table public.league_arrows drop constraint uq_arrow_plan_zones;
exception when others then null;
end $$;
-- Unique index enables ON CONFLICT upsert on (plan_id, from_party_id, to_party_id, phase).
-- NULL party_ids are treated as distinct (NULLS DISTINCT) so legacy rows are unaffected.
create unique index if not exists uq_arrow_plan_parties
  on public.league_arrows (plan_id, from_party_id, to_party_id, phase)
  where from_party_id is not null and to_party_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Open league board read access to all authenticated users
-- Management retains full write access; normal members get read-only view.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "league_seasons_select_mgmt" on public.league_seasons;
drop policy if exists "league_seasons_select_auth" on public.league_seasons;
create policy "league_seasons_select_auth"
  on public.league_seasons for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "league_plans_select_mgmt" on public.league_plans;
drop policy if exists "league_plans_select_auth" on public.league_plans;
create policy "league_plans_select_auth"
  on public.league_plans for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "league_zone_assignments_select_mgmt" on public.league_zone_assignments;
drop policy if exists "league_zone_assignments_select_auth" on public.league_zone_assignments;
create policy "league_zone_assignments_select_auth"
  on public.league_zone_assignments for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "league_arrows_select_mgmt" on public.league_arrows;
drop policy if exists "league_arrows_select_auth" on public.league_arrows;
create policy "league_arrows_select_auth"
  on public.league_arrows for select
  using ((select auth.role()) = 'authenticated');

