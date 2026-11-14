# Guild War Manager — Performance & Reliability Review

**Scope:** runtime errors, out-of-memory (OOM) risk, memory leaks, slow loading, bundle weight, database access patterns, realtime behavior, and other reliability issues.

**Status:** initial review complete; all findings below were subsequently fixed in this working tree. See [Implementation status](#implementation-status) for the mapping.

**Bottom line:** no memory leak or OOM was reproduced at the current data volume (2,025 attendance rows, 68 members this week). JavaScript heap stayed flat across repeated tab cycles. The real risks are **growth-dependent** (unbounded queries/caches), **startup contention** (18 parallel data requests and 15-second fail-fast timeouts), and **cache correctness** (a partial attendance cache that silently empties the War Setup “Available” pool).

---

## Implementation status

All findings were addressed after the review (see the individual recommendations for detail).

| Finding | Fix applied | Where |
|---|---|---|
| H1 attendance cache poisoning | Cache version **v2** drops legacy entries; a single joined prefetch is shared with the hook; `ManagementPage` falls back to the profiles map | `src/hooks/useAttendance.ts`, `src/main.tsx`, `src/components/management/ManagementPage.tsx` |
| H2 response-log overload | Windowed query (**4 weeks default**, selector for 4/8/12/26/52), 1,000-row guard with warning, trimmed profile columns, on-demand load only (removed login preload), cache capped at 2 windows | `src/hooks/useAttendanceResponseLog.ts`, `src/components/management/ResponseLogPage.tsx`, `src/App.tsx` |
| H3 startup fan-out / timeouts | Removed seven eager preloads; war setup and guild events load per active tab; war reads retry once with a 25 s limit | `src/App.tsx`, `src/hooks/useWarSetup.ts` |
| H4 cache growth | Weekly caches older than 8 weeks are evicted on app start | `src/lib/cacheEviction.ts`, `src/main.tsx` |
| H5 bundle weight | Tabs are `React.lazy`; `xlsx` and `warExport` are dynamic imports. **Initial JS: 1,237 kB → ~468 kB total** (275 kB entry + 193 kB shared runtime); `kpiExcel` (425 kB) loads on demand | `src/App.tsx`, `src/components/kpi/KpiStatsPage.tsx`, `src/components/management/ManagementPage.tsx` |
| H6 export memory | Export scale is capped by a 16 M-pixel budget; uses `toBlob` + object URLs and releases canvases | `src/lib/warExport.ts` |
| H7 realtime amplification | League reloads debounced (300 ms); only one guild-event subscription active; App war-setup hook runs only on the League tab | `src/hooks/useLeagueBoard.ts`, `src/App.tsx` |
| H8 unhandled rejections | Replaced discarded `promise.finally()` with handled cleanup | `src/hooks/useAttendance.ts`, `src/hooks/useTrainingAttendance.ts` |
| H9 timeouts do not abort | `withDbTiming` aborts the request on timeout; all timed read queries pass the signal | `src/lib/dbTiming.ts` + read hooks |
| H10 drawing growth | Strokes capped at 500 points (loaded and saved) | `src/hooks/useLeagueBoard.ts` |
| H11 missing UPDATE policy | Added `war_parties_update_mgmt` and **verified live**: an authenticated management update on `war_parties` succeeded (no-op icon write, no RLS error). Patch file kept for other environments | `supabase/schema.sql`, `supabase/patch_war_parties_update.sql` |
| L1 duplicate requests | Removed the pre-React profile/class-catalog prefetch and duplicate attendance fetch | `src/main.tsx` |
| L2 timers | Cleared `withTimeout`, Sequence Memory, and KPI-entry timers | `src/hooks/useAuth.ts`, `src/components/kpi/SequenceMemory.tsx`, `src/components/kpi/KpiEntryModal.tsx` |
| L3 render cost | Response-log entries grouped once per player | `src/components/management/ResponseLogPage.tsx` |
| L4 avatars | `loading="lazy" decoding="async"` on all avatars | component-wide |
| L5 dead code | Removed `useConfetti` and the unused `StreakLeaderboard` component | deleted files |
| Extra notes | `guild_events` limited to 500; title caches respect TTL; Excel imports capped at 5 MB; production query logging silenced unless opted in | `useGuildEvents.ts`, `useTitles.ts`, `KpiStatsPage.tsx`, `dbTiming.ts` |

---

## 1. Environment & method

| Item | Value |
|---|---|
| Build | `npm run build` — 446 modules, TypeScript clean |
| Client bundle | **1,237 kB JS / 359 kB gzip**, **114 kB CSS / 17 kB gzip**, single JS chunk |
| Runtime | Production build served by `vite preview` (root-base build for local profiling), plus the dev server for authenticated page checks |
| Browser | Integrated Chromium; forced GC via CDP `HeapProfiler.collectGarbage` |
| Database | Supabase project used by the app; queries executed through the app session |

Limitations: measurements come from one desktop Chromium session on a variable local network, not production RUM or a low-end phone. Network-bound numbers (cold start) vary run to run; the structural findings do not depend on the exact milliseconds.

---

## 2. Severity summary

| # | Severity | Area | Finding | Confidence |
|---|---|---|---|---|
| H1 | 🔴 High | Cache correctness | Attendance cache is overwritten with rows **without profile joins**; managers see an empty “Available” pool | High |
| H2 | 🔴 High | DB / memory | Response-log loads the **entire attendance table**; 1,000-row cap silently truncates 2,025 rows; **824 kB** per load, preloaded for every manager at login | High |
| H3 | 🔴 High | Slow load / reliability | Login fires **18 REST requests**; 15 s fail-fast timeouts blank or stale screens (the mechanism behind war-setup reports) | High |
| H4 | 🟠 Medium | Growth | Weekly attendance snapshots are never evicted from `localStorage`; silent quota failures when full | High |
| H5 | 🟠 Medium | Bundle | Single **1.21 MB** chunk; `xlsx` is bundled into the initial payload; no route/tab splitting | High |
| H6 | 🟠 Medium | OOM risk | War-board PNG export allocates a **2× canvas (~40 MiB raw pixels)** plus base64 SVG/PNG strings | High |
| H7 | 🟠 Medium | Realtime load | Realtime handlers reload whole datasets per event; duplicate hook instances double work | Medium |
| H8 | 🟠 Medium | Error handling | `promise.finally(...)` cleanup produces **unhandled promise rejections** on timeout | High |
| H9 | 🟠 Medium | Network | `withDbTiming` timeouts do not abort the underlying request; timed-out queries keep running | High |
| H10 | 🟠 Medium | OOM risk | League drawings store unbounded point arrays and reload the full plan on every stroke event | Medium |
| H11 | 🟠 Medium | Correctness | No `UPDATE` RLS policy for `war_parties`; party-icon saves are rejected (optimistic UI hides it) | Medium |
| L1 | ⚪ Low | Startup | Duplicate cold-load requests (`attendance` ×3, `profiles` ×3, `class_catalog` ×2) | High |
| L2 | ⚪ Low | Timers | Several timers/timeouts are not cleared on unmount | Medium |
| L3 | ⚪ Low | Rendering | Response Log row grouping is O(players × entries) per render | Low |
| L4 | ⚪ Low | Assets | 60+ Discord avatars load eagerly; no `loading="lazy"` | Medium |
| L5 | ⚪ Low | Dead code | `useConfetti` and `StreakLeaderboard` are unused (no runtime cost) | High |

---

## 3. Findings

### H1 — Attendance cache poisoning empties the “Available” pool (High)

**Symptom:** on a normal page reload, managers can see all party members but the War Setup **Available** panel has zero members. The stat counter above it can still show the number of responses, which makes the page look inconsistent.

**Cause:** two different writers store data under the same key (`gwm_att_v1_<week>`):

1. [src/main.tsx](src/main.tsx#L23) prefetches attendance **before React mounts** and selects only base columns, then writes the result into the cache at [src/main.tsx](src/main.tsx#L44).
2. [src/hooks/useAttendance.ts](src/hooks/useAttendance.ts#L30) normally caches rows **with embedded `profile` and `set_by_profile`** objects.

Because the pre-React prefetch refreshes the cache timestamp (`at`), the hook treats the profile-less rows as fresh and skips its joined fetch ([src/hooks/useAttendance.ts](src/hooks/useAttendance.ts#L157)). [src/components/management/ManagementPage.tsx](src/components/management/ManagementPage.tsx#L83) builds `availableMembers` from `a.profile` only, so every row is dropped.

**Evidence (live session):**

- Cache contained **68 rows, 0 with `profile`**, sample keys `id,user_id,week_start,status,created_at,updated_at`.
- War Setup rendered **58 party draggables but 0 draggables in the Available panel**.
- No `attendance.rows` query ran after reload — the fresh-looking partial cache suppressed it.
- Repeating reloads re-poisoned the cache each time; an 11-minute-old cache was “refreshed” by the pre-React prefetch before the hook could revalidate.

**Impact:** management loses the only pool from which unassigned players can be dragged into parties. Statuses themselves are unaffected.

**Recommendation:** use a separate cache key for the lightweight prefetch, include the profile columns in it, or mark the entry as partial and make `useAttendance` always revalidate partial rows. As a defensive measure, resolve missing profiles from the profiles map in `ManagementPage` (the same fallback already used by [src/components/management/AttendanceList.tsx](src/components/management/AttendanceList.tsx#L27)).

---

### H2 — Response-log query is unbounded, truncated, and preloaded for every manager (High)

**Finding:** [src/hooks/useAttendanceResponseLog.ts](src/hooks/useAttendanceResponseLog.ts#L28) selects **every attendance row across all weeks**, joining two full profile objects per row, with no `.range()` or `.limit()`. PostgREST returns at most 1,000 rows by default, so the page silently sees only the first page.

**Evidence:**

| Measurement | Value |
|---|---|
| Attendance rows in table | **2,025** |
| Rows returned by the app query | **1,000** (silent truncation) |
| Payload | **824 kB** JSON |
| Query time (warm) | ~1.1 s; **>15 s** on a cold connection |
| Response Times tab observed | data visible within the 6 s observation window |
| DOM nodes | Attendance 966 → Response Times **2,075** |
| Heap after forced GC | Attendance 19.3 MB → Response Times **21.1 MB** (1.8 MB retained on the heavier page) |

**Preload cost:** [src/App.tsx](src/App.tsx#L121) calls `preloadAttendanceLog()` for every manager immediately after login. The cache is memory-only, so every full page reload downloads and parses the 824 kB again.

**Impact:** slow manager login, memory growth that scales with guild history, and an incomplete response-history page (older weeks silently missing). The row cap also affects any future unbounded `attendance` query (for example streak history).

**Recommendation:** paginate by week (`.range()` or `week_start` filter), default to the current + previous 4 weeks with a “load older” action, select only needed profile columns, and move the preload to the Response Times tab (on-demand) instead of login. Add an index-friendly ordering and a `count` query for totals.

---

### H3 — Login request fan-out plus 15 s fail-fast causes blank/stale screens (High)

**Finding:** after authentication, [src/App.tsx](src/App.tsx#L107-L113) starts seven preloads concurrently, plus the response-log preload for managers; `main.tsx` adds up to three more (attendance, profile, class catalog) before React mounts. Several of these fan out further.

**Measured cold-cache load (production build):**

- **18 REST requests** across 13 endpoints in the first 20 s:
  `attendance` ×3, `profiles` ×3, `class_catalog` ×2, `war_setups`, `war_groups`, `war_party_members`, `war_parties`, `guild_events`, `member_of_week`, `league_seasons`, `league_plans`, `get_kpi_public_board`, `get_kpi_profile`.
- 8 timed queries with **19.95 s of cumulative database time** (parallelized): `attendance.rows` 4.5 s, `profiles.fetch` 4.5 s, `profiles.all` 3.9 s, `war_setups` 3.9 s, party queries ~0.6 s each.
- Across the first two cold runs, **at least four startup queries hit the 15 s limit**: `attendance.rows`, `profiles.all`, `war_setups.byWeek`, `attendance.response_log` (and `profiles.fetch` on the later cold run).
- Warm-cache reload: **0 REST requests**, DCL 78 ms, LCP 136 ms.

`withDbTiming` rejects at 15 s ([src/lib/dbTiming.ts](src/lib/dbTiming.ts#L43)) but does not abort the fetch, so the browser keeps the slow request alive while the UI gives up. This is exactly the condition that produced the “Group A 0/30, no party slots” reports: a `war_parties` request that exceeded the limit used to be treated as an empty result and cached.

**Impact:** slow cold starts, intermittent empty panels, war-setup failures for users on slow mobile connections, and avoidable database load.

**Recommendation:** stagger preloads (current tab first, then likely-next tabs), remove non-critical eager preloads (`kpiBoard`, `leagueBoard`, `kpiProfile`, response log), add a retry with backoff for failed war/member reads, and pass an `AbortSignal` on timeout. Consider a 20–30 s limit for the first war-setup read.

**Related status:** the war-setup loader fix already present in the working tree (uncommitted at review time) removes the silent empty-cache write, purges poisoned caches, retries, and self-heals missing party slots. Runtime tests confirmed: a failed party request now shows an error + Retry and writes no empty board; a stale good cache survives the failure.

---

### H4 — Weekly attendance snapshots grow without eviction (Medium)

**Finding:** [src/hooks/useAttendance.ts](src/hooks/useAttendance.ts#L74) writes one `gwm_att_v1_<week>` entry per visited week to `localStorage` and never removes old weeks. Training attendance has an eviction routine ([src/hooks/useTrainingAttendance.ts](src/hooks/useTrainingAttendance.ts#L33)); weekly war attendance does not.

**Evidence:**

- Base-column entry: 68 rows = **16 kB** per week.
- Joined entry (the intended format): 68 rows = **61 kB** per week → **~3.1 MB per 52 weeks**.
- Current `localStorage`: 131 kB total in this session (`gwm_war_v1` 56 kB, `gwm_profiles_v1` 45 kB, `gwm_att_v1` 16 kB, others small).

**Impact:** over a year of week navigation, `localStorage` approaches the typical 5–10 MB quota. Writes then fail silently (`try/catch` in `persistWeek`), so caching and offline-friendly rendering degrade without any user feedback.

**Recommendation:** keep only the current week plus a small window (or an LRU cap of ~8 weeks) and prune older `gwm_att_v1_*`/`gwm_war_v1_*` keys on startup. Consider `sessionStorage` for data that only needs to survive reloads.

---

### H5 — Single 1.21 MB bundle with `xlsx` on the initial path (Medium)

**Finding:** `vite.config.ts` defines no chunking strategy ([vite.config.ts](vite.config.ts#L5)), and `xlsx` is imported statically through the KPI tab:

[src/components/kpi/KpiStatsPage.tsx](src/components/kpi/KpiStatsPage.tsx#L9) → [src/lib/kpiExcel.ts](src/lib/kpiExcel.ts#L1) → `xlsx`.

**Evidence:**

- One JS chunk: **1,237 kB minified / 359 kB gzip**.
- `SheetJS`/`sheet_to_json` symbols present in the main bundle.
- Build warning: `warExport.ts` is both dynamically and statically imported, so the dynamic import is ineffective.
- The whole KPI page (charts, games, Excel tooling) is imported by `App.tsx` at startup.

**Impact:** users download and parse KPI-only code on every first visit, including mobile users who only mark attendance. Excel parsing also runs on the main thread.

**Recommendation:** lazy-load KPI/League/Admin tabs with `React.lazy`, dynamically import `xlsx` only when the import dialog opens, add `manualChunks` for `react`/supabase and vendor code, and remove the ineffective dynamic import warning by importing `warExport` consistently. Add a file-size guard before `XLSX.read`.

---

### H6 — PNG export can allocate ~40 MiB+ of canvas memory (Medium)

**Finding:** [src/lib/warExport.ts](src/lib/warExport.ts#L12) clones the board, inlines ~50 computed style properties per element, serializes it to an SVG, base64-encodes it, renders it into a **2× canvas**, and returns `canvas.toDataURL('image/png')`.

**Measured board:** 754 × 3,499 CSS pixels. At 2×: 1,508 × 6,998 = **10.55 M pixels ≈ 40 MiB** for the raw canvas, plus the serialized SVG string, its base64 copy, and the PNG data URL. Wider or taller desktop boards increase this further.

**Impact:** the tab can freeze for seconds or crash on memory-constrained phones/tablets. There is no dimension or size guard, and the error fallback allocates its own full-size canvas.

**Recommendation:** cap export scale (1× above a pixel budget), reject or warn on very tall boards, use `canvas.toBlob()` with `URL.createObjectURL` and `revokeObjectURL`, avoid base64 where possible, and release canvases before resolving.

---

### H7 — Realtime handlers reload whole datasets; duplicate hook instances double the work (Medium)

**Finding:**

- [src/hooks/useLeagueBoard.ts](src/hooks/useLeagueBoard.ts#L197) refetches assignments, arrows, drawings, **and** party metadata (4 requests) for every change event on any of three tables ([src/hooks/useLeagueBoard.ts](src/hooks/useLeagueBoard.ts#L262)). The client’s own writes also trigger these events, with no debounce.
- `useWarSetup` is mounted twice: once in `App.tsx` for League icons and once in `ManagementPage`. Each instance opens its own channel and performs its own 4-query reload on every `war_party_members` event.
- `useGuildEvents` is likewise used by the App shell and the Calendar page.

**Impact:** a party swap or a few quick strokes can produce multiple full reloads per client and multiply database reads across all managers. This is acceptable at current guild size but scales poorly with simultaneous editors and with drawing frequency.

**Recommendation:** debounce reloads (200–500 ms), apply `payload.new` locally for simple updates, ignore events caused by the current client, and share one subscription per setup/plan at the app level. Fetch party metadata only when the plan changes, not on every event.

---

### H8 — Unhandled promise rejections from fetch-dedup cleanup (Medium)

**Finding:** [src/hooks/useAttendance.ts](src/hooks/useAttendance.ts#L53-L54) and [src/hooks/useTrainingAttendance.ts](src/hooks/useTrainingAttendance.ts#L109-L110) discard the promise returned by `promise.finally(...)`. When the request rejects (timeouts are common per H3), the `finally` chain rejects without a handler.

**Evidence:** the browser recorded a `pageError` with `Request timed out after 15000ms (attendance.rows week=2026-11-14)` while the same error was also logged by the caller.

**Impact:** unhandled-rejection noise, error-monitoring false positives, and potential process-level reporting in stricter environments. Functionally the caller still sees the rejection.

**Recommendation:** use `promise.then(cleanup, cleanup)` or attach a no-op catch to the cleanup chain; keep the original promise for callers.

---

### H9 — Timeouts do not abort the request (Medium)

**Finding:** `withDbTiming` races the query against a 15 s timer ([src/lib/dbTiming.ts](src/lib/dbTiming.ts#L33)), but the Supabase request continues after the race. Hooks also do not abort on unmount or week change.

**Impact:** timed-out heavy queries (notably the 824 kB response log and war setup) keep consuming connection slots and bandwidth; retries overlap with still-running requests. On a slow link this creates a self-reinforcing backlog.

**Recommendation:** create an `AbortController`, call `.abortSignal(signal)` on the Supabase builder, and abort on timeout/unmount/week change. Surface “timed out” distinctly from “permission denied”.

---

### H10 — League drawings and plan data are unbounded (Medium)

**Finding:** drawings are stored as arbitrary-length `{x,y}` arrays and loaded with `select('*')` for the whole plan; each render recomputes SVG paths for every stroke, and each new stroke triggers a full realtime reload.

**Impact:** long drawing sessions or many strokes make plan loads and renders progressively heavier; large point arrays inflate JSON payloads and memory.

**Recommendation:** cap/simplify points (e.g., distance threshold already used live, plus a maximum), store drawings compressed or as chunked rows, render only visible strokes, and debounce realtime reloads.

---

### H11 — Party icon updates are rejected by RLS (Medium, correctness)

**Finding:** `updatePartyIcon` performs an `UPDATE` on `war_parties` ([src/hooks/useWarSetup.ts](src/hooks/useWarSetup.ts#L671)), but [supabase/schema.sql](supabase/schema.sql#L243) defines only `SELECT`, `INSERT`, and `DELETE` policies for that table. With RLS enabled, no permissive `UPDATE` policy means the write is denied. The UI applies the change optimistically, so the failure is only visible in the console.

**Impact:** party icons never persist for anyone (unless production has drifted from `schema.sql`), and the League Board can show stale icons.

**Recommendation:** add a management-only `war_parties_update_mgmt` policy and a patch SQL file, mirroring the existing insert/delete policies. This is a database change, so it was not applied during a report-only review.

---

### Low-severity findings

| ID | Finding | Location | Recommendation |
|---|---|---|---|
| L1 | Cold load duplicates requests: `attendance` ×3, `profiles` ×3, `class_catalog` ×2 because `main.tsx`, preloads, and hooks each fetch | [src/main.tsx](src/main.tsx#L23), [src/App.tsx](src/App.tsx#L107) | Let one owner fetch per resource, or seed a shared promise from `main.tsx` |
| L2 | Timers not cleared: `withTimeout` timers, auth loading watchdog, nested `setTimeout`s in Sequence Memory/KPI entry | [src/hooks/useAuth.ts](src/hooks/useAuth.ts#L43), [src/components/kpi/SequenceMemory.tsx](src/components/kpi/SequenceMemory.tsx#L40) | Store and clear timers in cleanup |
| L3 | Response Log builds `otherWeeks` with `entries.filter` inside a per-player map | [src/components/management/ResponseLogPage.tsx](src/components/management/ResponseLogPage.tsx#L107) | Pre-group entries by `user_id` once per render |
| L4 | Avatars render eagerly (60+ remote images on Roster/War Setup) | [src/components/management/MemberCard.tsx](src/components/management/MemberCard.tsx#L51) | Add `loading="lazy"` and `decoding="async"` |
| L5 | `useConfetti` and `StreakLeaderboard` are unused | [src/hooks/useConfetti.ts](src/hooks/useConfetti.ts#L24), [src/components/streaks/StreakLeaderboard.tsx](src/components/streaks/StreakLeaderboard.tsx#L8) | Remove or wire up deliberately |

Additional notes:

- `useGuildEvents` selects all events with no limit ([src/hooks/useGuildEvents.ts](src/hooks/useGuildEvents.ts#L38)); growth is slow, but pagination by date is safer.
- `useAllTitles` refetches on every mount even with a fresh cache ([src/hooks/useTitles.ts](src/hooks/useTitles.ts#L97)).
- KPI Excel parsing has no file-size guard ([src/components/kpi/KpiStatsPage.tsx](src/components/kpi/KpiStatsPage.tsx#L323)).
- `recordTiming` logs every query with `console.info` in production; the 200-entry buffer is bounded, but the console noise is unnecessary.

---

## 4. Verified healthy (checked, no action needed)

- **No leak across tabs:** heap after forced GC was 7.6 MB → 9.6 → 9.8 → 9.8 MB across three full tab cycles; DOM nodes stabilized at 722–723. Growth is cache warm-up, not unbounded.
- **One realtime socket:** one WebSocket created/opened, zero closed, across all tabs — Supabase channels multiplex correctly.
- **Realtime cleanup:** every `supabase.channel` used by the audited hooks has an unsubscribe + `removeChannel` cleanup (`useAnnouncements`, `useAnnouncementReactions`, `useAttendance`, `useGuildEvents`, `useLeagueBoard`, `useMemberOfWeek`, `useTrainingAttendance`, `useWarSetup`, `useTrainingNotification`).
- **Game loops:** `SnakeGame`, `PongGame`, `AimTrainer`, `MemoryMatch`, and `ReactionTest` cancel their animation frames/intervals; no runaway loop found (only the nested Sequence Memory timeouts noted above).
- **Object URLs:** CSV and KPI workbooks revoke their blob URLs.
- **Warm start:** with populated caches, a reload makes **zero network requests** and renders in ~80 ms DCL / ~136 ms LCP locally.
- **Export/typing:** `npm run build` and TypeScript pass; chunk sizes are reproducible.

---

## 5. Recommended priority

**Priority 1 (correctness + biggest user impact)**

1. Fix the attendance cache contract (H1): separate partial prefetch data or force revalidation, plus a profile fallback in `ManagementPage`.
2. Replace the full response-log query with paginated, week-scoped loading and move its preload off the login path (H2, L1).
3. Reduce startup fan-out and stop 15 s timeouts from producing empty UI; abort timed-out requests (H3, H9).
4. Add the missing `war_parties` update policy (H11).

**Priority 2 (scalability)**

5. Add cache eviction for weekly attendance/war snapshots (H4).
6. Debounce realtime reloads and share subscriptions per setup/plan (H7, H10).
7. Cap PNG export dimensions and use `toBlob` (H6).

**Priority 3 (bundle + polish)**

8. Lazy-load KPI/League/Admin tabs and `xlsx`; add chunk splitting (H5).
9. Clean up timers, dead code, eager avatars, and duplicate fetches (L1–L5).

---

## Appendix A — Raw measurements

### Startup (production preview origin)

| Scenario | REST requests | DB time (timed queries) | Notable |
|---|---|---|---|
| First preview load (no caches) | 8 captured | 4 timed queries recorded, all ~15 s (errors) | Recorded timeouts: `profiles.all`, `war_setups.byWeek`, `attendance.response_log`, `profiles.fetch`; the console also reported an `attendance.rows` timeout. Later profile fetches succeeded at 5.3 s and 11.2 s |
| Cold-cache run after clearing `gwm_*` | 18 in 20 s | 19.95 s cumulative | No errors this run; slowest query 4.5 s |
| Warm-cache reload | 0 | 0 | DCL 78 ms, LCP 136 ms |

Cold-run slowest queries: `attendance.rows` 4,513 ms, `profiles.fetch` 4,462 ms, `war_setups.byWeek` 3,940 ms, `profiles.all` 3,874 ms, `attendance.response_log` 1,364 ms (warm), party queries 558–634 ms.

### Heap / DOM across tab cycles (production preview, forced GC)

| Point | Nodes | Heap | Long tasks | WebSocket |
|---|---|---|---|---|
| Baseline | 964 | 7.6 MB | 0 | 1 created / 1 open |
| Cycle 1 | 723 | 9.6 MB | 2 (125 ms) | unchanged |
| Cycle 2 | 722 | 9.8 MB | 2 (125 ms) | unchanged |
| Cycle 3 | 722 | 9.8 MB | 2 (125 ms) | unchanged |

### Heavy screens (dev origin)

| Page | Nodes | Heap after GC | Notes |
|---|---|---|---|
| Attendance baseline | 966 | 19.3 MB | — |
| Response Times | 2,075 | 21.1 MB | Data visible within the 6 s observation window; 1,000-row / 824 kB dataset |
| War Setup board | — | — | 754 × 3,499 px; 2× export canvas ≈ 40 MiB raw pixels |

### Cache volume

| Cache | Size |
|---|---|
| `gwm_war_v1_<week>` | 56 kB |
| `gwm_profiles_v1` | 45 kB |
| `gwm_att_v1_<week>` (base columns) | 16 kB/week |
| `gwm_att_v1_<week>` (joined profiles) | 61 kB/week → ~3.1 MB/year |
| Total `localStorage` (current session) | 131 kB |

### Data volume

| Table / query | Value |
|---|---|
| `attendance` rows | 2,025 |
| Response-log query returned | 1,000 (PostgREST default cap) |
| Current-week attendance rows | 68 |
| Current-week joined payload | 61 kB |

---

## Appendix B — Commands used

```powershell
npm run build                                                # production bundle + type checks
npx vite build --base=/                                      # root-base build for local preview
npm run preview -- --host 127.0.0.1 --port 4173 --base /     # serve the build
```

Runtime checks used Playwright against the preview/dev origins with `performance.memory`, `PerformanceObserver` (longtask/LCP), CDP `HeapProfiler.collectGarbage`, and request/response listeners. No production data was modified.
