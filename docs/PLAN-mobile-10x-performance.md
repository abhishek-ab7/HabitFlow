# HabitFlow — Comprehensive 7-Layer Mobile Performance Audit & 10/10 Optimization Plan

**Status:** Approved for Phased Execution (`/goal`)  
**Target:** 10/10 native, instantaneous, 60fps mobile PWA / Android WebView experience across Dashboard, Habits, Tasks, Goals, Finance, Fitness, Analytics, and Settings.

---

## 1. Baseline Diagnostics & Performance Scorecard

### 1.1 Verified Build, Test & TypeScript Baseline
| Diagnostic | Command | Measured Result |
|---|---|---|
| **Unit & RTL Test Suite** | `npm test` (`vitest run`) | **55 / 55 files passed — 401 / 401 tests passed** (42.41s) |
| **TypeScript Check** | `npx tsc --noEmit` | **0 errors** |
| **Production Build** | `npm run build` (`next build --webpack`, Next.js `16.4.6`) | **Compiled in 20.4s** (32/32 static pages; 113 static JS/CSS chunks totaling **1,297.5 KB gz / 4,571.5 KB raw**) |
| **Public Static Payload** | `public/` audit | **2.82 MB total** — includes **1.35 MB** dead `public/assets/aistudio/` (11 unreferenced files) + **1.08 MB** oversized PWA PNG icons (`icon-512.png` alone is **755.7 KB**) |
| **Lockfiles** | Root directory | Duplicate lockfiles committed: `package-lock.json` (**705 KB**, used by `vercel.json`) + `bun.lock` (**334 KB**) |

### 1.2 Exact Measured First Load JS per Route (Baseline)
Every route — including `/login` and `/` — initially loads **659.0 KB gz (2,253.5 KB raw)** across 41 shared chunks:
- `/`: **683.9 KB gz** (+24.9 KB route-only)
- `/login`: **665.4 KB gz** (+6.4 KB route-only)
- `/dashboard`: **659.2 KB gz** (+0.2 KB route-only — Dashboard code hoisted into shared chunk via `src/app/loading.tsx`)
- `/habits`: **695.9 KB gz** (+36.9 KB route-only)
- `/tasks`: **683.6 KB gz** (+24.6 KB route-only)
- `/goals`: **694.2 KB gz** (+35.3 KB route-only)
- `/settings`: **694.4 KB gz** (+35.4 KB route-only)
- `/fitness`: **817.4 KB gz** (+158.5 KB route-only; includes 128.5 KB gz Recharts)
- `/analytics`: **844.4 KB gz** (+185.4 KB route-only; 7 `next/dynamic` calls defeated by circular barrel)
- `/finance`: **886.9 KB gz** (+227.9 KB route-only; includes 128.5 KB gz Recharts + 63.9 KB gz page chunk)

### 1.3 7-Layer Baseline Scorecard (4.4 / 10)
1. **Bundle Weight & Code-Splitting:** 2.5 / 10
2. **React Re-Render Storms & Zustand Selectors:** 3.0 / 10
3. **Cold Start, Dexie Hydration & Sync Collisions:** 3.5 / 10
4. **Mobile Touch Responsiveness (INP), Scroll Jank & GPU/CSS:** 5.0 / 10
5. **Navigation Speed, App Router & Data Waterfalls:** 4.5 / 10
6. **Memory Leaks, Timers & Realtime Subscriptions:** 4.5 / 10
7. **PWA, Service Worker & Asset Hygiene:** 6.5 / 10

---

## 2. Target Performance Budgets (Definition of 10/10)

| Metric | Baseline | 10/10 Target Budget |
|---|---:|---:|
| **Shared RootLayout First Load JS (gz)** | 659.0 KB | **≤ 155 KB gz** |
| **`/dashboard` First Load JS (gz)** | 659.2 KB | **≤ 200 KB gz** |
| **`/habits`, `/tasks`, `/goals`, `/settings` (gz)** | 683.6–695.9 KB | **≤ 185–195 KB gz** |
| **`/finance`, `/fitness`, `/analytics` (gz)** | 817.4–886.9 KB | **≤ 200–220 KB gz** *(Recharts & modals async)* |
| **`/` & `/login` First Load JS (gz)** | 683.9 / 665.4 KB | **≤ 145 KB gz** |
| **Cold Start TTI (4× Mobile CPU, cached Dexie)** | ~3.5–5.5s | **≤ 1.2s** |
| **Interaction to Next Paint (INP — Habit/Task tap)** | 150–450 ms | **< 100 ms** |
| **Tab-to-Tab Switch Latency** | 300–800 ms *(with spinner flash)* | **< 100 ms** *(0 blank/spinner flashes)* |
| **Scroll Frame Rate** | 35–52 FPS | **Steady 60 FPS** |
| **Lighthouse Mobile Performance / TBT / CLS** | ~45–60 / >800ms / 0.08–0.18 | **≥ 90 / < 200ms / < 0.05** |
| **PWA Icons + Dead `public/` Assets** | 2.43 MB | **≤ 120 KB total icons, 0 dead files** |

---

## 3. Phased Implementation Plan (Phases 1 to 5)

### Zero-Regression Guardrails
- Preserve offline-first Dexie storage and additive schema migrations (no destructive data loss).
- Preserve Supabase vector-clock sync (`generationCounter`, `syncVersion`, `isDirty`, `deletedAt`) and keep `finance-sync.test.ts` + `sync-invariants.test.ts` green.
- Preserve all 6 custom themes, 7 accent overrides, and the `beforeInteractive` anti-FOUC script.
- Preserve HabitFlow MCP tool schemas, OAuth routes, and all 55 Vitest suites (401+ tests).

### Phase 1 — Quick Wins, PWA/Asset Compression, Config Hardening & Complete Cleanup
- Delete dead `public/assets/aistudio/` (1.35 MB), dead Next starter SVGs, duplicate `public/icon.svg`, and duplicate `bun.lock`.
- Compress `public/icons/icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `icon-maskable-*.png` (< 120 KB total).
- Update `public/manifest.json` branding colors (`#0b0d0e` / `#10b981`), PNG shortcuts, and remove relative `related_applications.url`.
- Harden `public/sw.js` (`habit-tracker-v4`, `event.waitUntil` SWR, `clients.claim` inside `waitUntil`, `response.type === 'basic'` + Content-Type checks, cache bounds) & `service-worker-registration.tsx` (prod guard + `isMounted` guard).
- Expand `next.config.ts` `optimizePackageImports` (`@dnd-kit/*`, `@radix-ui/*`, `sonner`) and remove genuinely unused deps (`use-sound`, `protobufjs`).
- Centralize `cleanup.ts` to cover all 27 Dexie tables (`bulkDelete` in transaction) + add `clearAllLocalData()` clearing all 27 Dexie tables & all HabitFlow `localStorage` keys; fix `SettingsPageContent.tsx:handleClearAllData` to clear all 13 Finance tables; add `creditCardStatements` to `migrateLocalDemoFinanceRecords`; clean up realtime/sync/stores on `signOut`.

### Phase 2 — Aggressive Code-Splitting & Lazy Mounting
- Fix `src/app/loading.tsx` barrel import (`DashboardCenterLoader` direct import).
- Remove unreachable dead modals & `useHabitStore()` from `MobileNav.tsx`; gate `MobileNav` & authenticated shell overlays so `/` and `/login` stay lean.
- Split `QuickCaptureModal` into thin <1 KB listener host + dynamic modal body; lazy-load `PomodoroFloating` UI & its `AddTransactionModal`, `ShortcutsModal`, `PWAInstallPrompt`.
- Dynamically split inactive Finance tabs (`ActivityTab`, `TrackersTab`, `AccountsTab`), 6 tracker sub-tabs, `SpendingTrendChart`, `OverviewTab` donut, and all Finance modals (`AddTransactionModal`, `MonthlyBudgetModal`, `SmsImportModal`, `AskFinancesDrawer`, `StatementHistoryModal`, `ReconcileStatementModal`, `PayCreditCardModal`, 6 debt modals) with conditional `{open && ...}` mounting.
- Dynamically split inactive Fitness tabs (`BodyTrendCharts`, `GymWorkoutTab`, `SupplementsRoiTab`, `RoutineAndQuitTab`).
- Fix `AnalyticsPageContent.tsx` circular barrel so all 7 `next/dynamic` chart/view chunks actually split.
- Dynamically split `DashboardTour`, `OnboardingWizard`, `WeeklyReviewWidget` modal, `HabitFormModal`/AI habit modals, `EisenhowerMatrix`/task modals/`chrono-node`, `GoalFormModal`/goal roadmap modals, `DataVaultCard`/`McpConnectionsCard`, and `LandingPage` `canvas-confetti`.

### Phase 3 — 60fps Rendering, Component Decomposition & Atomic Selectors
- Refactor `calculateBestStreak` from `O(365 × C²)` to `O(C)`; optimize `getCurrentStreaks()` to skip `calculateBestStreak`; memoize heavy `analytics-slice` selectors (`computeCreditCardSummary`, `getMonthlySummary`, `getNetWorthSummary`, `getUpcomingFinancialObligations`, `getSpendingAnomalies`); compute only active `chartMode` in `SpendingTrendChart`; precompute `GymWorkoutTab` overload hints.
- Decompose & `React.memo` `SortableHabitRow`, `TaskCard`, `GoalCard`, `FriendCard`, `CreditCardItem`, `MacroRing`:
  - Conditionally mount desktop OR mobile `HabitGrid`, hoist 31-per-row Popovers & modals to parent, pass per-habit completion Map.
  - Isolate Pomodoro 1-second `timeLeft` subscription into `<ActiveTaskTimerPill>` mounted only on the active task; pre-group `subtasksByParentId`; remove `TaskCard` `layout` & `repeat: Infinity` animation.
  - Move `GoalCard` `healthScore` calculation into modal child mounted only when open.
- Fix `ActivityTab` `onMouseEnter` hover storm, memoize filtered lists/maps, defer closed Report modal summaries, and add `@tanstack/react-virtual` / pagination + CSS `.cv-auto` (`content-visibility: auto`).
- Gate `@dnd-kit` `TouchSensor` behind explicit Reorder Mode on mobile; separate `EisenhowerMatrix` handle (`touch-none`) from `TaskCard` swipe.
- Memoize `SyncProvider`, `AuthProvider`, `ThemeProvider` context values; remove unused `useSync()` in `header.tsx`; move `isDataReady` to `useSyncStatusStore`.

### Phase 4 — Instant Cold Start, Route-Scoped Hydration, Dexie Indexing & Background Sync
- Remove hardcoded 1,500ms splash block & `<AnimatePresence mode="wait">` unmount in `AppStartupGate.tsx`.
- Add `hasLoaded` / `loadedForUserId` / in-flight dedupe across all Zustand stores; hydrate route-critical Dexie tables first on Frame 1 (`0ms` network wait), defer secondary stores & `syncEngine.syncAll()` to `requestIdleCallback` / post-paint idle.
- Fix `MoodCheckIn` range truncation, `FitnessPageContent` inverted guard, `/goals/[id]` sequential Supabase waterfall, and `/api/mcp/connections` sequential queries.
- Add Dexie v19 compound indexes (`[userId+isDirty]`, `[userId+date]`, `[userId+archived]`, `[userId+status]`, `toAccountId`, `paidStatementId`, `defaultCategoryId`, `[userId+slug]`).
- Batch Finance & Fitness sync Dexie writes (`db.transaction` + `bulkGet` + `bulkPut`), run `migrateOrphanedRecords` once per session using `userId` index, parallelize sync tiers, and update finance Zustand state optimistically instead of 35+ 13-table reloads.
- Remove 30s `duplicateCleanupInterval`, unify & throttle mobile resume syncs (60s cooldown + synchronous `syncLock`), deduplicate domain syncs in `debouncedSync()`, fix `online` queue mutex, remove duplicate `user_settings_realtime` channel, dispatch `habitflow-sync-complete`, defer `UnifiedAlertManager` scans, and clean up remaining timers/AudioContexts/`AbortController`s.

### Phase 5 — Mobile GPU/CSS Polish, Navigation Prefetching & Benchmark Verification
- Add `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` globally; switch `html, body` to `overflow-x: clip` + `overscroll-behavior-y: contain`; fix `[class*="overflow-x-"]` bug in `globals.css` & `MobileNav.tsx` restoring swipe navigation; replace `transition-all` with `transition-colors`/`transition-transform`; remove `backdrop-blur-*` from full-screen backdrops & floating pills.
- Strip staggered mount animations & `popLayout` on lists; convert width/height progress/expand animations to GPU `scaleX` & CSS Grid transitions.
- Fix all `390×844` horizontal overflow risks (`StatementHistoryModal`, `FinancePageContent`, `FriendsDebtSection`, `FriendCard`, `DashboardTour`, `HabitsPageContent`, `FitnessPageContent`) and CLS risks (`habit-overview`, banner skeletons).
- Convert `MobileNav` More drawer & Dashboard nav actions to `<Link>` for prefetching, fix Header `/` redirect bounce, and add `/dashboard` & `/tasks` `loading.tsx`.
- Run full automated regression (`npx tsc --noEmit`, `npm test`, `npm run build`), bundle comparison, and mobile audit verification.
