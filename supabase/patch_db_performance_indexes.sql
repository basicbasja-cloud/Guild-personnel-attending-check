-- ═════════════════════════════════════════════════════════════════════════════
-- PATCH: Low-risk foreign-key indexes for write/read-heavy paths
-- Idempotent — safe to run multiple times.
--
-- These indexes support foreign-key checks and common relationship lookups.
-- No existing index is removed and no row-level-security policy is changed.
-- ═════════════════════════════════════════════════════════════════════════════

create index if not exists idx_access_keys_created_by
  on public.access_keys (created_by);

create index if not exists idx_announcement_reactions_user_id
  on public.announcement_reactions (user_id);

-- room_settings is a legacy table that is not declared in schema.sql on this
-- project, so keep this statement safe for fresh environments where it is not
-- present.
do $$
begin
  if to_regclass('public.room_settings') is not null then
    execute 'create index if not exists idx_room_settings_updated_by on public.room_settings (updated_by)';
  end if;
end;
$$;
