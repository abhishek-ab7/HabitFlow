# Implementation Plan: Universal HabitFlow Remote MCP Server

**Canonical Production Base URL:** `https://habit-flow-ochre-two.vercel.app/`  
**Primary MCP Endpoint:** `https://habit-flow-ochre-two.vercel.app/api/mcp`  
**Repository Doc Location:** `docs/PLAN-habitflow-mcp.md`

> [!IMPORTANT]
> **User Review & Confirmed Product Decisions**
> The following decisions from our design alignment lock the scope of this plan:
> 1. **Full Editing with Safe Soft-Delete / Archive:** Every domain entity in HabitFlow supports full create, read, and update via MCP. Destructive operations (`archive`, `delete`, `settle_bucket`, `foreclose`) use soft-delete (`deleted_at`) or archival flags (`is_archived` / `status: 'archived'` / `is_active: false`) and **strictly require `confirm: true`** in the tool input.
> 2. **Consolidated Tool Surface (28 Tools):** Tools are grouped into 28 high-signal domain tools (plus 6 MCP Resources and 4 MCP Prompts) rather than 50+ single-purpose endpoints, keeping LLM tool-selection accuracy high while enabling complete editing across Habits, Completions, Tasks/Subtasks, Goals/Milestones, Mood Logs, User Settings, and every Finance module.
> 3. **Tier 1 Secret Management via Vercel Environment Variables Only:** Personal fast-track auth uses server-only Vercel environment variables (`HABITFLOW_MCP_SECRET`, `HABITFLOW_MCP_USER_ID`, `SUPABASE_SERVICE_ROLE_KEY`). No static API keys are stored in Supabase. The Settings UI provides copyable endpoint URLs, client config snippets, a client-side random secret generator helper (to paste into Vercel), OAuth app revocation, and live redacted audit logs.
> 4. **Full 4-Phase Delivery Scope:** Upon approval, implementation will execute all 4 phases end-to-end, including Phase 4 OAuth 2.1 (`PKCE S256`, RFC 9728, RFC 8707, CIMD with SSRF guardrails + DCR fallback, and granular scopes).

---

## 1. Codebase Audit Findings

A thorough read-only audit of the HabitFlow repository established the exact runtime constraints, schema realities, reusable calculators, and sync invariants that this MCP server must honor.

### 1.1 Runtime, Build & Dependencies
- **Framework:** Next.js `^16.2.6` (App Router), React `19.2.3`, TypeScript `^5` (`package.json`).
- **Build & Deployment:** `next.config.ts` sets `output: 'standalone'`; `package.json` builds with `next build --webpack`; `vercel.json` runs `npm install --legacy-peer-deps`.
- **Installed MCP Packages:** `mcp-handler` (v2), `@modelcontextprotocol/sdk` (matching `mcp-handler` v2 peer requirements), and `zod` (`package.json`).
- **Testing Stack:** Primary test script is `vitest run` (`npm test`), alongside Jest devDependencies (`jest.config.js`). New MCP unit/integration tests will be written in Vitest so `npm test` verifies all MCP logic directly.
- **Rate Limiter (`src/lib/security/rate-limit.ts`):** Already implements dual-mode sliding-window limiting using Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`, prefix `habitflow:rl`) when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are present, gracefully falling back to an in-memory `Map` locally. Currently keys on `rl:${ip}:${path}`; for MCP we will extend/wrap it to key on `mcp:${userId}:${tier}` (`read` vs `write` vs `oauth`).

### 1.2 Middleware & Auth Routing (`src/middleware.ts`)
- Current `config.matcher` is `'/((?!_next|favicon\\.ico|api).*)'`.
- **Good news:** `/api/mcp` and `/api/oauth/*` are already excluded from browser login redirects.
- **Critical Gap Found:** `/.well-known/*` is **NOT** excluded! Any external MCP client probing `https://habit-flow-ochre-two.vercel.app/.well-known/oauth-protected-resource` or `/.well-known/oauth-authorization-server` would currently be intercepted by middleware and redirected `307` to `/login?redirectedFrom=...`, breaking OAuth discovery.
- **Required Fix:** Update `src/middleware.ts` `config.matcher` to exclude `\\.well-known` (`'/((?!_next|favicon\\.ico|api|\\.well-known).*)'`) and add `/.well-known` to `publicRoutes`. Ensure `/oauth/authorize` lets unauthenticated browser users redirect cleanly to `/login?redirectedFrom=<encoded /oauth/authorize?...>` and return directly to the consent screen after sign-in.

### 1.3 Supabase Access & Schema Realities
- `src/lib/supabase/server.ts` only exposes a cookie-based `createServerSupabaseClient()` using `NEXT_PUBLIC_SUPABASE_ANON_KEY`. MCP endpoints receive Bearer tokens instead of browser cookies, so we must add a dedicated server-only `src/lib/mcp/supabase-admin.ts` initialized with `SUPABASE_SERVICE_ROLE_KEY` (`persistSession: false`, `autoRefreshToken: false`) where **every single query explicitly enforces `.eq('user_id', ctx.userId)`**.
- **Schema Drift Warning:** `src/lib/supabase/types.ts` is behind several migrations (`20261119_add_finance_module.sql`, `20261120_habit_v2_and_finance_v3.sql`, `20261121_add_credit_card_statements.sql`, `20261121_per_friend_isolated_ledgers.sql`, `20261123_add_task_notes.sql`). The MCP server must type against the authoritative migration schemas rather than stale generated types:
  - **Core tables:** `habits`, `completions` (unique `(habit_id, date)`), `tasks` (includes `notes`, `parent_task_id`, `depth`, `is_urgent`, `is_important`, `metadata`), `goals` (`category` maps to `areaOfLife`, `target_date` maps to `deadline`, `is_focus` enforces max 2 focus goals), `milestones`, `mood_logs`, `user_settings`.
  - **Finance tables (all support `deleted_at`, `generation_counter`, `created_at`, `updated_at`):** `finance_accounts`, `finance_categories`, `finance_transactions`, `finance_budgets` (unique `(user_id, month_key)`), `credit_card_statements` (**TEXT `id`** formatted `${accountId}_${cycleKey}`, unique `(user_id, account_id, cycle_key)`), `debt_records` (`bucket_type`: `'everyday_split' | 'long_term_loan'`), `debt_installments`, `emi_trackers`, `finance_sip_plans`, `finance_recurring_bills`, `monthly_commitments`, `finance_categorization_rules`, `finance_net_worth_snapshots` (unique `(user_id, month_key)`).

### 1.4 Critical Offline-First Sync Invariants (`src/lib/db.ts` & `src/lib/sync/engines/*`)
1. **Silent-Drop Vector Clock Trigger (`supabase/migrations/20260601_logical_vector_clocks.sql`):**
   - A `BEFORE UPDATE` trigger `increment_generation_clock_vector()` is active on `user_settings`, `habits`, `completions`, `goals`, `milestones`, `tasks`, and `mood_logs`.
   - **If `NEW.generation_counter <= OLD.generation_counter`, PostgreSQL silently discards the update (`RETURN OLD;`) without throwing an error!**
   - Therefore, every MCP `UPDATE` must read the current row (or apply atomic increment) and write `generation_counter: (existing.generation_counter ?? 0) + 1` plus `updated_at: nowIso`.
2. **Client Dexie Pull Acceptance Rules:**
   - Core sync engines pull via `.gt('updated_at', lastPushedTimestamp)` and overwrite Dexie only if `!local || remote.generation_counter > local.generationCounter`.
   - Finance sync engines pull user rows and apply via `shouldApplyRemote(local, remote)` (`remoteGen > localGen || (remoteGen === localGen && remote.updated_at > local.updatedAt)`).
   - Bumping `generation_counter` by `+1` and writing a fresh ISO `updated_at` guarantees mobile/web Dexie clients immediately converge on every MCP edit.
3. **IST Timezone Hazard on Vercel:**
   - Existing `getLocalIsoDate()` relies on local JS `Date.getFullYear()/getMonth()/getDate()`, which evaluates to **UTC** on Vercel serverless functions—causing off-by-one dates between 00:00 and 05:30 IST.
   - All MCP tools will use a shared `getIstIsoDate()` helper (`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })`) and pass explicit IST dates into all calculators.

### 1.5 Reusable Server-Safe Pure Domain Calculators
- **Ready to import directly on the server (zero Dexie/DOM imports):**
  - `src/lib/finance/credit-card-cycles.ts`: `computeCreditCardSummary`, `resolveTransactionCycle`, `allocatePaymentToStatements`, `getCycleWindowForMonth`, `getActiveUnbilledCycle`, `daysBetween`, `roundCurrency`.
  - `src/lib/calculations/index.ts`: `calculateHabitStats`, `getHabitWeekProgress`, `calculateCurrentStreak`, `calculateWeeklyStreak`, `calculateGoalStats`, `calculateDailyStats`, `calculateCategoryBreakdown`.
  - `src/lib/finance/anomalies.ts`: `detectSpendingAnomalies`, `buildFinanceQAContext`.
  - `src/lib/finance/forecast.ts`: `buildCashFlowForecast` (we will add an optional `referenceDate?: string` parameter defaulting to today so MCP passes IST date cleanly).
- **Extract to Shared Pure Helpers (`src/lib/finance/shared-analytics.ts`):**
  - Pure aggregation routines currently inside Zustand `src/lib/stores/finance/analytics-slice.ts` (`getFriendLedgerGroups`, `getMonthlySummary`, `getNetWorthSummary`, `getUpcomingFinancialObligations`) will be extracted into a framework-agnostic module imported by both the Zustand store and MCP tools so UI and AI always report identical rupees and balances.

---

## 2. System Architecture Diagram

```text
+--------------------------------------------------------------------------------------+
|                          UNIVERSAL MCP CLIENTS (External)                            |
|  Gemini App (Dev Mode) | Claude Desktop / Code | Cursor | Antigravity | Inspector    |
|  Native Streamable HTTP  <---- or ---->  mcp-remote stdio bridge (legacy clients)    |
+------------------------------------------+-------------------------------------------+
                                           | HTTPS (JSON-RPC 2.0 / Streamable HTTP)
                                           v
+--------------------------------------------------------------------------------------+
|          VERCEL NEXT.JS 16 APP ROUTER  (https://habit-flow-ochre-two.vercel.app)     |
|                                                                                      |
|  Discovery & OAuth 2.1 Routes (Bypass Middleware Redirects):                         |
|   - GET  /.well-known/oauth-protected-resource  (RFC 9728 PRM -> resource + scopes)  |
|   - GET  /.well-known/oauth-authorization-server (OAuth 2.1 AS Metadata + CIMD)      |
|   - GET/POST /oauth/authorize                   (Supabase-logged-in Consent UI)      |
|   - POST /api/oauth/register                    (Dynamic Client Registration)        |
|   - POST /api/oauth/token                       (PKCE S256 + RFC 8707 aud binding)   |
|   - POST /api/oauth/revoke                      (Token Revocation)                   |
|                                                                                      |
|  Primary Stateless MCP Endpoint:                                                     |
|   - GET/POST/DELETE/OPTIONS /api/mcp            (mcp-handler v2 + @modelcontext...)  |
|   - Optional path-token fallback /api/mcp/[token] (strictly validated -> same core)  |
+------------------------------------------+-------------------------------------------+
                                           |
                                           v
+--------------------------------------------------------------------------------------+
|                     SECURITY, AUTH & OBSERVABILITY PIPELINE                          |
|  1. CORS Validator (Strict origin allowlist; never '*' with credentials)             |
|  2. Dual-Tier Auth Resolver:                                                         |
|     - Tier 1: Timing-safe Bearer/Path token == HABITFLOW_MCP_SECRET                  |
|               -> resolves single owner HABITFLOW_MCP_USER_ID (all scopes)            |
|     - Tier 2: OAuth 2.1 Bearer access token -> SHA-256 lookup in mcp_oauth_tokens    |
|               -> verifies expiry, revocation, RFC 8707 resource/aud, & tool scope    |
|     - Missing/invalid -> HTTP 401 + WWW-Authenticate (PRM URL)                       |
|     - Insufficient scope -> HTTP 403 + WWW-Authenticate (required scope)             |
|  3. Rate Limiter (Upstash Redis / in-memory fallback, keyed by userId + read/write)  |
|  4. Zod Input Validation + Confirm-Flag Guardrail + Redacted Audit Logger            |
+------------------------------------------+-------------------------------------------+
                                           |
                                           v
+--------------------------------------------------------------------------------------+
|                   CONSOLIDATED DOMAIN LAYER  (src/lib/mcp/*)                         |
|  - 28 Consolidated Tools (Habits, Tasks, Goals, Mood, Settings, Finance, CC, Debts)  |
|  - 6 MCP Resources (habitflow://today, habits, goals, finance/*, friends/ledger)     |
|  - 4 MCP Prompts (daily_planning, evening_review, finance_audit, friend_settle)      |
|  - Pure Server-Safe Calculators (IST clock, CC dual-cycle, habit streaks, forecast)  |
|  - Sync Mutation Helper (atomic UUID + generation_counter + 1 + ISO updated_at)      |
+------------------------------------------+-------------------------------------------+
                                           | Service Role (ALWAYS .eq('user_id', uid))
                                           v
+--------------------------------------------------------------------------------------+
|                            SUPABASE POSTGRESQL + REALTIME                            |
|  Core Tables | Finance Tables | mcp_audit_logs | mcp_oauth_clients/codes/tokens      |
|  BEFORE UPDATE trigger: increment_generation_clock_vector() satisfied on every write |
+------------------------------------------+-------------------------------------------+
                                           | Supabase Realtime & Delta Pull Sync
                                           v
+--------------------------------------------------------------------------------------+
|                     HABITFLOW MOBILE & WEB CLIENTS (Dexie IndexedDB)                 |
|  Instant convergence on phone/desktop: remote.generation_counter > local -> applied  |
+--------------------------------------------------------------------------------------+
```

---

## 3. Complete File & Folder Blueprint

All new modules are cleanly isolated under `src/lib/mcp/` and dedicated App Router route groups, leaving existing UI routes untouched aside from targeted middleware, pure-helper extraction, and the Settings UI card.

```text
docs/
  PLAN-habitflow-mcp.md                       # Saved copy of this approved plan

supabase/migrations/
  20261124_add_mcp_audit_and_oauth.sql        # mcp_audit_logs, mcp_oauth_clients,
                                              # mcp_oauth_codes, mcp_oauth_tokens + RLS

src/
  middleware.ts                               # Exclude /.well-known from login redirect

  lib/
    finance/
      forecast.ts                             # Add optional IST referenceDate parameter
      shared-analytics.ts                     # Pure extracted helpers (friend ledger,
                                              # monthly summary, net worth, obligations)
    mcp/
      config.ts                               # Canonical base URL, scopes, CORS allowlist,
                                              # env var getters, IST date/month helpers
      supabase-admin.ts                       # Server-only Service Role client + scoped helpers
      sync-helpers.ts                         # generation_counter+1, updated_at, soft-delete,
                                              # account balance delta & CC waterfall helpers
      auth.ts                                 # Tier 1 timing-safe Bearer + Tier 2 OAuth verifier,
                                              # 401/403 WWW-Authenticate challenge builders
      oauth.ts                                # PKCE S256 verifier, CIMD HTTPS+SSRF fetcher,
                                              # DCR registration, auth code & token lifecycle
      rate-limit.ts                           # Per-user MCP read/write/oauth rate limit wrapper
      audit.ts                                # Redacted audit log writer (mcp_audit_logs)
      server.ts                               # Registers all 28 tools, 6 resources, 4 prompts
      tools/
        briefing-insights.ts                  # get_daily_briefing, get_habit_finance_insights
        habits.ts                             # get_habits, manage_habit, log_habit_completion
        tasks.ts                              # get_tasks, manage_task
        goals.ts                              # get_goals, manage_goal, manage_milestone
        mood-settings.ts                      # manage_mood, get_user_settings, update_user_settings
        finance-core.ts                       # get_finance_overview, manage_finance_account,
                                              # manage_finance_category, manage_finance_budget,
                                              # manage_net_worth_snapshot
        finance-transactions.ts               # get_transactions, manage_transaction
        finance-credit-cards.ts               # get_credit_card_cycles, manage_credit_card_statement
        finance-friends.ts                    # get_friend_ledgers, manage_friend_debt
        finance-obligations.ts                # manage_recurring_bill, manage_emi,
                                              # manage_sip_plan, manage_monthly_commitment
      resources.ts                            # 6 live habitflow:// MCP resources
      prompts.ts                              # 4 reusable MCP workflow prompts
      __tests__/
        auth-and-oauth.test.ts                # Tier 1, PKCE S256, RFC 8707, CIMD SSRF, 401/403
        sync-invariants.test.ts               # generation_counter+1, IST dates, confirm guard
        finance-mutations.test.ts             # Balance deltas, CC single-target waterfall, splits

  app/
    api/
      mcp/
        route.ts                              # Primary Streamable HTTP handler (GET/POST/DELETE/OPTIONS)
        [token]/route.ts                      # Optional secret-path-token fallback (Tier 1 only)
        connections/route.ts                  # Authenticated UI API for Settings panel (audit logs,
                                              # connected OAuth apps, revoke app)
      oauth/
        register/route.ts                     # Dynamic Client Registration (RFC 7591)
        token/route.ts                        # Token exchange + refresh (PKCE S256 + RFC 8707)
        revoke/route.ts                       # Token revocation (RFC 7009)
    .well-known/
      oauth-protected-resource/route.ts       # RFC 9728 Protected Resource Metadata
      oauth-authorization-server/route.ts     # RFC 8414 OAuth 2.1 Authorization Server Metadata
    oauth/
      authorize/page.tsx                      # Interactive OAuth 2.1 Consent Screen (App UI)
      authorize/actions.ts                    # Server Action issuing single-use PKCE auth code

  components/
    settings/
      SettingsPageContent.tsx                 # Mounts McpConnectionsCard in Settings
      McpConnectionsCard.tsx                  # Copyable URL/configs, local token generator helper,
                                              # OAuth connected apps list/revoke, audit log table
```

---

## 4. Full Tool, Resource & Prompt Specification Table

### 4.1 Scope Definitions
| Scope | Granted Capabilities |
| :--- | :--- |
| `habitflow:read` | Read habits, completions, tasks, goals, milestones, mood, user settings, and non-finance parts of daily briefing. |
| `habitflow:write` | Create, update, toggle, and soft-delete/archive habits, completions, tasks, goals, milestones, mood, and editable user settings. |
| `habitflow:finance:read` | Read finance overview, accounts, categories, budgets, transactions, credit card cycles, friend ledgers, bills, EMIs, SIPs, commitments, and net worth snapshots. |
| `habitflow:finance:write` | Create, update, pay, split, reconcile, and soft-delete/archive any finance record, account balance, statement, debt, bill, EMI, SIP, commitment, or categorization rule. |

*(Tier 1 Vercel env-secret auth grants all 4 scopes to `HABITFLOW_MCP_USER_ID`. Every tool returns a compact structured JSON payload alongside a concise plain-text summary so LLMs parse exact IDs cleanly without wasting context tokens.)*

### 4.2 Consolidated MCP Tools (28 Tools — Full Read & Full Edit Coverage)

| # | Tool Name | Domain | Operations (`action` / Inputs via Zod) | Annotations (`R/D/I`) | Required Scope | Return Payload Shape |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `get_daily_briefing` | Cross-Domain | `{ date?: YYYY-MM-DD (IST default), includeFinance?: boolean }` | `R:true, D:false, I:true` | `habitflow:read` (+ `finance:read` if finance included) | `{ dateIst, habitsDue, tasksDueAndOverdue, focusGoals, todayMood, financeSnapshot?, upcomingObligations? }` |
| 2 | `get_habit_finance_insights` | Cross-Domain | `{ days?: 14..90, monthKey?: YYYY-MM }` | `R:true, D:false, I:true` | `habitflow:read` + `habitflow:finance:read` | `{ spendingAnomalies, cashFlowForecast30d, moodVsSpendCorrelation, habitConsistencyVsBudget }` |
| 3 | `get_habits` | Habits | `{ includeArchived?: boolean, category?: string, date?: YYYY-MM-DD, historyDays?: 7..90 }` | `R:true, D:false, I:true` | `habitflow:read` | `{ dateIst, habits: [{ id, name, frequencyType, streak, weekProgress, todayStatus, value, targetValue, unit }] }` |
| 4 | `manage_habit` | Habits | `action: 'create' \| 'update' \| 'archive' \| 'restore'`; full habit fields (`name, description, icon, color, category, target_days, frequency_type, scheduled_days, interval_days, allow_bonus_completions, auto_track_rule, is_quantitative, target_value, unit, order_index`); `confirm?: true` required for `archive` | `R:false, D:true (archive), I:false` | `habitflow:write` | `{ action, habit, generationCounter }` |
| 5 | `log_habit_completion` | Habits | `{ habitId, date?: YYYY-MM-DD (IST), status: 'completed' \| 'uncompleted' \| 'rest' \| 'frozen', value?: number, restReason?: string, notes?: string }` | `R:false, D:false, I:true` | `habitflow:write` | `{ completion, updatedStreak, weekProgress }` |
| 6 | `get_tasks` | Tasks | `{ status?: 'todo' \| 'in_progress' \| 'done' \| 'archived' \| 'all', priority?, dueBefore?, dueAfter?, goalId?, parentTaskId?, tag?, search? }` | `R:true, D:false, I:true` | `habitflow:read` | `{ count, tasks: [{ id, title, status, priority, dueDate, notes, tags, parentTaskId, subtasksCount, isUrgent, isImportant }] }` |
| 7 | `manage_task` | Tasks | `action: 'create' \| 'update' \| 'toggle_status' \| 'archive' \| 'restore'`; full task/subtask fields (`title, description, notes, status, priority, due_date, goal_id, parent_task_id, tags, recurrence_rule, estimated_time, actual_time, is_urgent, is_important, metadata`); `archive` cascades to subtasks & requires `confirm: true` | `R:false, D:true (archive), I:false` | `habitflow:write` | `{ action, task, affectedSubtaskIds? }` |
| 8 | `get_goals` | Goals | `{ includeArchived?: boolean, status?, focusOnly?: boolean, category? }` | `R:true, D:false, I:true` | `habitflow:read` | `{ goals: [{ id, title, category, status, progress, targetDate, isFocus, milestones }] }` |
| 9 | `manage_goal` | Goals | `action: 'create' \| 'update' \| 'set_focus' \| 'archive' \| 'restore'`; fields (`title, description, category, priority, status, target_date, progress, is_focus`); enforces max 2 active focus goals; `archive` requires `confirm: true` | `R:false, D:true (archive), I:false` | `habitflow:write` | `{ action, goal, activeFocusCount }` |
| 10 | `manage_milestone` | Goals | `action: 'create' \| 'update' \| 'toggle_complete' \| 'delete'`; `{ goalId, milestoneId?, title?, isCompleted?, orderIndex?, confirm?: true }`; recalculates parent goal `progress` | `R:false, D:true (delete), I:false` | `habitflow:write` | `{ action, milestone, updatedGoalProgress }` |
| 11 | `manage_mood` | Mood | `action: 'list' \| 'log'`; `{ date?: YYYY-MM-DD (IST), startDate?, endDate?, mood?: 'great' \| 'good' \| 'okay' \| 'low' \| 'bad' \| string }` | `R:false, D:false, I:true` | `habitflow:read` (`list`) / `habitflow:write` (`log`) | `{ action, entry?, history? }` |
| 12 | `get_user_settings` | Settings | `{}` | `R:true, D:false, I:true` | `habitflow:read` | `{ userName, avatarId, weekStartDay, defaultCategory, accent, motivationText, dashboardLayout, gamification: { xp, level, gems, streakShield } }` |
| 13 | `update_user_settings` | Settings | `{ userName?, avatarId?, weekStartDay?, defaultCategory?, accent?, motivationText?, dashboardLayout? }` (excludes raw XP/gems tampering) | `R:false, D:false, I:true` | `habitflow:write` | `{ updatedFields, settings }` |
| 14 | `get_finance_overview` | Finance Core | `{ monthKey?: YYYY-MM (IST default), includeForecast?: boolean, includeAnomalies?: boolean }` | `R:true, D:false, I:true` | `habitflow:finance:read` | `{ monthKey, income, expenses, investments, netSavings, budgetPace, categoryBreakdown, netWorth, upcomingObligations, forecast?, anomalies? }` |
| 15 | `manage_finance_account` | Finance Core | `action: 'list' \| 'create' \| 'update' \| 'reconcile_balance' \| 'archive' \| 'restore'`; full fields (`name, type, balance, credit_limit, statement_day, due_day, grace_period_days, include_in_net_worth, currency, is_default, icon, color`); `archive` requires `confirm: true` | `R:false, D:true (archive), I:false` | `finance:read` (`list`) / `finance:write` | `{ action, account?, accounts? }` |
| 16 | `manage_finance_category` | Finance Core | `action: 'list' \| 'create' \| 'update' \| 'archive' \| 'list_rules' \| 'upsert_rule' \| 'delete_rule'`; full category & auto-categorization rule editing; `archive`/`delete_rule` requires `confirm: true` (blocks system categories) | `R:false, D:true (archive/delete), I:false` | `finance:read` / `finance:write` | `{ action, category?, categories?, rule?, rules? }` |
| 17 | `manage_finance_budget` | Finance Core | `action: 'get' \| 'upsert'`; `{ monthKey (IST default), totalBudget?, expectedIncome?, plannedSipAmount?, budgetMode?: 'cap' \| 'zero_based', assignedIncome?, notes?, categoryLimits?: [{ categoryId, monthlyBudgetLimit }] }` | `R:false, D:false, I:true` | `finance:read` (`get`) / `finance:write` (`upsert`) | `{ monthKey, budget, updatedCategoryLimits? }` |
| 18 | `manage_net_worth_snapshot` | Finance Core | `action: 'list' \| 'capture'`; `{ months?: 1..24, monthKey?: YYYY-MM }` | `R:false, D:false, I:true` | `finance:read` (`list`) / `finance:write` (`capture`) | `{ action, snapshot?, snapshots? }` |
| 19 | `get_transactions` | Transactions | `{ startDate?, endDate?, monthKey?, type?, categoryId?, accountId?, search?, tag?, needsReview?, splitGroupId?, statementCycleKey?, limit?: 1..100, offset? }` | `R:true, D:false, I:true` | `habitflow:finance:read` | `{ total, returned, transactions: [...] }` |
| 20 | `manage_transaction` | Transactions | `action: 'create' \| 'update' \| 'delete' \| 'split_with_friend' \| 'resolve_review'`; full fields (`title, merchant_name, amount, type, category_id, subcategory, account_id, to_account_id, date, notes, tags, is_recurring, needs_review, linked_commitment_id, commitment_contribution_type`); atomic account balance updates + CC cycle tagging + friend split legs; `delete` soft-deletes & reverses balance with `confirm: true` | `R:false, D:true (delete), I:false` | `habitflow:finance:write` | `{ action, transaction, splitLegs?, updatedAccounts: [{ id, newBalance }] }` |
| 21 | `get_credit_card_cycles` | Credit Cards | `{ accountId?: string, referenceDate?: YYYY-MM-DD (IST) }` | `R:true, D:false, I:true` | `habitflow:finance:read` | `{ referenceDateIst, cards: [{ accountId, name, creditLimit, utilizationPct, currentUnbilledCycle, openStatements, totalOutstandingDue, nextDueDate }] }` |
| 22 | `manage_credit_card_statement` | Credit Cards | `action: 'pay_bill' \| 'reconcile_statement' \| 'update_notes'`; `pay_bill`: `{ cardAccountId, fromAccountId, amount, statementId?, date?, notes? }`; `reconcile_statement`: `{ cardAccountId, cycleKey, billedTotal, notes? }` | `R:false, D:false, I:false` | `habitflow:finance:write` | `{ action, paymentTransaction?, updatedStatements, updatedCardSummary }` |
| 23 | `get_friend_ledgers` | Friends Debt | `{ personName?: string, bucketType?: 'everyday_split' \| 'long_term_loan' \| 'all', includeSettled?: boolean }` | `R:true, D:false, I:true` | `habitflow:finance:read` | `{ friends: [{ personName, everydayTab: { netBalance, openEntries }, longTermLoans: { netBalance, openEntries } }] }` (strict bucket isolation) |
| 24 | `manage_friend_debt` | Friends Debt | `action: 'create_entry' \| 'update_entry' \| 'record_payment' \| 'settle_bucket' \| 'archive_entry'`; enforces `bucket_type` isolation; supports optional linked `finance_transaction` + account delta; `settle_bucket` & `archive_entry` require `confirm: true` | `R:false, D:true (settle/archive), I:false` | `habitflow:finance:write` | `{ action, debtRecord?, installment?, linkedTransaction?, updatedFriendSummary }` |
| 25 | `manage_recurring_bill` | Obligations | `action: 'list' \| 'create' \| 'update' \| 'mark_paid' \| 'archive'`; full bill fields; `mark_paid` logs expense + updates `last_paid_month_key` + account balance; `archive` requires `confirm: true` | `R:false, D:true (archive), I:false` | `finance:read` (`list`) / `finance:write` | `{ action, bill?, bills?, loggedTransaction? }` |
| 26 | `manage_emi` | Obligations | `action: 'list' \| 'create' \| 'update' \| 'log_payment' \| 'foreclose'`; full EMI tracker fields; `log_payment` increments `paid_months` + logs expense + updates balance; `foreclose` requires `confirm: true` | `R:false, D:true (foreclose), I:false` | `finance:read` (`list`) / `finance:write` | `{ action, emi?, emis?, loggedTransaction? }` |
| 27 | `manage_sip_plan` | Obligations | `action: 'list' \| 'create' \| 'update' \| 'log_installment' \| 'update_valuation' \| 'archive'`; full SIP fields; `log_installment` updates `total_invested`/`current_value` + logs investment tx + balance; `archive` requires `confirm: true` | `R:false, D:true (archive), I:false` | `finance:read` (`list`) / `finance:write` | `{ action, sip?, sips?, loggedTransaction? }` |
| 28 | `manage_monthly_commitment` | Obligations | `action: 'list' \| 'create' \| 'update' \| 'log_contribution' \| 'archive'`; full commitment fields; `log_contribution` logs linked transaction (`direct_payment` or `offset_expense`); `archive` requires `confirm: true` | `R:false, D:true (archive), I:false` | `finance:read` (`list`) / `finance:write` | `{ action, commitment?, commitments?, monthProgress?, loggedTransaction? }` |

*(All 28 tools annotate `openWorldHint: false` because they operate strictly within the authenticated user's HabitFlow data store.)*

### 4.3 Live MCP Resources (6 Read-Only Context URIs)
| Resource URI | MIME Type | Required Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `habitflow://today` | `application/json` | `habitflow:read` | Compact IST daily snapshot (habits due, tasks due/overdue, focus goals, today's mood). |
| `habitflow://habits/active` | `application/json` | `habitflow:read` | All active habits with current streaks, weekly progress, and quantitative targets. |
| `habitflow://goals/focus` | `application/json` | `habitflow:read` | Active & focus goals with milestone checklists and deadline countdowns. |
| `habitflow://finance/summary` | `application/json` | `habitflow:finance:read` | Current IST month income/expense/budget pace, account balances, and net worth. |
| `habitflow://finance/credit-cards` | `application/json` | `habitflow:finance:read` | Dual-cycle unbilled + open statement summary across all active credit cards. |
| `habitflow://finance/friends-ledger` | `application/json` | `habitflow:finance:read` | Per-friend isolated Everyday Tab and Long-Term Loan balances. |

### 4.4 Reusable MCP Prompts (4 Slash/Workflow Templates)
| Prompt Name | Arguments | Purpose |
| :--- | :--- | :--- |
| `daily_planning` | `{ energyLevel?: 'high' \| 'medium' \| 'low' }` | Loads `habitflow://today`, triages overdue tasks, picks top 3 MITs, and plans today's habit blocks. |
| `evening_review` | `{}` | Audits incomplete habits/tasks for today (IST), prompts mood check-in, and summarizes today's expenses. |
| `monthly_finance_audit` | `{ monthKey?: YYYY-MM }` | Combines `get_finance_overview`, `get_credit_card_cycles`, and `get_habit_finance_insights` into an actionable budget & bill-due plan. |
| `friend_settlement_plan` | `{ personName?: string }` | Reviews isolated Everyday Tab vs. Long-Term Loan balances and drafts clean settlement steps without mixing buckets. |

---

## 5. Security, Auth & Sync Invariant Checklist

### 5.1 Transport & Serverless Runtime
- [ ] **Stateless Streamable HTTP:** Mount `createMcpHandler` from `mcp-handler` v2 inside `src/app/api/mcp/route.ts` exporting `GET`, `POST`, `DELETE`, and `OPTIONS` with `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`, and `export const maxDuration = 60`.
- [ ] **Strict CORS (No Wildcard Credentials):** Explicit origin allowlist (`https://habit-flow-ochre-two.vercel.app`, `https://gemini.google.com`, `https://claude.ai`, `https://chatgpt.com`, `http://localhost:3000`, `http://localhost:6274` for MCP Inspector, plus configurable `HABITFLOW_MCP_ALLOWED_ORIGINS` env var). Expose `Mcp-Session-Id` and `WWW-Authenticate` headers; allow `Authorization`, `Content-Type`, `Accept`, `Mcp-Session-Id`, `MCP-Protocol-Version`.
- [ ] **Clean JSON-RPC Errors:** Validation failures return structured JSON-RPC `-32602` (`Invalid params`) with Zod field details; unknown records or ownership mismatches return clean application errors without leaking raw PostgreSQL internals.

### 5.2 Two-Tier Authentication & Authorization
- [ ] **Tier 1 — Personal Fast-Track Auth (Vercel Env Vars Only):**
  - Validate `Authorization: Bearer <token>` (or optional `/api/mcp/[token]` path fallback for clients that cannot send custom headers) using `crypto.timingSafeEqual` over SHA-256 digests against `process.env.HABITFLOW_MCP_SECRET`.
  - Resolve strictly to `process.env.HABITFLOW_MCP_USER_ID`. Never expose `HABITFLOW_MCP_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`.
- [ ] **Tier 2 — Standard MCP OAuth 2.1 Auth:**
  - **RFC 9728 Protected Resource Metadata** at `GET https://habit-flow-ochre-two.vercel.app/.well-known/oauth-protected-resource`: declares `resource: "https://habit-flow-ochre-two.vercel.app/api/mcp"`, `authorization_servers: ["https://habit-flow-ochre-two.vercel.app"]`, `bearer_methods_supported: ["header"]`, and the 4 `scopes_supported`.
  - **OAuth 2.1 Authorization Server Metadata** at `GET https://habit-flow-ochre-two.vercel.app/.well-known/oauth-authorization-server`: advertises `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `code_challenge_methods_supported: ["S256"]`, `client_id_metadata_document_supported: true`.
  - **Mandatory PKCE (`S256`):** Reject any authorization or token request missing `code_challenge` or attempting `plain`. Authorization codes expire in 5 minutes and are single-use (`consumed_at`).
  - **RFC 8707 Resource Indicators:** Strictly bind authorization codes and issued access tokens to `resource === "https://habit-flow-ochre-two.vercel.app/api/mcp"`. Reject tokens whose `resource` / `aud` does not match.
  - **Client Identification (CIMD + DCR Fallback + SSRF Protection):**
    - If `client_id` is an `https://` URL (Client ID Metadata Document), fetch & validate JSON metadata (`client_id`, `client_name`, `redirect_uris`) with strict SSRF protection: require HTTPS, resolve hostname DNS first and block loopback (`127.0.0.0/8`, `::1`), private (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), and link-local/metadata (`169.254/16`, `fe80::/10`) IPs, disallow redirects to non-HTTPS/private targets, enforce 3s timeout & 32KB max body.
    - Support `POST /api/oauth/register` (Dynamic Client Registration) persisting to `mcp_oauth_clients`, plus pre-registered static clients.
  - **Strict Token Storage & Scopes:** Store only SHA-256 hashes of access & refresh tokens in `mcp_oauth_tokens`. Return `401 Unauthorized` with `WWW-Authenticate: Bearer resource_metadata="https://habit-flow-ochre-two.vercel.app/.well-known/oauth-protected-resource"` when unauthenticated, and `403 Forbidden` with `error="insufficient_scope", scope="<required>"` when authenticated without the required scope.
  - **No Token Passthrough:** Never forward external MCP tokens to Supabase; always verify token server-side, extract `userId`, and query Supabase via Service Role explicitly scoped with `.eq('user_id', userId)`.

### 5.3 Rate Limiting & Audit Logging
- [ ] **Tiered Rate Limits:** Reuse Upstash Redis / fallback limiter (`habitflow:rl`) keyed by `mcp:${userId}:read` (120 req/min), `mcp:${userId}:write` (40 req/min), and `mcp:${ip}:oauth` (20 req/min).
- [ ] **Redacted Audit Trail (`mcp_audit_logs`):** Log every write tool invocation (and optionally failed auth attempts) with `user_id`, `tool_name`, `action`, `auth_mode` (`secret` | `oauth`), `client_id`, `scopes`, sanitized/redacted `input_summary` (never storing tokens, notes secrets, or raw credentials), `status` (`ok` | `error`), and `duration_ms`. Protected by Supabase RLS (`auth.uid() = user_id`).

### 5.4 Offline-First Dexie & Finance Sync Invariants
- [ ] **Vector Clock Barrier (`generation_counter + 1`):** Every `INSERT` initializes `generation_counter: 1`; every `UPDATE` reads current `generation_counter` and writes `generation_counter: current + 1` and `updated_at: new Date().toISOString()` so PostgreSQL's `increment_generation_clock_vector()` trigger never silently drops updates and Dexie always pulls them.
- [ ] **Valid Identifiers:** Standard tables generate RFC 4122 UUIDs (`crypto.randomUUID()`); `credit_card_statements` strictly uses deterministic TEXT IDs `${accountId}_${cycleKey}`.
- [ ] **Soft-Delete & Archive Discipline:** Finance deletes set `deleted_at = nowIso`, bump `generation_counter`, and reverse account balance effects. Habit/Goal/Account/Category archives set `is_archived = true`; Task/Debt archives set `status = 'archived'` (cascading subtasks); Recurring Bills/SIPs/Commitments set `is_active = false`. All require `confirm: true`.
- [ ] **Atomic Finance Side Effects:**
  - Transaction create/update/soft-delete updates `finance_accounts.balance` (`income` `+`, `expense`/`investment` `-`, `transfer` `-from / +to`) and bumps `generation_counter` on every modified account.
  - Credit card spends compute and persist `statement_cycle_key` via `resolveTransactionCycle()`.
  - Credit card bill payments create `type: 'transfer'`, `is_credit_card_payment: true`, `paid_statement_id`, and waterfall-allocate across open statements while writing `paid_amount` **ONLY onto the directly linked statement** (matching `transactions-slice.ts` so `computeCreditCardSummary` never double-counts secondary statements).
  - Friend ledgers strictly isolate `everyday_split` and `long_term_loan` buckets; payments update `debt_records`, insert `debt_installments`, and optionally create a linked `finance_transactions` row + balance delta.
- [ ] **IST Timezone Normalization:** All default dates (`today`, `month_key`, streak checks, due-date countdowns) are computed in `Asia/Kolkata` (`UTC+05:30`), never Vercel server UTC.

---

## 6. Phased Delivery Roadmap

### Phase 1: Core Transport, Tier 1 Auth, Shared Pure Calculators & Read Surface
- **Deliverables:**
  1. Save this approved plan to `docs/PLAN-habitflow-mcp.md`.
  2. Install `mcp-handler`, `@modelcontextprotocol/sdk`, and `zod` (update `.env.example` with `HABITFLOW_MCP_SECRET`, `HABITFLOW_MCP_USER_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `HABITFLOW_MCP_ALLOWED_ORIGINS`).
  3. Update `src/middleware.ts` to exclude `/.well-known` from login redirects.
  4. Extract pure server+client finance analytics helpers into `src/lib/finance/shared-analytics.ts` and add optional `referenceDate` to `src/lib/finance/forecast.ts`.
  5. Implement `src/lib/mcp/{config,supabase-admin,sync-helpers,auth,server}.ts`, `src/app/api/mcp/route.ts`, and `src/app/api/mcp/[token]/route.ts`.
  6. Implement all **read tools** (`get_daily_briefing`, `get_habit_finance_insights`, `get_habits`, `get_tasks`, `get_goals`, `get_user_settings`, `get_finance_overview`, `get_transactions`, `get_credit_card_cycles`, `get_friend_ledgers`) and all **6 MCP Resources**.
- **Acceptance Criteria:**
  - `POST /api/mcp` with valid `Authorization: Bearer <HABITFLOW_MCP_SECRET>` passes MCP `initialize`, `tools/list`, `resources/list`, and returns live IST-accurate data.
  - Invalid/missing tokens return HTTP `401` with RFC 9728 `WWW-Authenticate` header.

### Phase 2: Full Edit / Write Tools & Offline-First Sync Integrity
- **Deliverables:**
  1. Implement all **18 write/consolidated CRUD tools** across `src/lib/mcp/tools/{habits,tasks,goals,mood-settings,finance-core,finance-transactions,finance-credit-cards,finance-friends,finance-obligations}.ts`.
  2. Enforce `generation_counter + 1`, `updated_at`, `confirm: true` destructive guards, account balance deltas, credit card single-target waterfall payments, friend split leg creation, and isolated bucket debt payments.
  3. Write Vitest suites `sync-invariants.test.ts` and `finance-mutations.test.ts` covering vector clock bumps, IST midnight boundary dates, balance reversals, and CC payment reconciliation.
- **Acceptance Criteria:**
  - Every domain entity can be created, edited, and safely archived/soft-deleted via MCP.
  - Edits performed via MCP sync cleanly into mobile/web Dexie IndexedDB on next pull without trigger drops or balance drift.

### Phase 3: MCP Prompts, Rate Limiting, Audit Logging & Settings UI
- **Deliverables:**
  1. Create SQL migration `supabase/migrations/20261124_add_mcp_audit_and_oauth.sql` (`mcp_audit_logs` + Phase 4 OAuth tables with RLS).
  2. Implement the **4 MCP Prompts** (`daily_planning`, `evening_review`, `monthly_finance_audit`, `friend_settlement_plan`), per-user tiered rate limiting (`src/lib/mcp/rate-limit.ts`), and redacted audit logging (`src/lib/mcp/audit.ts`).
  3. Build `src/app/api/mcp/connections/route.ts` and `src/components/settings/McpConnectionsCard.tsx` mounted in `src/components/settings/SettingsPageContent.tsx`.
- **UX & Visual Design (`McpConnectionsCard`):**
  - Follows HabitFlow's existing Obsidian & Mint palette with single-elevation flat panels (`1px` subtle borders, zero nested card sandwiches).
  - Displays the canonical `https://habit-flow-ochre-two.vercel.app/api/mcp` endpoint in monospace (`tabular-nums`) with one-click copy, tabbed client config snippets (Gemini App, Claude Desktop, Cursor, Antigravity), a client-side 256-bit secret generator helper with clear instructions to paste into Vercel Environment Variables, a clean table of recent redacted MCP write actions (compact 40px rows with empty & loading skeleton states), and a Connected OAuth Apps section with one-click revoke.
- **Acceptance Criteria:**
  - Every write tool invocation creates a redacted row in `mcp_audit_logs` visible in Settings.
  - Rate limit excess returns HTTP `429` with `Retry-After`.

### Phase 4: Standard MCP OAuth 2.1 (PKCE S256, RFC 9728, RFC 8707, CIMD/DCR & Consent UI)
- **Deliverables:**
  1. Implement `GET /.well-known/oauth-protected-resource` (RFC 9728) and `GET /.well-known/oauth-authorization-server` (RFC 8414).
  2. Implement `src/lib/mcp/oauth.ts`, `POST /api/oauth/register` (DCR), `POST /api/oauth/token` (PKCE S256 + RFC 8707 `resource` binding + refresh token rotation), and `POST /api/oauth/revoke`.
  3. Build the interactive browser consent screen at `src/app/oauth/authorize/page.tsx` + `actions.ts`: verifies active Supabase session (redirects to `/login` with return URL if signed out), displays verified client name/origin (CIMD or DCR), lets the user toggle/approve requested scopes (`habitflow:read`, `habitflow:write`, `habitflow:finance:read`, `habitflow:finance:write`), and redirects back with a single-use authorization code.
  4. Wire Tier 2 Bearer token verification + `401` vs `403 insufficient_scope` handling into `src/lib/mcp/auth.ts`.
  5. Write Vitest suite `auth-and-oauth.test.ts` verifying PKCE S256 validation, RFC 8707 audience rejection, CIMD SSRF IP blocking, and scope enforcement; run full `npm test`, `compile_applet`, and `lint_applet`.
- **Acceptance Criteria:**
  - Unauthenticated discovery from `https://habit-flow-ochre-two.vercel.app/api/mcp` -> `401` -> PRM -> AS metadata -> browser consent -> PKCE S256 token exchange -> scoped MCP tool execution succeeds end-to-end.
  - Revoking a connected app in Settings immediately invalidates its tokens on the next MCP call.

---

## 7. Verification & Client Connection Playbook

All configurations below target the canonical production deployment **`https://habit-flow-ochre-two.vercel.app/api/mcp`**.

### 7.1 Required Vercel Environment Variables
Set these in **Vercel Project Settings -> Environment Variables** (Server-only — never `NEXT_PUBLIC_`):
```bash
HABITFLOW_MCP_SECRET=<64-hex-char random secret generated in Settings or `openssl rand -hex 32`>
HABITFLOW_MCP_USER_ID=<your Supabase auth.users UUID>
SUPABASE_SERVICE_ROLE_KEY=<Supabase project service_role key>
# Optional comma-separated extra CORS origins:
HABITFLOW_MCP_ALLOWED_ORIGINS=https://habit-flow-ochre-two.vercel.app
```

### 7.2 Local & Production Verification with MCP Inspector
```bash
# 1. Run Vitest unit & sync invariant test suite
npm test

# 2. Launch MCP Inspector against local dev server (http://localhost:3000/api/mcp)
npx @modelcontextprotocol/inspector

# 3. Smoke-test production discovery & auth challenge
curl -i https://habit-flow-ochre-two.vercel.app/.well-known/oauth-protected-resource
curl -i https://habit-flow-ochre-two.vercel.app/.well-known/oauth-authorization-server
curl -i -X POST https://habit-flow-ochre-two.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# Expected: HTTP 401 with WWW-Authenticate pointing to /.well-known/oauth-protected-resource
```
In MCP Inspector: select **Streamable HTTP**, set URL to `https://habit-flow-ochre-two.vercel.app/api/mcp`, add header `Authorization: Bearer <HABITFLOW_MCP_SECRET>` (or click **OAuth** to test Phase 4 browser sign-in), then verify `tools/list` (28 tools), `resources/list` (6 resources), `prompts/list` (4 prompts), and test a safe write + read-back cycle.

### 7.3 Gemini App (Developer Mode)
- **Server URL:** `https://habit-flow-ochre-two.vercel.app/api/mcp`
- **Authentication (Tier 2 OAuth — Recommended):** Select **OAuth 2.1** (auto-discovers `/.well-known/oauth-protected-resource` and prompts HabitFlow consent screen).
- **Authentication (Tier 1 Fast-Track):** Select **Bearer Token** header `Authorization: Bearer <HABITFLOW_MCP_SECRET>`, or if only a URL field is available, use the path-token route `https://habit-flow-ochre-two.vercel.app/api/mcp/<HABITFLOW_MCP_SECRET>`.

### 7.4 Claude Code (CLI)
```bash
# Native Streamable HTTP (OAuth 2.1 auto-discovery)
claude mcp add --transport http habitflow https://habit-flow-ochre-two.vercel.app/api/mcp

# Or Tier 1 Personal Bearer Token
claude mcp add --transport http habitflow https://habit-flow-ochre-two.vercel.app/api/mcp \
  --header "Authorization: Bearer <HABITFLOW_MCP_SECRET>"
```

### 7.5 Claude Desktop (Stdio Bridge via `mcp-remote` or Native Remote Connector)
- **Native Remote Connector (Settings -> Connectors -> Add Custom Connector):**  
  URL: `https://habit-flow-ochre-two.vercel.app/api/mcp` (completes OAuth 2.1 sign-in automatically).
- **Local `claude_desktop_config.json` fallback using `mcp-remote`:**
```json
{
  "mcpServers": {
    "habitflow": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://habit-flow-ochre-two.vercel.app/api/mcp",
        "--header",
        "Authorization: Bearer ${HABITFLOW_MCP_SECRET}"
      ],
      "env": {
        "HABITFLOW_MCP_SECRET": "<YOUR_HABITFLOW_MCP_SECRET>"
      }
    }
  }
}
```

### 7.6 Cursor (`.cursor/mcp.json`) & Google Antigravity (`mcp_config.json`)
```json
{
  "mcpServers": {
    "habitflow": {
      "url": "https://habit-flow-ochre-two.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_HABITFLOW_MCP_SECRET>"
      }
    }
  }
}
```
