# Implementation Plan - Mobile UI & UX Fixes

## Overview
We need to fix several critical UI/UX mobile issues in the Habit Tracker application:
1. **Task Page scroll issue**: The bottom navigation bar is cut off/hidden under the viewport because the main page container has a forced height of `h-[calc(100vh-4rem)]` that does not account for the mobile bottom nav bar (h-16).
2. **Topbar elements alignment**: On mobile, topbar buttons (theme toggle, mobile menu, signout) are clustered next to the logo with a huge dead space on the right instead of being pushed to the right edge.
3. **Hide Keyboard icon**: The keyboard shortcuts icon should be hidden on mobile screens.
4. **Horizontal Scroll on Mobile**: Prevent overflow-x and horizontal scroll on all screens.
5. **Onboarding Modal for Existing Users**: Prevent the onboarding wizard from auto-triggering on load for existing users who already have habits/goals in the database.
6. **Timer Overlapping Profile Button**: The floating Pomodoro timer widget overlaps the Profile navigation button on mobile.
7. **Squeezed Habit Titles**: The habit text column is hardcoded to a narrow `w-32` on mobile, squeezing descriptions to one word per line.

## Proposed Changes

### 1. Navigation & Layout

#### [MODIFY] [header.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/layout/header.tsx)
- Insert a spacer `<div className="flex-grow md:hidden" />` between the desktop `<nav>` and the right-side actions container to push actions to the far right on mobile.
- Add `hidden md:inline-flex` to the Keyboard shortcuts `<Button>` component so it is hidden on mobile views.

#### [MODIFY] [MobileNav.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/layout/MobileNav.tsx)
- Double-check that `z-50` and positioning are correct (looks good as `fixed bottom-0 left-0 right-0 z-50`).

### 2. Pages

#### [MODIFY] [TasksPageContent.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/tasks/TasksPageContent.tsx)
- Change `h-[calc(100vh-4rem)]` in the page wrapper div to `h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]` to account for the 64px mobile navigation bar height.

#### [MODIFY] [habit-grid.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/habits/habit-grid.tsx)
- Change header spacer width class from `w-32 md:w-64 flex-shrink-0` to `flex-1 min-w-0 md:flex-none md:w-64 flex-shrink-0` to match the responsive row layout.

#### [MODIFY] [SortableHabitRow.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/habits/SortableHabitRow.tsx)
- Change habit info column width class from `w-32 md:w-64 flex-shrink-0` to `flex-1 min-w-0 md:flex-none md:w-64 flex-shrink-0` to allow the column to occupy remaining viewport width dynamically on mobile.

### 3. Components & Global Styles

#### [MODIFY] [PomodoroFloating.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/dashboard/premium/PomodoroFloating.tsx)
- Change the container position classes from `fixed bottom-6 right-6 z-50` to `fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50` to raise it above the mobile bottom nav bar.

#### [MODIFY] [globals.css](file:///home/abhi/Downloads/fedora/habit-tracker/src/app/globals.css)
- Add global rules under `@layer base` to prevent horizontal scrolling:
  ```css
  html, body {
    max-width: 100vw;
    overflow-x: hidden;
  }
  ```

#### [MODIFY] [DashboardContent.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/dashboard/DashboardContent.tsx)
- Add a client-side hook checking if the user already has data:
  ```typescript
  // If we have habits or goals, dismiss onboarding modal and mark completed in localStorage
  useEffect(() => {
    if ((habits.length > 0 || goals.length > 0) && showOnboarding) {
      setShowOnboarding(false);
      localStorage.setItem('habitflow_onboarded', 'true');
    }
  }, [habits.length, goals.length, showOnboarding]);
  ```

---

## Verification Plan

### Automated Tests
- Run linting: `npm run lint`
- Run type check: `npx tsc --noEmit`
- Run Vitest tests: `npm run test`

### Manual Verification
- Resize viewport to mobile (e.g. 390px width) in Chrome DevTools to verify:
  1. The header menu buttons are aligned to the right.
  2. The keyboard shortcuts button is hidden.
  3. The bottom nav bar is fully visible at the bottom of the task page without scrolling.
  4. The Pomodoro floating widget is sitting nicely above the navigation bar and does not overlap the "Profile" button.
  5. The habit columns wrap beautifully on mobile with no squeezing.
  6. Verify there is no horizontal scrollbar or overflow-x on any page.

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-05-26
