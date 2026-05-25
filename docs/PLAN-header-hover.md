# PLAN-header-hover

> **Goal**: Implement a smooth, premium hover expansion (uncollapsing) animation for header navigation tabs on laptop screens, while keeping the branding logo on the left and actions (level progress, sync status, theme toggle) pinned to the absolute right.

## 1. Requirements

### Core UX Rules
- **Smooth Left-to-Right Expansion**: Collapsed navigation tabs must uncollapse from left to right using a smooth width/opacity transition on hover.
- **Zero Jitter/Jumping**: The hover expansion must not cause layout jumps or content wrapping.
- **Header Alignment**: 
  - Logo stays on the absolute left.
  - Collapsed/expanded navigation bar stays centered.
  - Actions (Level badge, XP bar, sync badge, theme toggle, logout) stay pinned to the absolute right.

---

## 2. Architecture & Design

### Layout Mechanics
- Wrap the logo container in a `flex-1 flex justify-start` wrapper.
- Keep the middle navigation in a `hidden md:flex items-center justify-center` container.
- Wrap the right-side actions in a `flex-1 flex items-center justify-end` wrapper.
- Since the left and right wrappers are both `flex-1`, the navigation remains perfectly centered at all times.

### Animation Mechanics (Tailwind CSS)
To expand the navigation text smoothly on hover without causing layout jumps, we will apply a CSS transition on `max-width` and `opacity`:
- **Default State (under `xl` screens)**:
  - Text label is set to `inline-block max-w-0 opacity-0 overflow-hidden transition-all duration-300 ease-in-out ml-0`.
- **Hover State (under `xl` screens)**:
  - On hover of the parent link (`group-hover:`), text label transitions to `group-hover:max-w-28 group-hover:opacity-100 group-hover:ml-1.5`.
- **Static State (`xl` screens and above)**:
  - Text label is always visible: `xl:max-w-28 xl:opacity-100 xl:ml-2`.

---

## 3. Task Breakdown

### Phase 1: Navigation Refactoring
- [ ] **UI**: Modify `src/components/layout/header.tsx` to update the navigation link structure.
  - Add `group` class to each `<Link>`.
  - Remove parent `gap` classes and transition to element-level margins.
  - Implement dynamic `max-w-0` to `max-w-28` transition classes on the label `<span>` for smooth hover expansion.

### Phase 2: Right Actions Polish
- [ ] **UI**: Verify `UserStatusHUD.tsx` and `SyncStatusBadge.tsx` render correctly beside each other.
- [ ] **UI**: Ensure the `flex-1 flex justify-end` container keeps all actions perfectly aligned to the right edge.

---

## 4. Verification Plan

### Manual Verification
1. **Viewport Width < 1280px (Laptop size)**:
   - Verify header elements fit without causing horizontal scrollbars.
   - Verify navigation links display only as icons.
   - Hover over each tab (e.g. "Tasks", "Goals") and verify it expands smoothly from left to right to reveal the name.
   - Verify right-hand actions (theme toggle, logout) remain pinned to the absolute right.
2. **Viewport Width >= 1280px (Desktop size)**:
   - Verify navigation tabs display both icons and names statically (no animation on hover).
3. **Build Check**:
   - Run `npm run build` to ensure no linting/compilation issues.
