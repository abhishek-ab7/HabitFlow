-- Add difficulty column to habits
ALTER TABLE habits ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';

-- Add recurrence and priority/time columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_time INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_time INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;
