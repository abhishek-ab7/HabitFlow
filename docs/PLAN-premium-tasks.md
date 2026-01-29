# PLAN-premium-tasks

> **Goal**: Implement a "Premium" Task Management system that unifies Daily Focus, Project Management, and Goal Alignment into a single cohesive experience.

## 1. Requirements

### Core Philosophy
- **Unified Data Model**: One robust `tasks` engine powering multiple views.
- **Premium Experience**: High-end animations, glassmorphism, smooth transitions (Framer Motion), and keyboard accessibility.
- **"All 3 Options" Integration**:
    1.  **Today View**: The default landing for execution (Option A).
    2.  **Project/Kanban View**: For deeper planning and management (Option B).
    3.  **Goal Linkage**: Every task can contribute to a long-term goal (Option C).

### Features
1.  **Data Structure**: `Tasks` table with support for relationships (Goals), scheduling (Due Dates), organization (Tags/Projects), and state (Status).
2.  **Views**:
    -   `/dashboard` (Updated): "Today" focus. Habits + Tasks due today.
    -   `/tasks`: Full project management view (List/Board).
    -   `/goals/[id]`: Tasks tasks specific to a goal.
3.  **UI/UX**:
    -   Dark/Light mode optimized colors.
    -   Drag-and-drop sortable lists.
    -   Micro-interactions (completion confetti, swipe to complete).

---

## 2. Architecture & Design

### Database Schema (Supabase)
New table `tasks`:
- `id`: UUID (PK)
- `user_id`: UUID (FK)
- `title`: Text
- `description`: Text (Rich text/Markdown support)
- `status`: Enum (todo, in_progress, done, archived) - *Supports Kanban*
- `priority`: Enum (low, medium, high)
- `due_date`: Timestamptz - *Supports Today View*
- `goal_id`: UUID (FK to Goals) - *Supports Goal-Driven*
- `tags`: Array of Strings
- `metadata`: JSONB (for subtasks or future extensions)
- `created_at`, `updated_at`

### API Layer
- `GET /tasks`: Filters for date (today), goal, or status.
- `POST /tasks`: Create task.
- `PATCH /tasks/[id]`: Update status (drag-and-drop), details.
- `DELETE /tasks/[id]`: Soft delete/Archive.

### Frontend (Next.js + Tailwind)
- **Design System**: Update `globals.css` and `tailwind.config.ts` for premium tokens (glass, gradients, shadows).
- **Components**:
    -   `TaskCard`: Draggable, highly interactive.
    -   `TaskModal`: Quick add/edit.
    -   `KanbanBoard`: For the generic task view.
    -   `TodayWidget`: For the dashboard.

---

## 3. Task Breakdown

### Phase 1: Foundation (Database & API)
- [ ] **DB**: Create `tasks` table with RLS policies.
- [ ] **DB**: Create index on `due_date` and `user_id`.
- [ ] **API**: Generate Typescript types.
- [ ] **API**: Create Supabase helper server actions for Tasks.

### Phase 2: Design System & Core UI
- [ ] **Design**: Implement "Premium" utility classes (glassmorphism, premium-gradients).
- [ ] **UI**: Create `TaskCard` component (variants: list, board, compact).
- [ ] **UI**: Create `CreateTaskModal` with Goal selector.

### Phase 3: The "Project Management" View (Option B)
- [ ] **Page**: Create `/tasks` route.
- [ ] **Feature**: Implement Kanban/Board view (drag and drop).
- [ ] **Feature**: Implement List view with grouping.

### Phase 4: The "Goal Driven" Integration (Option C)
- [ ] **Page**: Update `/goals/[id]` to show linked tasks.
- [ ] **Logic**: Auto-progress Goal based on linked completed tasks (optional advanced feature).

### Phase 5: The "Today" Dashboard (Option A)
- [ ] **Page**: Refactor `/dashboard` to be the "Today" hub.
- [ ] **Feature**: Split view - Habits (Left) | Tasks (Right).
- [ ] **Feature**: "Focus Mode" toggle.

### Phase 6: Polish & Premium Feel
- [ ] **UX**: Add Framer Motion formatting for list reordering.
- [ ] **UX**: Add completion sounds/haptics (if mobile).
- [ ] **Testing**: E2E tests for the flow "Create Task -> Link Goal -> Complete in Today View".

---

## 4. Verification Plan
- **Automated**: Jest unit tests for the generic Task components.
- **Manual**:
    1.  Create a task in "Project View".
    2.  Link it to a Goal.
    3.  Set due date to "Today".
    4.  Verify it appears on "Dashboard".
    5.  Complete it on Dashboard -> Verify Goal progress updates (if implemented) and disappears from active lists.
