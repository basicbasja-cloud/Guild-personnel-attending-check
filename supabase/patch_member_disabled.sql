-- ═════════════════════════════════════════════════════════════════════════════
-- PATCH: Member "Disabled" status
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Idempotent — safe to run multiple times.
--
-- What it does:
--   1. Adds profiles.is_disabled (boolean, default false).
--   2. Adds set_member_disabled_with_pin() so Admin Mode can toggle it.
--
-- Disabled members remain fully VIEWABLE (profiles_select_all RLS already
-- allows everyone to read all profiles) but are blocked from interacting and
-- excluded from all client-side calculations by the app code.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Column
alter table public.profiles
  add column if not exists is_disabled boolean not null default false;

-- 2. PIN-gated toggle (same security model as set_management_level_with_pin)
drop function if exists public.set_member_disabled_with_pin;
create or replace function public.set_member_disabled_with_pin(
  target_user_id uuid,
  next_disabled boolean,
  provided_pin text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  updated_profile     public.profiles;
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

  update public.profiles
  set is_disabled = next_disabled,
      updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.set_member_disabled_with_pin(uuid, boolean, text) to authenticated;
revoke execute on function public.set_member_disabled_with_pin(uuid, boolean, text) from public;
revoke execute on function public.set_member_disabled_with_pin(uuid, boolean, text) from anon;

-- ═════════════════════════════════════════════════════════════════════════════
-- OPTIONAL (recommended): server-side exclusion of disabled members from the
-- KPI RPCs. These function bodies live only in the live database (they are not
-- in schema.sql), so edit them in the SQL Editor:
--   SELECT pg_get_functiondef('public.get_kpi_public_board(date)'::regprocedure);
-- then in each returned profile join / WHERE clause add:
--   and p.is_disabled = false
-- for these functions:
--   • get_kpi_public_board(date)
--   • get_kpi_entries_with_profiles(date)
--   • get_kpi_profile(uuid, integer)
-- The app also filters disabled members client-side, so this step is defense
-- in depth — but doing it keeps disabled members out of the raw payloads.
-- ═════════════════════════════════════════════════════════════════════════════
