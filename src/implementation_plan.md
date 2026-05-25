# Implementation Plan - Level Motivation Overhaul (Visual + Stats + Accountability)

## Goal
Implement a comprehensive "Level Motivation" system that combines Visual Progression (Option A), Discipline Stats (Option B), and Accountability Pledge (Option C) into the "Levels" tab of the Gamification Modal. This will be the "Pro Max" experience the user requested.

## User Review Required
> [!IMPORTANT]
> This overhaul transforms the "Levels" tab from a simple list to a rich dashboard. We will need to migrate or initialize new stats (Discipline, Consistency) for existing users.

## Proposed Changes

### 1. State Management
#### [MODIFY] [gamification-store.ts](file:///home/abhi/Downloads/habit-tracker/src/lib/stores/gamification-store.ts)
- Add `stats`: `{ discipline: number, focus: number, resilience: number }`.
- Add `motivationText`: `string` (Why I started).
- Add `updateMotivation(text: string)` action.
- Update `loadGamification` to fetch these (mock/generate if missing for now).

### 2. UI Components (New)
#### [NEW] [DisciplineRadar.tsx](file:///home/abhi/Downloads/habit-tracker/src/components/gamification/DisciplineRadar.tsx)
- Use `recharts` to render a Radar Chart of the 3 stats.
- Premium styling with grid lines and gradient fills.

#### [NEW] [XPJourneyMap.tsx](file:///home/abhi/Downloads/habit-tracker/src/components/gamification/XPJourneyMap.tsx)
- Use `framer-motion` for a scrollable timeline.
- Show "Past Levels" (Completed) and "Future Levels" (Locked).
- Visual nodes styling.

#### [NEW] [AccountabilityPledge.tsx](file:///home/abhi/Downloads/habit-tracker/src/components/gamification/AccountabilityPledge.tsx)
- Textarea for "Why I Started".
- Display as a "Signed Contract" visual.

### 3. Integration
#### [MODIFY] [GamificationRulesModal.tsx](file:///home/abhi/Downloads/habit-tracker/src/components/gamification/GamificationRulesModal.tsx)
- Completely revamp the `TabsContent value="levels"`.
- Layout:
    - **Top**: Discipline Radar (The "RPG Character Sheet").
    - **Middle**: XP Journey Map (The "Saga").
    - **Bottom**: Accountability Pledge (The "Contract").

## Verification Plan
### Automated Tests
- Verify `recharts` integration doesn't break build.
- Test state updates for `motivationText`.

### Manual Verification
1.  Open Modal -> Click "Levels".
2.  **Verify Radar**: Are stats visible? (Should default to balanced values if new).
3.  **Verify Timeline**: Can I scroll? Do levels look unlocked/locked correctly?
4.  **Verify Pledge**: Can I edit and save my motivation text? Does it persist (in store memory)?
