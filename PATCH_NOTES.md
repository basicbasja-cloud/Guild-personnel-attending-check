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
