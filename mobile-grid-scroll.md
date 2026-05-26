# Implementation Plan - Sticky Pinned Habit Name & Scrollable Day Cells

## Overview
We need to improve the mobile UX of the Habit Grid:
1. **Sticky Pinned Column**: Make the Habit Name (and spacer in header) sticky on the left side of the grid. As the user swipes horizontally, the habit names remain pinned while the day cells scroll underneath.
2. **Single-Line Habit Names**: Keep the habit names on a single line (`whitespace-nowrap truncate`) to prevent vertical stretching and keep the row heights uniform.
3. **Full-Month Scroll**: Enable the full month view on mobile (instead of restricting it to 3 days), allowing the user to swipe through the entire month.
4. **Auto-Scroll to Today**: Automatically scroll the grid horizontally to today's date on load so the active day is centered in the viewport.

## Proposed Changes

### 1. Habit Grid Layout

#### [MODIFY] [habit-grid.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/habits/habit-grid.tsx)
- Add a `useRef` to the root scroll container.
- Enable showing the full month (`days`) on mobile instead of slicing to 3 days:
  ```typescript
  const displayedDays = days; // Show all days of the month on mobile and scroll
  ```
- Add a `useEffect` to scroll today's column into view on mobile mount:
  ```typescript
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMobile && containerRef.current) {
      const todayCell = containerRef.current.querySelector('.bg-primary');
      if (todayCell) {
        todayCell.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    }
  }, [isMobile, displayedDays]);
  ```
- Make the header spacer sticky on the left:
  ```tsx
  <div className="w-40 md:w-64 shrink-0 sticky left-0 bg-background/95 backdrop-blur-sm z-20 border-r border-border/40" />
  ```

#### [MODIFY] [SortableHabitRow.tsx](file:///home/abhi/Downloads/fedora/habit-tracker/src/components/habits/SortableHabitRow.tsx)
- Make the habit info column sticky on the left:
  ```tsx
  <div className="w-40 md:w-64 shrink-0 flex items-center gap-2 pr-3 sticky left-0 bg-background z-20 border-r border-border/40">
  ```
- Modify the name container to truncate on a single line without wrapping:
  ```tsx
  <span className="font-medium text-sm truncate block whitespace-nowrap" title={habit.name}>
      {habit.name}
  </span>
  ```

---

## Verification Plan

### Automated Tests
- Run typecheck: `npx tsc --noEmit`
- Run linting: `npm run lint`
- Run Vitest tests: `npm run test`

### Manual Verification
- Verify in Chrome DevTools mobile view (390px width):
  1. The habit info column on the left is pinned.
  2. Long habit names are truncated on a single line with `...`.
  3. Swiping the day cells scrolls them horizontally.
  4. On mount, the grid scrolls automatically to focus on today's column.
  5. Pinned headers and pinned columns align perfectly.
