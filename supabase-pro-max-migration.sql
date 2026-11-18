-- =============================================
-- HABITFLOW PRO MAX MIGRATION
-- =============================================

-- 1. GAMIFICATION SYSTEM (User Settings)
-- Adding XP, Level, Gems, and Streak Shield to user profile
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS gems INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS streak_shield INTEGER DEFAULT 0;

-- 2. ROUTINES SYSTEM
-- Grouping habits into routines (e.g. "Morning Routine")
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT DEFAULT 'manual', -- 'manual', 'time', 'location'
  trigger_value TEXT,                 -- '08:00', 'Gym'
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security for Routines
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own routines" ON routines;
CREATE POLICY "Users can view own routines" ON routines FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own routines" ON routines;
CREATE POLICY "Users can insert own routines" ON routines FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own routines" ON routines;
CREATE POLICY "Users can update own routines" ON routines FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own routines" ON routines;
CREATE POLICY "Users can delete own routines" ON routines FOR DELETE USING (auth.uid() = user_id);

-- Realtime for Routines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE routines;
  END IF;
END $$;

-- 3. HABIT STACKING
-- Linking habits to routines
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS routine_id UUID REFERENCES routines(id) ON DELETE SET NULL;

-- 4. TASKS & NLP
-- Ensure tasks table exists (in case it was missing from base schema)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- 'todo', 'in_progress', 'done', 'archived'
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb, -- Flexible metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add specific NLP column if not in metadata
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS nlp_metadata JSONB DEFAULT '{}'::jsonb;

-- RLS for Tasks (if newly created)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Realtime for Tasks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;
