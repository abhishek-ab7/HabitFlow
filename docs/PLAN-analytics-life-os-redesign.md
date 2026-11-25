# Implementation Plan: HabitFlow "Life OS Analytics" Complete Redesign (Habits + Finance + Fitness)

Redesign and re-architect the `/analytics` page (`src/app/analytics/page.tsx` and `src/components/analytics/*`) from a habit-only monolith (`AnalyticsPageContent.tsx`, ~71 KB) into a **10/10 mobile-first, multi-pillar "Life OS Analytics" hub** giving equal, first-class visual analytics to **Habits & Goals**, **Finance**, and **Fitness**, unified by a **Life OS Pulse** overview and cross-domain correlations.

**Confirmed Audit Grounding (Verified Against Current Codebase):**
- `src/components/analytics/AnalyticsPageContent.tsx` is `71,359` bytes (`1,476` lines) with circular exports in `src/components/analytics/index.ts`.
- Proven domain engines ready for direct reuse (zero logic duplication):
  - Habits & Goals: `src/lib/calculations/index.ts` (`calculateDailyStats`, `calculateCategoryBreakdown`, `generateHeatmapData`, `calculateCurrentStreak`, `calculateBestStreak`, `calculateGoalStats`, `calculateMomentum`)
  - Finance: `src/lib/finance/shared-analytics.ts` (`calculateNetWorthSummary`, `calculateMonthlySummary`, `calculateDebtSummary`, `calculateFriendLedgerGroups`, `calculateUpcomingFinancialObligations`), `src/lib/finance/anomalies.ts` (`detectSpendingAnomalies`), `src/lib/finance/forecast.ts` (`buildCashFlowForecast`), `src/lib/finance/credit-card-cycles.ts` (`computeCreditCardSummary`)
  - Fitness: `src/lib/fitness/shared-analytics.ts` (`calculate7DayRollingWeight`, `calculateWeeklyWaistTrend`, `calculateDailyFuelSummary`, `getProgressiveOverloadHint`, `calculateSupplementStockAndRoi`), `src/lib/fitness/finance-bridge.ts`, `src/components/fitness/BodyTrendCharts.tsx`
  - Intelligence & Settings: `src/lib/intelligence/cross-domain-insights.ts` (`computeCrossDomainInsights`), `src/lib/workspace-modules.ts` (`isFitnessModuleEnabled`, extended with `isFinanceModuleEnabled`), `src/lib/date-format.ts` (`formatHumanDate`, `formatMonthYear`), `src/lib/mcp/config.ts` (`getIstIsoDate`, `getIstMonthKey`).
- Test contracts to preserve throughout all phases: `src/components/analytics/__tests__/YearInReview.test.tsx` (`YearInReview` slides & `html2canvas-pro` export) and `src/components/__tests__/fitness-module-toggle.test.tsx`.

---

## Target Information Architecture & Layout System

### Sticky Top Control Header (Compact, Mobile-First)
- **Title Row (`PageHeader`):** `"Analytics"` with concise subtitle (`"Habits, money & body patterns in one view"`).
- **Unified Time Range Pill (`7D | 30D | 90D | Year`):** Single source of truth (`'7d' | '30d' | '90d' | 'year'`, default `'30d'`) passed to every pillar and correlation calculator, mapped cleanly to `TimeRange` (`'week' | 'month' | 'quarter' | 'year'`).
- **Primary Domain Tab Strip (Horizontal Snap-Scroll on Mobile, Centered Pill Track on Desktop):**
  1. `Pulse` (Unified Life OS Overview — default)
  2. `Habits` (Habits, Tasks & Goals)
  3. `Finance` *(hidden if `!isFinanceEnabled`)*
  4. `Fitness` *(hidden if `!isFitnessEnabled`)*
  5. `Review` (Weekly Review + Multi-Domain 2026 Wrapped)
- URL query param sync (`?tab=pulse|habits|finance|fitness|review&range=7d|30d|90d|year`).

### Global Design System Rules ("Calm Precision")
- **Card System:** `rounded-2xl border border-border bg-card p-4 sm:p-5` — zero nested card-inside-card clutter; max 1 subtle inset surface (`bg-muted/35 rounded-xl`).
- **KPI Grid Standard:** `grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5` (`AnalyticsKpiGrid`).
- **Typography:** Zero `font-mono` on prose labels or dates; `tabular-nums` strictly on numeric values (`₹`, `kg`, `kcal`, `%`, streaks); human-readable dates via `src/lib/date-format.ts`.
- **Chart Craft:** `debounce={150}` on `ResponsiveContainer`, explicit height (`190-220px` mobile / `240-260px` desktop), `minTickGap={28}`, theme-safe tooltips (`AnalyticsChartTooltip`), compact low-data states with 1-tap CTAs (`AnalyticsChartCard`).
- **Accessibility & Mobile Tabs:** Horizontal scrollable `role="tablist"` with `overflow-x-auto`, `scroll-snap-type: x proximity`, `flex-none` tabs, ARIA `aria-selected`, non-color active indicator, and `scrollIntoView` on active tab change.

---

## Phased Implementation Roadmap

### Phase 1: Pure Cross-Domain Aggregator, Shared Primitives & Thin Tab Shell
- Save confirmed plan to `docs/PLAN-analytics-life-os-redesign.md`.
- Add `isFinanceModuleEnabled` alongside `isFitnessModuleEnabled` in `src/lib/workspace-modules.ts`.
- Build `src/lib/analytics/life-os-aggregator.ts`: pure IST-aligned (`Asia/Kolkata`) aggregator uniting Habits, Goals, Tasks, Mood, Finance, Fitness, and Cross-Domain Correlations for `'7d' | '30d' | '90d' | 'year'` with dynamic Life OS Score re-normalization when Finance/Fitness are disabled.
- Write `src/lib/analytics/__tests__/life-os-aggregator.test.ts` testing empty states, disabled Finance/Fitness score normalization, date range slicing, IST boundaries, and correlation calculations.
- Build `src/components/analytics/shared/{AnalyticsKpiGrid,AnalyticsChartCard,AnalyticsChartTooltip}.tsx` and refactor `src/components/analytics/time-range-selector.tsx` to `7D | 30D | 90D | Year` pills (preserving backwards-compatible props).
- Refactor `src/components/analytics/AnalyticsPageContent.tsx` into a thin (< 10 KB) shell using `next/dynamic(..., { ssr: false })` + skeletons per tab, respecting `showFinance`, `showFitness`, `habitOnlyMode`, and URL query sync `?tab=` & `?range=`.

### Phase 2: `Pulse` Tab (Unified Life OS Overview + Promoted Correlations Hub)
- Implement `src/components/analytics/tabs/PulseAnalyticsTab.tsx`:
  - Composite Life OS Balance Hero Card with 3-pillar breakdown bar (Emerald = Habits, Cobalt = Finance, Orange = Fitness) + delta vs prior period.
  - 3 clickable Pillar Summary cards jumping directly to `Habits`, `Finance`, or `Fitness`.
  - Promoted visual Cross-Domain Correlations Hub (Mood/Sleep → Junk Spend, Habit Streaks → Outflow, Wallet × Waistline Guard, Gym & Supplement ROI) with comparison bars & 1-tap action buttons.
  - Unified prioritized Actionable Insights feed across all enabled domains.

### Phase 3: `Habits` Tab Redesign (Upgrade Legacy Charts + Fix Clutter)
- Implement `src/components/analytics/tabs/HabitsAnalyticsTab.tsx` integrating upgraded:
  - `consistency-chart.tsx`: `minTickGap={32}`, `debounce={150}`, daily vs 7d rolling average toggle, smart low-data state.
  - `category-breakdown.tsx`: compact horizontal progress bars replacing oversized 2-item donut.
  - `weekday-chart.tsx`: semantic bars with best/lowest day callouts.
  - `heatmap-calendar.tsx`: mobile-first 12-week right-aligned window with desktop full-year toggle.
  - Goal velocity strip + `PredictiveAnalytics.tsx` merged cleanly below.

### Phase 4: `Finance` Tab & `Fitness` Tab (First-Class Dedicated Analytics)
- Implement `src/components/analytics/tabs/FinanceAnalyticsTab.tsx`:
  - 2×2 KPI strip (`Total Spend`, `Net Cashflow / Savings Rate`, `Net Worth`, `Credit Utilization & Due`), Income/Spend/Investments trend chart, Category Spend & Budget Variance (`Pace | Donut` toggle reusing `OverviewCategoryDonut.tsx`), Needs vs Wants vs Junk/Dining stacked bar, Credit Card Dual-Cycle Utilization, 30-day Cashflow Runway + Anomalies, Friend Ledger summary, and cold-start Finance store hydration.
- Implement `src/components/analytics/tabs/FitnessAnalyticsTab.tsx`:
  - 2×2 KPI strip (`7-Day Weight Trend`, `Protein & Calorie Hit Rate`, `Workouts & Avg Steps`, `Avg Sleep & Energy`), Weight & Waist 7-day rolling trend (`BodyTrendCharts.tsx`), Big 2 Daily Calories & Protein adherence chart + Junk-Free streak, Gym workout frequency/split & overload progress, Steps/Sleep trends, Supplement ROI & low-stock card, and cold-start Fitness store hydration.

### Phase 5: `Review` Tab, Performance Audit & Responsive Verification
- Implement `src/components/analytics/tabs/ReviewAnalyticsTab.tsx` combining Weekly Reflection Digest and upgraded multi-domain `YearInReview.tsx` (Habits + Finance + Fitness Wrapped cards, keeping `YearInReview.test.tsx` green).
- Full verification pass: `AnalyticsPageContent.tsx` < 10 KB, per-tab lazy chunks verified via `npm run build`, `npx tsc --noEmit`, `npm test` 100%, and `390×844` / `1280×800` Light & Dark visual/overflow checks.
