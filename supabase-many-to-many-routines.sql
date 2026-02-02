-- =============================================
-- HABIT-ROUTINE MANY-TO-MANY MIGRATION
-- =============================================

-- 1. Create junction table for habit-routine relationships
CREATE TABLE IF NOT EXISTS habit_routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0, -- Order of habit within the routine
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, routine_id) -- Prevent duplicate links
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_habit_routines_habit_id ON habit_routines(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_routines_routine_id ON habit_routines(routine_id);

-- 3. Migrate existing data from habits.routine_id to habit_routines
INSERT INTO habit_routines (habit_id, routine_id, order_index)
SELECT id, routine_id, 0
FROM habits
WHERE routine_id IS NOT NULL
ON CONFLICT (habit_id, routine_id) DO NOTHING;

-- 4. Row Level Security for habit_routines
ALTER TABLE habit_routines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own habit_routines" ON habit_routines;
DROP POLICY IF EXISTS "Users can insert own habit_routines" ON habit_routines;
DROP POLICY IF EXISTS "Users can update own habit_routines" ON habit_routines;
DROP POLICY IF EXISTS "Users can delete own habit_routines" ON habit_routines;

-- Create policies based on the habit's user_id
CREATE POLICY "Users can view own habit_routines" ON habit_routines 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = habit_routines.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own habit_routines" ON habit_routines 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = habit_routines.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own habit_routines" ON habit_routines 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = habit_routines.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own habit_routines" ON habit_routines 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = habit_routines.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

-- 5. Enable realtime for habit_routines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE habit_routines;
  END IF;
END $$;

-- Note: We're keeping the routine_id column in habits for backward compatibility
-- It can be removed later after confirming everything works
