# Implementation Plan - Mobile UI Refinements

## Overview
We need to refine the mobile UI/UX on the Habits and Tasks pages to ensure elements do not overflow or get cut off:
1. **Topbar/Header Stacking**: Stacking title and action buttons vertically on mobile viewports for the Tasks and Habits pages.
2. **Habits Button Wrapping**: Allowing the button group on the Habits page header to wrap (`flex-wrap`) so they don't overflow the screen horizontally.
3. **Reduced Card Padding**: Adjusting card content padding on mobile to regain 24px of horizontal space for the grid content.
4. **Responsive Column widths**: Correctly configuring `flex-grow` and `flex-shrink` parameters in the Habit Grid rows and header spacer.
5. **Inner Text Wrapping**: Wrapping the habit name and icon inside a proper flex-wrap container with top alignment and `min-w-0` to ensure long names wrap instead of clip.
6. **Mobile Touch Actions**: Making the actions (Edit/Delete) button always visible on mobile, since touch devices do not support hover.

## Proposed Changes

### 1. Page Layouts

#### [MODIFY] [TasksPageContent.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/tasks/TasksPageContent.tsx)
- Change header div at line 72 from `flex items-center justify-between` to `flex flex-col sm:flex-row sm:items-center justify-between gap-4`.

#### [MODIFY] [HabitsPageContent.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/habits/HabitsPageContent.tsx)
- Change button group container at line 185 from `flex gap-2` to `flex flex-wrap gap-2`.
- Change Card at line 276-277 to reduce padding on mobile:
  ```tsx
  <Card className="border-none shadow-none md:border md:shadow-sm">
    <CardContent className="p-2 sm:p-4 md:p-6">
  ```

### 2. Habit Grid

#### [MODIFY] [habit-grid.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/habits/habit-grid.tsx)
- Change header spacer at line 170 from `flex-1 min-w-0 md:flex-none md:w-64 flex-shrink-0` to `flex-1 min-w-0 md:flex-none md:w-64`.

#### [MODIFY] [SortableHabitRow.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/habits/SortableHabitRow.tsx)
- Change habit info wrapper column at line 224 from `flex-1 min-w-0 md:flex-none md:w-64 flex-shrink-0` to `flex-1 min-w-0 md:flex-none md:w-64`.
- Change row flex content at line 235 from `flex items-center gap-2` to `flex items-start gap-2 min-w-0`.
- Change icon span at line 236 to add `shrink-0 mt-0.5`.
- Change name text container at line 237 to add `flex-1 min-w-0`.
- Change actions button opacity class at line 322 from `opacity-0 group-hover:opacity-100` to `opacity-100 md:opacity-0 md:group-hover:opacity-100`.

---

## Verification Plan

### Automated Tests
- Run typecheck: `npx tsc --noEmit`
- Run linting: `npm run lint`
- Run Vitest tests: `npm run test`

### Manual Verification
- Verify in Chrome DevTools mobile view (390px width):
  1. The header of both pages stacks vertically without clipping.
  2. The button group on the Habits page wraps cleanly to multiple lines.
  3. The Habit grid spacer and row columns align perfectly and wrap text correctly.
  4. The edit/delete menu button is visible on mobile viewports without hovering.

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-05-26
