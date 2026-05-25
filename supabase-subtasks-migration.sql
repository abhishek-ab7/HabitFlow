-- Sub-tasks Feature Migration
-- Adds parent-child task relationships

-- 1. Add parent_task_id column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- 2. Add depth column to prevent infinite nesting (max depth 3)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0;

-- 3. Add constraint to prevent deep nesting
ALTER TABLE tasks
ADD CONSTRAINT check_task_depth CHECK (depth >= 0 AND depth <= 3);

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);

-- 5. Add index for depth queries
CREATE INDEX IF NOT EXISTS idx_tasks_depth ON tasks(depth);

-- 6. Update existing tasks to have depth 0
UPDATE tasks SET depth = 0 WHERE depth IS NULL;

-- 7. Add comment for documentation
COMMENT ON COLUMN tasks.parent_task_id IS 'Reference to parent task for subtask hierarchy';
COMMENT ON COLUMN tasks.depth IS 'Nesting level: 0=root, 1=subtask, 2=sub-subtask, 3=max depth';

-- 8. Verification
-- Count tasks by depth
-- SELECT depth, COUNT(*) FROM tasks GROUP BY depth;
