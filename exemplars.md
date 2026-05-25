# Code Exemplars Blueprint

This document identifies high-quality, representative code examples within the Habit Flow project. It highlights files that best demonstrate the system's architecture, conventions, and implementation strategies for consistency across the codebase.

## Table of Contents
1. [State Management & Local Database](#state-management--local-database)
2. [Sync & Offline-First Strategy](#sync--offline-first-strategy)
3. [AI & Serverless Backend](#ai--serverless-backend)
4. [UI Components & Layout](#ui-components--layout)

---

### State Management & Local Database

**`src/lib/db.ts`**
- **Type**: Data Access Layer / IndexedDB
- **Why it's an exemplar**: Demonstrates an offline-first architecture using Dexie setup. Effectively configures entity tables (`habits`, `completions`, `routines`, etc.) and handles strict version-based database schema upgrades, timestamp handling, and data seeding in the browser. 

**`src/lib/stores/habit-store.ts`**
- **Type**: Zustand Store / Business Logic Layer
- **Why it's an exemplar**: Showcases standard global state distribution. Connects directly to Dexie database operations and binds them into a hook-based state while effectively bridging between the persistent data access layer and the UI.

### Sync & Offline-First Strategy

**`src/lib/sync/sync-engine.ts`**
- **Type**: Cross-Cutting Concern / Background Sync
- **Why it's an exemplar**: Perfectly illustrates how a modern PWA synchronizes local Dexie data against Supabase PostgreSQL endpoints. It tracks network state, batches uploads/downloads, establishes the `SyncStatus` mechanism, and handles sync loops robustly.

### AI & Serverless Backend

**`src/app/api/ai/coach/route.ts`**
- **Type**: Next.js Route Handler / Presentation Layer (API)
- **Why it's an exemplar**: Adheres strictly to the Next.js App Router paradigm. Demonstrates environment flag checks (turning off AI gracefully if disabled), type-safe input validation using custom AI schemas, response streaming/formatting, and interaction with the singleton AI service layer.

**`src/lib/ai/service.ts`**
- **Type**: Core AI Implementation / Business Logic Layer
- **Why it's an exemplar**: Illustrates how to securely and robustly interact with the generative AI SDK (`@google/genai`). Defines highly resilient rate-limiting mechanisms, multiple API key pools (round-robin keys), and integrates caching to avoid redundant API queries.

### UI Components & Layout

**`src/app/layout.tsx`**
- **Type**: Next.js Root Layout / Presentation Container
- **Why it's an exemplar**: Highlights the extensive use of React Providers (`ThemeProvider`, `AuthProvider`, `SyncProvider`) nesting. Incorporates shared app-level cross-cutting UI elements like global toasters (`sonner`), persistent overlays (`LevelUpModal`), and Service Worker registration (`ServiceWorkerRegistration`).

**`src/components/ui/button.tsx`**
- **Type**: Primitive UI Component
- **Why it's an exemplar**: An unstyled, fully accessible Radix UI component wrapped with styling using Tailwind CSS, `cva` (class-variance-authority), and `clsx`. The canonical example of building reusable design-system primitives in this application.

**`src/components/routines/RoutineTriggerWatcher.tsx`**
- **Type**: Client Component / Application Lifecycle
- **Why it's an exemplar**: Sets up side-effects based on the state. Good example of creating listener/watcher patterns in React without cluttering the visible DOM DOM, utilizing the render cycle for triggering side-effects (e.g. notifications for routine times).

---

### Consistency Observations
- **Database Patterns**: Strict reliance on `updatedAt`/`createdAt` timestamps for background syncing delta checks.
- **Client-First Setup**: Actionable data updates happen in IndexedDB *first*, providing perceived instant-loading, effectively hiding network latency behind background synchronization.
- **Provider Injection**: Root layout serves as the absolute backbone, wrapping all Contexts so pages are fundamentally decoupled from underlying systems.

This document serves as the true north for developers. Follow these patterns to maintain strict alignment with Habit Flow’s high-performance, offline-ready architecture.