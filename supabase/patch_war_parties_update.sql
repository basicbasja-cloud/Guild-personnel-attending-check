-- Allow management users to update war_parties rows (party icons).
-- Without this policy, RLS rejects every UPDATE for everyone, while the UI
-- still applies the icon optimistically and only logs the error.
--
-- Run this once in the Supabase SQL Editor. It is idempotent.

drop policy if exists "war_parties_update_mgmt" on public.war_parties;

create policy "war_parties_update_mgmt"
  on public.war_parties for update
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_management = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_management = true
    )
  );
