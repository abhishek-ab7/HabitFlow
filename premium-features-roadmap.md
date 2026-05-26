# Premium Features Roadmap - Habit Flow

This document details the tasks, technical structures, and verification steps for implementing the comprehensive suite of **Habit Flow Premium Features**.

## Overview
Our goal is to implement a robust, premium-grade experience across Habits, Goals, Tasks, Analytics, Gamification, and AI dimensions. The app uses local IndexedDB (Dexie) as a single source of truth for ultra-fast response times, syncing to a Supabase PostgreSQL backend in the background.

## Project Type: WEB
- **Primary Agent:** `frontend-specialist` (collaboration with `database-architect` and `backend-specialist` for migrations and sync layers)

## Tech Stack
- **Frontend Core:** Next.js (App Router), React, TailwindCSS, Framer Motion
- **State Management:** Zustand
- **Local Persistence:** IndexedDB via Dexie.js
- **Cloud Sync & Auth:** Supabase Database, Realtime, and Auth API
- **AI Engine:** Google Gemini models (via API endpoints)

---

## Success Criteria
1. **Habit Difficulty & Marketplace**: Habits can be assigned "Easy", "Medium", or "Hard" difficulty, awarding custom XP. Habit Marketplace offers 1-click loading of predefined habit templates.
2. **Visual Habit Stacking & Notes**: Visually configure sequences of routines. Allow grid cells to hold daily completion notes explaining misses.
3. **Streak Recovery**: Broken streaks вчера can be restored by doing a bonus activity or double completing today.
4. **Milestone Roadmap & SMART Analysis**: Timeline representation of goal milestones, health scoring, and AI scorecards (Specific, Measurable, Achievable, Relevant, Time-bound).
5. **Kanban, Eisenhower & Time Logging**: Tasks page supports both Kanban boards, Eisenhower quadrants, custom recurrence (creating future tasks on completion), and estimated vs actual time indicators.
6. **Predictive Analytics & Year In Review**: Month success probability calculations, category correlations, and Spotify Wrapped-like 2026 slideshow summary.
7. **Mobile UX & RPG Gamification**: Thumb-reach layout navigation, swipe actions, vibration feedback, skill trees linked to category completion, and seasonal challenges.

---

## File Structure

```
src/
├── app/
│   ├── analytics/
│   │   └── page.tsx                     # Update to support Year in Review & Predictions
│   └── goals/
│       └── page.tsx                     # Integrate SMART AI Modal
├── components/
│   ├── analytics/
│   │   ├── PredictiveAnalytics.tsx      # NEW: Completion predictions & correlations
│   │   └── YearInReview.tsx             # NEW: Spotify Wrapped visual slideshow
│   ├── gamification/
│   │   └── SkillTrees.tsx               # NEW: RPG life-stats trees
│   ├── goals/
│   │   ├── GoalRoadmapView.tsx          # NEW: Visual milestone timeline
│   │   └── SMARTGoalAnalysis.tsx        # NEW: Gemini AI goal evaluation scorecard
│   ├── habits/
│   │   ├── HabitTemplatesMarketplace.tsx# NEW: Custom predefined templates marketplace
│   │   ├── HabitStackingBuilder.tsx     # NEW: Visual stacking chain connector
│   │   └── SortableHabitRow.tsx         # Modify for swipe actions, notes log
│   └── tasks/
│       └── TasksPageContent.tsx         # Update for Eisenhower matrix coordinates
├── lib/
│   ├── db.ts                            # Upgrade to Dexie version 9 (task recurring, habit difficulty)
│   ├── types.ts                         # Update types with skill tree models & recurrence rules
│   └── stores/
│       ├── habit-store.ts               # Implement dynamic XP & Streak Recovery
│       ├── task-store.ts                # Implement recurring copy generator
│       └── gamification-store.ts        # Implement skill point levels & Multipliers
```

---

## Task Breakdown

| Task ID | Name | Agent | Skills | Priority | Dependencies | Input -> Output -> Verify |
|---------|------|-------|--------|----------|--------------|---------------------------|
| `T1` | **Database Schema & Types Update (v9)** | `database-architect` | clean-code | P0 | None | Update `src/lib/types.ts` and `src/lib/db.ts` to Dexie v9. Add parallel Supabase columns. -> Local schema upgraded -> Run `npm run lint`. |
| `T2` | **Sync Engine & Store Enhancements** | `backend-specialist` | clean-code | P1 | `T1` | Update `sync-engine.ts`, `habit-store.ts`, and `task-store.ts` for dynamic XP, double-yesterday recovery, and task recurrence replication. -> Local stores support recovery & recurrence -> Run store tests. |
| `T3` | **Habits Marketplace & Stacking Builder** | `frontend-specialist` | frontend-design | P2 | `T2` | Build `HabitTemplatesMarketplace.tsx` and `HabitStackingBuilder.tsx` visual builder. -> Template installer is functional -> Click template, verify habits mount correctly. |
| `T4` | **Goal Roadmap & SMART AI scorecards** | `frontend-specialist` | frontend-design | P2 | `T2` | Create `GoalRoadmapView.tsx` timeline and `SMARTGoalAnalysis.tsx` Gemini AI visual scorecard dialog. -> scorecard populates upon clicking AI analyze -> Inspect goal health stats. |
| `T5` | **Tasks Boards & Eisenhower Matrices** | `frontend-specialist` | frontend-design | P2 | `T2` | Fully integrate the KanbanBoard and EisenhowerMatrix, and estimated vs actual time inputs on forms. -> Kanban cards support DnD column shifts -> Move a card, see toast notification. |
| `T6` | **RPG Skill Trees & Predictive Analytics** | `frontend-specialist` | frontend-design | P2 | `T2` | Build `SkillTrees.tsx` HUD and `PredictiveAnalytics.tsx` trend computations. -> RPG skill tree displays point allocations -> Spend gems to upgrade life stats. |
| `T7` | **Year In Review (Spotify Wrapped)** | `frontend-specialist` | frontend-design | P2 | `T6` | Implement `YearInReview.tsx` fully-animated slideshow details for 2026 data. -> Hall of fame show mounts -> Verify slideshow transitions. |
| `T8` | **Mobile UX gestures, Haptics & Polish** | `frontend-specialist` | frontend-design | P3 | `T3`, `T4`, `T5` | Refine navigation reach, swipe modifiers in `SortableHabitRow.tsx`, add `navigator.vibrate`, and add Framer Motion success banners. -> Android vibrate triggers on completion -> Verify mobile layouts. |
| `T9` | **Verification & Final Checks** | `test-engineer` | testing-patterns | P3 | `T8` | Run lint runner, compiler, security scan, and verify builds. -> `verify_all.py` passes -> Final builds succeed. |

---

## Phase X: Verification Checklist
- [ ] Socratic Gate was fully respected.
- [ ] No purple/violet color hex codes added.
- [ ] All Next.js builds pass (`npm run build`).
- [ ] Executed overall verification script: `python .agent/scripts/verify_all.py .`
