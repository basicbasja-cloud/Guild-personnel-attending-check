# Patch Notes — July 8, 2026

---

## For Guild Members & Officers

### Bug Fixes — Training Attendance

- **✅ Join / ❌ Can't / 🤔 Maybe buttons now work reliably** — Previously, network glitches could leave buttons stuck in a loading state. Buttons now always reset properly, and expired login sessions auto-refresh behind the scenes.
- **🗂️ Your response stays visible after closing & reopening** — Before, closing the training attendance modal and reopening it could lose your selection even though the database saved it. This is now fixed: your response persists across page reloads, tab switches, and modal open/close cycles.
- **⏳ Loading spinner** — The modal now shows a spinner while attendance data loads so you know something is happening.
- **Real-time sync** — Training attendance changes now sync across open browser tabs in real time.

### New Features — Analytics Dashboard

- **📈 Training Trend Chart** — The War tab's weekly attendance trend chart is now also available on the **Training** tab, showing attendance grouped by ISO week.
- **🔍 Click a bar → class breakdown** — Click any bar in the training trend chart to see a class-by-class breakdown of who responded that week (e.g., how many Crusaders joined, how many Sorcerers can't make it).
- **📅 Toggle: 12 Weeks / All Time** — The War stats dashboard now has an **"All Time" toggle** that switches the stats cards and player table to show data from the entire program history (not just the last 12 weeks). The trend chart follows the toggle too.
- **👤 Per-player rates** — Each member's attendance rate is now calculated from **their first recorded join date** to present. Weeks before a member joined don't count against their rate anymore.
- **📊 Improved stats cards** — War tab now shows three clean summary cards: **Weeks (total)** since the program started (April 18, 2026), **Avg Join / Week**, and **≥60 Join Weeks**.

### For Technical People

- **Training attendance state sync overhaul** — `useTrainingAttendance` rewritten to match the proven `useAttendance` pattern: server-returned data on upsert, module-level cache sync, localStorage persistence, JWT expiry retry, and rollback on error.
- **SQL JOIN optimization** — Both `useAttendance` and `useTrainingAttendance` fetch hooks now use a single Supabase query with embedded joins instead of two sequential queries, cutting DB latency by ~50%.
- **Cache eviction** — Stale training attendance cache entries are automatically cleaned from memory and localStorage to prevent unbounded growth.
- **`WeeklyTrendChart` clickable bars** — New optional `onBarClick` prop enables per-bar click handlers.
- **Shared `OnBehalfSection` component** — The member search + status picker UI is now a single shared component used by both training and weekly attendance, eliminating ~160 lines of duplicated code.
- **Shared attendance constants** — `STATUS_CONFIG` and `STATUS_OPTIONS` extracted to `src/constants/attendance.ts`.
- **PlayerStatsDashboard optimizations** — Single DB query instead of two, per-player week tracking, all-time/12-week toggle, continuous week generation for chart axis, memoized `allTimeWeeks`.
- **Fixed pre-existing TS errors** in `AnnouncementsPage.tsx` (type mismatch on `onToggleReaction`) and `ClassBreakdownChart.tsx` (unused variables).

---

# Patch Notes — June 12, 2026

---

## For Guild Members & Officers

### New Features

- **🏋️ Training System** — A complete training event management system alongside the main war system:
  - **📅 Training Events** — Calendar now supports any event type (War, Training, Internal Event, etc.) via a flexible event type selector with presets + custom input
  - **📋 Training Attendance** — When a manager creates a training event, members can respond **Join ✅ / Can't Join ❌ / Maybe 🤔** just like war attendance. Opens in a dedicated modal from the calendar.
  - **⚔️ Training War Setup** — Training events have their own full-page war setup builder identical to the main war setup: drag-and-drop party builder, class distribution, available members (join/maybe), non-responded sidebar, substitutes board.
  - **🔔 Auto-Notifications** — Creating a training event auto-posts an announcement and shows a floating toast notification to all online managers.
  - **📊 Dashboard Summary** — Dashboard now has 3 tabs: **📊 Summary** (combined war×0.7 + training×0.3 active score), **⚔️ War** (individual), **🏋️ Training** (individual).
  - **🎯 Active Score** — A weighted score combining war attendance (70%) and training attendance (30%), shown in the Summary tab with visual progress bars.

### Bug Fixes

- **MotW Nomination** — Nominating a Member of the Week would silently fail if re-nominating for the same week (the `upsert` tried to UPDATE but no UPDATE RLS policy existed). Fixed by using delete-then-insert pattern and adding the missing UPDATE policy to the schema.

### For Technical People

- 6 new files: `useTrainingAttendance.ts`, `useTrainingNotification.ts`, `TrainingAttendanceModal.tsx`, `TrainingSetupModal.tsx`, `FloatingNotification.tsx`
- 7 existing files modified: `App.tsx`, `GuildCalendarPage.tsx`, `PlayerStatsDashboard.tsx`, `useGuildEvents.ts`, `useWarSetup.ts`, `types/index.ts`, `schema.sql`
- New Supabase table: `training_attendance` with full RLS policies, indexes, and set_by trigger
- `guild_events` — added `event_type` column (flexible text, no CHECK constraint)
- `war_setups` — added `type` and `event_id` columns with partial unique indexes; dropped old week_start UNIQUE constraint
- Training war setups reuse the same `war_setups`/`war_groups`/`war_parties`/`war_party_members` tables with `type='training'`
- Calendar event modal now supports any event type via preset buttons + custom text input
- Training notifications use Supabase realtime `INSERT` channel on `guild_events` filtered by `event_type='training'`

---

# Patch Notes — June 10, 2026

---

## For Guild Members & Officers

### New Features

- **Announcements Board 📢** — A new "Announcements" tab is now available for all members. Management can post guild-wide announcements with pin-to-top support. Announcements appear in real time to everyone — no refresh needed. Unread announcement counts show as a badge on the tab.

- **Member of the Week 🌟** — Officers can nominate a Member of the Week from the management panel. A gold-themed banner appears at the top of every page with the member's name, character, and reason for recognition.

- **Attendance Streaks 🔥** — Your consecutive weeks of joining wars are now tracked! Streak badges appear on your member card. Reach 5 → "Hot streak!", 10 → "On fire!", 15 → "Legendary!" with color shifts from amber to orange to red glow.

- **Title System 👑** — Earn titles through attendance milestones or get assigned by officers. Titles display on your member card in War Setup. You can choose which earned title to show from your Profile page. Built-in titles: Stalwart (🔥 5-week streak), Iron Will (⚡ 10-week), Legendary (💀 15-week), Centurion (🏛️ 100% attendance), and MVP (🌟 officer-awarded).

- **KPI Score Tier Animation 🗡️→👑** — The Your Performance section in KPI Stats now shows your score as an animated battle scene that progresses through ranks:
  - 🗡️ **Recruit** — Soldier trains on a dummy (score 0–1.5M)
  - ⚔️ **Warrior** — Two warriors clash on the battlefield (1.5M–3M)
  - 🛡️ **Knight** — Shielded defender stands guard (3M–5M)
  - 🐉 **Dragon Slayer** — Hero battles a fire-breathing dragon (5M–7M)
  - 👑 **Demon King** — Crowned victor stands over a defeated demon (7M+)
  
  Each scene has floating emoji, particle effects, and colored glow. A "RANK UP!" burst fires when you advance to the next tier.

- **Light/Dark Theme Toggle 🌗** — Click the sun/moon icon in the top-right header to switch between dark and light mode. Your preference is saved across sessions and devices. The theme respects your system preference on first visit.

### UI/UX Improvements

- **War Setup Drag Feedback** — Dragging members in War Setup now shows a scaled-up card (×1.08) with a drop shadow. Drop targets glow with a pulsing ring animation. The drop animation is smooth (200ms ease-out).

- **Notification Badges** — Tab navigation shows badge counts for unread announcements and new titles. Badges animate with a scale pulse when counts change.

- **Skeleton Loading** — Announcements show skeleton placeholders while loading, matching final card dimensions — no layout shift.

- **Confetti Celebrations 🎊** — A lightweight canvas confetti system fires celebrations on milestones (streak achievements, title earned, Member of the Week awarded). Non-blocking, auto-clears after 1.5s, max once per 3 seconds.

### For Technical People

- 17 new files across components, hooks, constants, and UI primitives
- 10 existing files modified (App.tsx, Header, ManagementPage, MemberCard, PartyCard, index.css, index.html, KpiPersonalCard, schema.sql, PatchNotes)
- 4 new Supabase tables: `announcements`, `titles`, `user_titles`, `member_of_week` with full RLS policies
- 5 seed titles inserted (Stalwart, Iron Will, Legendary, Centurion, MVP)
- Light theme uses Tailwind v4 CSS variable overrides to remap the entire palette
- All new hooks follow existing localStorage + in-memory cache pattern for instant loads
- Optimistic updates on all CRUD operations (announcements, titles, MotW nominations)

---

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
