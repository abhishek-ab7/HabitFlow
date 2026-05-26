# Habit Premium Features - Plan

This document details the tasks, technical structures, and verification steps for implementing the premium features of **Habit Flow**.

## Project Type: WEB
Tech Stack: Next.js (App Router), React, TailwindCSS, Zustand, IndexedDB (Dexie), Supabase

---

## Success Criteria
1. **Templates Library**: A page section or modal allowing users to browse habit templates across categories and add them with one click.
2. **Completion Notes**: A hover/click popover on grid cells to add, edit, or view notes on a habit completion. Shows note indicator on cell.
3. **Quantitative Habits**: Add custom fields `isQuantitative`, `targetValue`, and `unit` to habits, and progress `value` to completions. Clicking increments progress, right-clicking lets the user set specific values.
4. **Pomodoro Timer**: A global timer that links to a task. Starts ticking, transitions task to `in_progress`, notifies when done, and tracks sessions.
5. **Weekly Review**: Dedicated view under `/analytics` showing streak trends, completion details, and daily mood tracking.

---

## File Structure

```
src/
├── app/
│   ├── analytics/
│   │   └── page.tsx                 # Update with Weekly Review subview/tab
│   └── tasks/
│       └── page.tsx                 # Add task Pomodoro trigger
├── components/
│   ├── dashboard/
│   │   ├── MoodCheckIn.tsx          # NEW: Emojis check-in on dashboard
│   │   └── premium/
│   │       └── PomodoroFloating.tsx # NEW: Global floating timer overlay
│   ├── habits/
│   │   ├── HabitTemplates.tsx       # NEW: Templates library browser
│   │   ├── SortableHabitRow.tsx     # Add quantitative cells & notes indicator
│   │   └── habit-form-modal.tsx     # Add quantitative forms & templates tab
│   └── tasks/
│       └── TaskCard.tsx             # Add Pomodoro play button
├── lib/
│   ├── db.ts                        # Update schema to v8 (mood logs, habits, completions)
│   ├── types.ts                     # Add quantitative & mood types
│   ├── stores/
│   │   ├── habit-store.ts           # Add notes update & quantitative progress actions
│   │   ├── pomodoro-store.ts        # NEW: Global timer state machine
│   │   └── mood-store.ts            # NEW: Daily mood log store
│   └── sync/
│       └── sync-engine.ts           # Support sync for new fields & mood logs
```

---

## Task Breakdown

| Task ID | Name | Agent | Skills | Priority | Dependencies | Input -> Output -> Verify |
|---------|------|-------|--------|----------|--------------|---------------------------|
| `T1` | **Database Schema & Types Update** | `database-architect` | clean-code | P0 | None | Update `src/lib/types.ts` and `src/lib/db.ts` to Dexie v8. Create Supabase quantitative SQL migration. -> Types & DB files updated -> Run `npm run lint`. |
| `T2` | **Sync Engine Expansion** | `backend-specialist` | clean-code | P1 | `T1` | Add `isQuantitative`, `targetValue`, `unit`, `value` and `mood_logs` to sync mappings in `sync-engine.ts`. -> Code edited -> Verify sync logs on local load. |
| `T3` | **Zustand Store Extensions** | `backend-specialist` | clean-code | P1 | `T1` | Extend `habit-store.ts`, create `pomodoro-store.ts` and `mood-store.ts`. -> Stores implemented -> Run unit tests or check mock store calls. |
| `T4` | **Habit Form Modal & Templates Library** | `frontend-specialist` | frontend-design | P2 | `T3` | Implement `HabitTemplates.tsx` and integrate into `habit-form-modal.tsx` with quantitative options. -> UI modified -> Verify form creates quantitative habits. |
| `T5` | **Grid Cell Popover & Notes** | `frontend-specialist` | frontend-design | P2 | `T3` | Add note indicator and popover dialog in `SortableHabitRow.tsx` for adding notes and quantitative entry. -> UI elements visible -> Toggle note and value entry, check store state updates. |
| `T6` | **Pomodoro Timer Widget & Card Integration** | `frontend-specialist` | frontend-design | P2 | `T3` | Build `PomodoroFloating.tsx` widget and integrate trigger in `TaskCard.tsx`. -> Floating bar appears upon clicking task Play -> Verify task goes to `in_progress`. |
| `T7` | **Weekly Review Screen & Mood check-in** | `frontend-specialist` | frontend-design | P2 | `T3` | Create `MoodCheckIn.tsx` and the Weekly Review tab under `/analytics`. -> Views populated -> Log mood, inspect weekly review. |
| `T8` | **Final Integration & Checklists** | `test-engineer` | testing-patterns | P3 | `T4`, `T5`, `T6`, `T7` | Run full check suite including `verify_all.py` and build check. -> All checks pass -> Build succeeds. |

---

## Phase X: Verification Checklist
- [ ] No purple/violet color hex codes added.
- [ ] All page builds pass (`npm run build`).
- [ ] Automated scan verification run: `python .agent/scripts/verify_all.py .`
