-- Routine Completions Table Migration
-- Explicit tracking of routine completions (instead of derived from habit completions)

-- 1. Create routine_completions table
CREATE TABLE IF NOT EXISTS routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(routine_id, date)
);

-- 2. Enable Row Level Security
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Users can view own routine completions" ON routine_completions;
CREATE POLICY "Users can view own routine completions" ON routine_completions
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own routine completions" ON routine_completions;
CREATE POLICY "Users can insert own routine completions" ON routine_completions
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own routine completions" ON routine_completions;
CREATE POLICY "Users can update own routine completions" ON routine_completions
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own routine completions" ON routine_completions;
CREATE POLICY "Users can delete own routine completions" ON routine_completions
FOR DELETE USING (auth.uid() = user_id);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_id ON routine_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_routine_id ON routine_completions(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_completions_date ON routine_completions(date);
CREATE INDEX IF NOT EXISTS idx_routine_completions_updated_at ON routine_completions(updated_at);

-- 5. Auto-update trigger for updated_at
DROP TRIGGER IF EXISTS update_routine_completions_updated_at ON routine_completions;
CREATE TRIGGER update_routine_completions_updated_at
BEFORE UPDATE ON routine_completions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable realtime (optional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE routine_completions;
    END IF;
END $$;

-- 7. Comments for documentation
COMMENT ON TABLE routine_completions IS 'Explicit tracking of routine completions';
COMMENT ON COLUMN routine_completions.completed IS 'Whether routine was completed (supports soft deletes)';
COMMENT ON COLUMN routine_completions.completed_at IS 'Timestamp when routine was marked complete';
COMMENT ON COLUMN routine_completions.notes IS 'Optional notes about the routine completion';
