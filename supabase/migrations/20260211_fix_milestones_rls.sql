-- Fix Milestones RLS Policies
-- Run this migration if you're getting 403 errors on the milestones table

-- Ensure RLS is enabled
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own milestones" ON milestones;
DROP POLICY IF EXISTS "Users can insert own milestones" ON milestones;
DROP POLICY IF EXISTS "Users can update own milestones" ON milestones;
DROP POLICY IF EXISTS "Users can delete own milestones" ON milestones;

-- Recreate policies
CREATE POLICY "Users can view own milestones" ON milestones 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones" ON milestones 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestones" ON milestones 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own milestones" ON milestones 
  FOR DELETE USING (auth.uid() = user_id);

-- Add missing updated_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'milestones' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE milestones ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add index on user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
