# Patch Notes — May 8, 2026

---

## For Guild Members & Officers

### New Features

- **Google Login** — You can now sign in with a Google account in addition to Discord.

- **League Board** — A new "League Board" tab is available for all logged-in members. It shows the league war map with party positions for each phase. Officers can drag party markers, add enemy positions, draw freehand arrows and lines on the map (like MS Paint), and plan each of the three phases separately. Drawings save in real time and are visible to everyone.

- **Ultimate Skills on Profile** — You can now save your main and sub ultimate skill names and levels from the Attendance page profile editor. These show up on your member card in War Setup so officers can see your build at a glance.

- **Audit Log** — Officers can open an Audit Log from the Management page to see a paginated history of management actions: attendance overrides, account deletions, and party assignments/removals. Filterable by action type.

- **Logo Color Saves Across Devices** — Your chosen logo color is now saved to your account. Changing it on one device will apply on all your other devices when you log in.

### Bug Fixes

- Map image was not showing on the League Board in production (GitHub Pages) — fixed.
- War Setup realtime sync showed an error ("cannot add postgres_changes callbacks after subscribe") when switching weeks — fixed.

---

## For Technical People

### New Features & Improvements

**Google Login**
- `deploy.yml` — Added `VITE_ENABLE_GOOGLE_LOGIN: 'true'` env var to the CI build step. Google OAuth button now appears in the production build.

**League Board**
- New `LeagueBoardPage.tsx` component (~580 lines). Party markers, enemy markers (draggable red "E"), phase selector (1/2/3), right info panel with unplaced/placed party lists, icon picker modal.
- New `useLeagueBoard.ts` hook — manages `league_plans`, `league_zone_assignments`, `league_arrows`, `league_drawings` with Supabase realtime sync. Methods: `addDrawing`, `deleteDrawing`, `addEnemyMarker`, `moveAssignment`, arrow upsert.
- New `leagueMapLayout.ts` — `PARTY_ICONS`, `ICON_GLYPHS`, `PHASE_COLORS`, `LEAGUE_LANDMARKS` constants.
- `FreehandLayer` SVG component: `viewBox="0 0 100 100" preserveAspectRatio="none"` aligns SVG % coords to CSS % positions exactly. Live draw preview via direct DOM refs (`livePathRef`/`liveHeadRef`) — no React re-render during stroke. Quadratic Bézier interpolation. Arrowhead from last 5 points' angle.
- `App.tsx` — Added `league` tab (visible to all authenticated users). `useWarSetup()` data mapped to `PartySummaryWithMembers[]` via `useMemo` and passed to `LeagueBoardPage`. Tab stays mounted (`hidden` class) to preserve state across tab switches.
- `league_drawings` table: `id uuid`, `plan_id`, `phase int`, `points jsonb`, `created_at`. RLS applied.

**Ultimate Skills**
- `AttendancePage.tsx` — Profile editor extended with Main Skill / Sub Skill name and level fields. `onUpdateProfile` prop now accepts `main_skill_name`, `main_skill_level`, `sub_skill_name`, `sub_skill_level`.
- `MemberCard.tsx` — Skill name + level badges rendered below character class when present.
- `types/index.ts` — `main_skill_name`, `main_skill_level`, `sub_skill_name`, `sub_skill_level`, `logo_color` added to `Profile` interface.
- `useAuth.ts` — `updateProfile` allows the new skill + logo fields. `buildFallbackProfile()` initializes all new fields to `null`.

**Audit Log**
- New `AuditLogModal.tsx` — paginated (25/page) audit log viewer. Filters by action type (`attendance_override`, `admin_delete_user`, `party_assign`, `party_remove`). `writeAuditLog()` helper exported for use in action handlers.
- `audit_log` table: `id`, `actor_id`, `action`, `target_type`, `target_id`, `details jsonb`, `created_at`. FK join to `profiles` for actor display.

**Logo Color Persistence**
- `profiles.logo_color text DEFAULT '#4f46e5'` column added.
- `Header.tsx` — Reads from `profile.logo_color`, falls back to `localStorage('gwm_logo_color')`, then `#4f46e5`. On change: updates localStorage immediately + `supabase.from('profiles').update({ logo_color })` for cross-device sync.

**syncEngine improvements**
- `syncEngine.ts` — Extended with `getPendingCount()` and additional queue management used by the war setup realtime handler to avoid overwriting in-flight optimistic updates.

### Bug Fixes

- `useWarSetup.ts` — Realtime channel name was `war-${setupId}` (static). Supabase JS caches channels by name; when React re-ran the effect (week change or re-mount), it returned the already-subscribed channel and failed to add `.on()`. Fixed by appending `Date.now()` to make each subscription name unique: `war-${setupId}-${Date.now()}`.
- `LeagueBoardPage.tsx` — Map `src="/league-map.jpg"` returned 404 on GitHub Pages (base = `/Guild-personnel-attending-check/`). Fixed to `` `${import.meta.env.BASE_URL}league-map.jpg` ``.
- `AuditLogModal.tsx` — `.catch()` on Supabase `PromiseLike` caused TS2339 build error. Wrapped with `Promise.resolve(query).then(...).catch(...)`.

### Database

- `league_drawings` — freehand strokes per plan per phase.
- `audit_log` — management action history with actor FK.
- `profiles.logo_color text DEFAULT '#4f46e5'` — user logo color preference.

### Deployment

- Commits after `0a99e67`: `2d43687` (Google login), `4de4ecb` (league board + skills + audit log), `899403e` (build fixes), `de51597` (map image path).

---

# Patch Notes — May 4, 2026

---

## For Guild Members & Officers

### New Features

- **Everything loads instantly** — The app now saves data locally on your device. When you open any page, it shows right away from the saved data while quietly refreshing in the background. No more waiting every time you switch pages.

- **War Setup feels like a real game** — When you drag and drop a player into a party, it moves immediately on your screen. The server updates silently behind the scenes. No more lag or waiting for the database.

- **Groups are now fixed as A and B** — Group A always has parties 1–5 and Group B has parties 6–10. You no longer need to create groups manually each week.

- **Roster page** — A new Roster tab shows all members who have not responded (non-select) for the selected week. You can browse previous or future weeks just like on other pages.

- **Player Stats Dashboard** — GMs can now see a full 12-week attendance history for every member. Shows join, maybe, did not join, and no response counts. Sortable by any column, searchable by name, with an Export to Excel button.

- **Export to Excel** — You can export the attendance list, roster, and war setup party data to a spreadsheet file.

- **Set Attendance On Behalf of Others** — Any member can now mark attendance for someone else, not just GMs. Useful when a guildmate asks you to mark them in-game. The roster will show who submitted the status.

- **Admin: Delete Account** — Admins can now delete a member's account from the Admin panel using the admin PIN.

- **War Setup cleanup** — Removed the ✅🤔❌ status buttons from the available members panel in War Setup. Those belong on the Attendance page. War Setup is now focused on party arrangement only.

### Bug Fixes

- Some players were showing as "Unknown" in the attendance list for the current week — fixed.
- iPhone/iOS users were getting a crash ("undefined is not an object") on first load after an app update — fixed.

---

## For Technical People

### New Features & Improvements

**Caching & Performance**
- `useAttendance.ts` — Added `localStorage` persistence per week (`attendance_week_<date>`). Cache is validated with `Array.isArray` guard. In-memory cache prevents redundant re-fetches within a session.
- `useAllProfiles.ts` — Profiles cached to `localStorage` (`all_profiles_cache`) with in-memory fallback. `Array.isArray` guard on read to reject malformed cache.
- `useWarSetup.ts` — War setup (groups, parties, members) cached to `localStorage` (`war_setup_<date>`). Optimistic updates on drag-and-drop: UI updates immediately, DB write happens in background with queue/debounce (sync engine pattern). `Array.isArray` guards added to all cache reads.
- `src/lib/dbTiming.ts` — `withDbTiming()` wrapper to log slow queries.
- App preloads all profiles and current week attendance on mount.

**New Components / Pages**
- `src/components/management/PlayerStatsDashboard.tsx` — GM-only dashboard tab. Queries last 12 weeks of attendance, computes per-player `join / maybe / not_join / non_select` and attendance rate. Sortable columns, search input, mini progress bar, Export CSV. Uses `.then(onFulfilled, onRejected)` instead of `.catch()` to avoid `PromiseLike` TypeScript error.
- Roster tab (`src/components/attendance/AttendancePage.tsx` or separate page) — Shows non-select members for the selected week, with week navigation arrows matching other tabs.
- Export to CSV/Excel buttons added to `AttendanceList`, Roster, and ManagementPage war setup.
- Admin delete account: `delete_user_with_pin(target_user_id, provided_pin)` RPC added to `AdminModePage.tsx`.

**War Setup Groups**
- Groups A and B are now created automatically and fixed permanently. The "Add Group" button was removed. Group A = parties 1–5, Group B = parties 6–10. Party assignment logic updated accordingly.
- Class distribution calculation in `ManagementPage.tsx` excludes substitutes (bug fix).

**On-Behalf & Roster**
- `AttendancePage.tsx` — `OnBehalfSection` removed from `is_management` guard; shown for all authenticated users.
- `ManagementPage.tsx` — Removed `setStatus` from `useAttendance` destructure, removed `AttendanceStatus` import, removed ✅🤔❌ buttons from `AvailablePanel`. Removed unused `substitutes` variable from `classDistribution` useMemo.
- Roster page shows `set_by` profile name next to each attendance entry.

### Bug Fixes

- `AttendanceList.tsx` — Added `profileById` map from `allProfiles` + `resolve(a)` helper. When `a.profile` is `undefined` (profile fetch failed during preload), falls back to the `allProfiles` map. Fixes "Unknown" display for current week.
- `useAllProfiles.ts`, `useAttendance.ts`, `useWarSetup.ts` — Added `Array.isArray` guards in all `localStorage` cache readers. Old cache format (from a previous session or version) was returned as-is and crashed `.filter()` / `.forEach()` on iOS where there is no in-memory cache on cold boot.

### Database / Security

Applied via Supabase migration (`fix_security_warnings_and_performance` + `revoke_public_execute_on_security_definer_functions`):

- `attendance_set_set_by()` — Added `SET search_path = ''` (fixes mutable search_path Supabase advisory). Revoked `EXECUTE` from `PUBLIC` — trigger functions must not be callable via REST API.
- `handle_new_user_profile()`, `rls_auto_enable()` — Revoked `EXECUTE` from `PUBLIC` entirely (internal trigger/utility functions).
- `verify_admin_pin`, `add_class_with_pin`, `set_management_level_with_pin`, `delete_user_with_pin`, `change_admin_pin` — Revoked `EXECUTE` from `PUBLIC`, re-granted to `authenticated` only.
- Added `idx_attendance_set_by` index on `attendance(set_by)` (unindexed FK column advisory).
- Dropped duplicate RLS policies `attendance_insert_own_or_management` and `attendance_update_own_or_management` (stale names left over from a previous rename to `_mgmt`; caused multiple permissive policies advisory).
- `schema.sql` updated to match all live DB changes and pushed to `main`.

### Deployment

- Built with Vite, deployed to GitHub Pages (`gh-pages` branch) — two deploys during this session.
- All source changes committed and pushed to `main` (final commit `9c4fb87`).
