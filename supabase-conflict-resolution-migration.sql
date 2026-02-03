-- =============================================
-- CONFLICT RESOLUTION MIGRATION
-- =============================================
-- Adds updated_at columns and triggers for intelligent conflict resolution
-- Strategy: Most recent timestamp wins + Completed always wins

-- ===========================================
-- STEP 1: Add missing updated_at columns
-- ===========================================

-- Add updated_at to completions (CRITICAL for routine sync)
ALTER TABLE completions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at to milestones
ALTER TABLE milestones 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at to habit_routines junction table
ALTER TABLE habit_routines 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ===========================================
-- STEP 2: Backfill existing data
-- ===========================================
-- Set updated_at = created_at for all existing records (Option A)

-- Backfill completions
UPDATE completions 
SET updated_at = created_at 
WHERE updated_at IS NULL OR updated_at = created_at;

-- Backfill milestones
UPDATE milestones 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Backfill habit_routines
UPDATE habit_routines 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- ===========================================
-- STEP 3: Create auto-update triggers
-- ===========================================

-- Trigger for completions
DROP TRIGGER IF EXISTS update_completions_updated_at ON completions;
CREATE TRIGGER update_completions_updated_at 
BEFORE UPDATE ON completions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for milestones
DROP TRIGGER IF EXISTS update_milestones_updated_at ON milestones;
CREATE TRIGGER update_milestones_updated_at 
BEFORE UPDATE ON milestones
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for tasks (ensure it exists)
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at 
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for routines (ensure it exists)
DROP TRIGGER IF EXISTS update_routines_updated_at ON routines;
CREATE TRIGGER update_routines_updated_at 
BEFORE UPDATE ON routines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for habit_routines
DROP TRIGGER IF EXISTS update_habit_routines_updated_at ON habit_routines;
CREATE TRIGGER update_habit_routines_updated_at 
BEFORE UPDATE ON habit_routines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- STEP 4: Add indexes for performance
-- ===========================================

-- Index on completions.updated_at for faster conflict resolution queries
CREATE INDEX IF NOT EXISTS idx_completions_updated_at ON completions(updated_at);

-- Index on milestones.updated_at
CREATE INDEX IF NOT EXISTS idx_milestones_updated_at ON milestones(updated_at);

-- Index on habit_routines.updated_at
CREATE INDEX IF NOT EXISTS idx_habit_routines_updated_at ON habit_routines(updated_at);

-- ===========================================
-- VERIFICATION QUERIES (optional - run to verify)
-- ===========================================

-- Verify completions have updated_at
-- SELECT COUNT(*) as total, COUNT(updated_at) as with_updated_at FROM completions;

-- Verify triggers exist
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%updated_at%';

-- ===========================================
-- NOTES
-- ===========================================
-- After running this migration:
-- 1. All completions, milestones, and habit_routines will have updated_at timestamps
-- 2. Triggers automatically update updated_at on any UPDATE operation
-- 3. Conflict resolution can now use timestamps to determine most recent changes
-- 4. "Completed always wins" logic can be implemented in application layer
