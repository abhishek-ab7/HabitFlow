# Task: Gamification Level Motivation Overhaul

- [/] **Plan Motivation System** <!-- id: 0 -->
    - [x] Check dependencies (`recharts`) <!-- id: 1 -->
    - [ ] Create detailed Implementation Plan <!-- id: 2 -->
- [/] **State Management** <!-- id: 3 -->
    - [/] Update `gamification-store.ts` with Motivation Stats (`discipline`, `focus`, `resilience`) <!-- id: 4 -->
    - [ ] Add `motivationText` text field to store (Why I Started) <!-- id: 5 -->
    - [ ] Add persistence for new fields <!-- id: 6 -->
- [x] **UI Components** <!-- id: 7 -->
    - [x] Create `XPJourneyMap` (Option A - Timeline) <!-- id: 8 -->
    - [x] Create `DisciplineRadar` (Option B - Radar Chart) <!-- id: 9 -->
    - [x] Create `AccountabilityPledge` (Option C - Input/Manifesto) <!-- id: 10 -->
- [x] **Integration** <!-- id: 11 -->
    - [x] Refactor `GamificationRulesModal` to include new "My Journey" tab (or replace "Levels" content) <!-- id: 12 -->
    - [x] Ensure Mobile responsiveness <!-- id: 13 -->
- [ ] **Verification** <!-- id: 14 -->
    - [ ] Check Z-Index and Layout <!-- id: 15 -->
    - [ ] Verify Data Persistence <!-- id: 16 -->
    - [ ] Build Check <!-- id: 17 -->
