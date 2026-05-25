# PLAN: Error & Performance Check

Detailed plan to analyze, document, and fix build/lint errors, TypeScript configuration issues, and client/database performance bottlenecks in the HabitFlow project.

---

## 📋 Overview
HabitFlow is a React/Next.js (v16) web application using Supabase for persistence and Dexie for local storage. Recent linter and type check runs revealed 293 lint issues and 61 TypeScript compilation errors (primarily in unit tests and model interfaces). Additionally, there are potential database performance bottlenecks in RLS evaluation and missing foreign key indexes.

This plan details a structured approach to:
1. Audit and resolve build/lint/type errors.
2. Investigate performance bottlenecks (React rendering, database queries, and page loads).
3. Verify fixes using automated checklists and E2E tools (Playwright/Lighthouse).
4. Capture domain knowledge of the core performance-critical components.

---

## 🏗️ Project Type
*   **Type**: WEB (Next.js App Router, React 19)
*   **Primary Agent**: `frontend-specialist` (for UI/React/Next.js) & `database-architect` (for SQL/RLS)

---

## 🎯 Success Criteria
- [ ] **Zero ESLint Errors**: Clean lint runs with no cascading render warnings.
- [ ] **Zero TypeScript Errors**: Complete pass on `npx tsc --noEmit`.
- [ ] **Performance Improvements**:
  - Fix synchronous `setState` in `useEffect` to prevent cascading renders.
  - Optimize Supabase indexes and query RLS policies.
- [ ] **All Tests Passing**: Unit tests in Vitest and E2E checks run successfully.

---

## 🛠️ Tech Stack & Tools
*   **Next.js 16 (Turbopack)** & **React 19**
*   **Vitest** (Unit testing framework)
*   **Playwright** (E2E browser automation for performance/UI validation)
*   **Lighthouse** (Performance auditing)
*   **Supabase PostgreSQL** (Database with Row-Level Security)
*   **TailwindCSS v4** (Styling)

---

## ❓ Open Questions for User
> [!IMPORTANT]
> **Please review these key questions before we execute the plan:**
> 1. **Vitest Global Mocking**: The test files use `vi` without imports. Should we configure Vitest to support global imports (e.g., in `vitest.config.ts`) or explicitly import `vi` from `'vitest'` in each test file?
> 2. **Supabase Database Updates**: We have a performance migration script (`20260202_optimize_performance.sql`). Should we apply these index and RLS optimizations to your live/local Supabase instance automatically during verification?
> 3. **React Compiler Optimization**: The React Compiler is skipping components due to manual memoization dependency mismatch (e.g., `react-hooks/preserve-manual-memoization`). Do you want us to refactor/standardize these dependencies or let the compiler auto-memoize by removing manual hooks where appropriate?

---

## 📅 Task Breakdown

### Phase 1: Context & Knowledge Capture
*   **Goal**: Document current code patterns, API structures, and data flows using `/capture-knowledge`.

#### Task 1.1: Capture Sync Engine Architecture
- **Agent**: `backend-specialist`
- **Skill**: `capture-knowledge`
- **Description**: Analyze and document the offline sync mechanisms and conflict resolution logic.
- **INPUT**: `src/lib/sync/sync-engine.ts`
- **OUTPUT**: `docs/ai/implementation/knowledge-sync-engine.md`
- **VERIFY**: Ensure the generated doc exists and details offline synchronization, conflict resolution steps, and dependencies.

---

### Phase 2: Build & Type Error Resolution (Red to Green)
*   **Goal**: Resolve the 61 TypeScript errors and 293 ESLint warnings.

#### Task 2.1: Fix Vitest Globals & Types in Tests
- **Agent**: `debugger`
- **Skill**: `testing-patterns`
- **Description**: Add `vi` imports/config and resolve mock type mismatches (e.g., missing `startDate` on `Goal` types and `createdAt`/`updatedAt` mismatches).
- **INPUT**: `src/components/dashboard/__tests__/TodayTasksWidget.test.tsx`, `src/lib/stores/__tests__/goal-store.test.ts`, `src/lib/stores/__tests__/habit-store.test.ts`, `src/components/routines/__tests__/RoutineModal.test.tsx`
- **OUTPUT**: Fixed test suites compiling successfully.
- **VERIFY**: Run `npx tsc --noEmit` and confirm zero errors in the test files.

#### Task 2.2: Resolve ESLint Warnings (Cascading Renders)
- **Agent**: `frontend-specialist`
- **Skill**: `clean-code`
- **Description**: Fix synchronous state changes inside `useEffect` (`react-hooks/set-state-in-effect`) in files like:
  - `src/app/habits/page.tsx`
  - `src/providers/sync-provider.tsx`
  - `src/providers/theme-provider.tsx`
  - `src/components/dashboard/hero-section.tsx`
- **INPUT**: Source code of identified files.
- **OUTPUT**: Safe state initialization/transitions outside of synchronous effect bodies.
- **VERIFY**: Run `npm run lint` and confirm no cascading render warnings.

---

### Phase 3: Database & SQL Performance Tune
*   **Goal**: Optimize Supabase queries, RLS policies, and indexes.

#### Task 3.1: Apply Performance Migrations
- **Agent**: `database-architect`
- **Skill**: `database-design`
- **Description**: Run and verify the optimizations specified in `20260202_optimize_performance.sql` (e.g., indexing missing foreign keys and wrapping `auth.uid()` in scalar subqueries `(select auth.uid())` to prevent row-by-row re-evaluation).
- **INPUT**: `supabase/migrations/20260202_optimize_performance.sql`
- **OUTPUT**: Applied database schema changes.
- **VERIFY**: Run schema validation check `python .agent/skills/database-design/scripts/schema_validator.py` or inspect RLS performance on query analyzer.

---

### Phase 4: Automated Verification (Phase X)
*   **Goal**: Run verification scripts and browser audits.

#### Task 4.1: Run Playwright & Lighthouse Audits
- **Agent**: `test-engineer`
- **Skill**: `playwright-skill`
- **Description**: Run Playwright end-to-end tests and Lighthouse performance checks against the local development server.
- **INPUT**: Local server running at `http://localhost:3000`
- **OUTPUT**: Test results, coverage reports, and performance audits.
- **VERIFY**: Ensure performance scores are high and E2E flows succeed.

---

## 🏁 Phase X: Verification Checklist
Before completing this task, we must run the following check commands:

- [ ] **Linter & Compiler**: `npm run lint && npx tsc --noEmit`
- [ ] **Security Scan**: `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .`
- [ ] **UX Audit**: `python .agent/skills/frontend-design/scripts/ux_audit.py .`
- [ ] **Lighthouse Performance**: `python .agent/skills/performance-profiling/scripts/lighthouse_audit.py http://localhost:3000`
- [ ] **E2E Playwright**: `python .agent/skills/webapp-testing/scripts/playwright_runner.py http://localhost:3000`

---

## ✅ PHASE X COMPLETE
- Lint: [ ]
- Security: [ ]
- Build: [ ]
- Date: [Pending Execution]
