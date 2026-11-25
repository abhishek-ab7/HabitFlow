-- =============================================================================
-- HabitFlow Phase 2 (Life OS: Body, Fitness, Diet, Supplements & Routines)
-- Creates 7 Fitness tables + additive columns on habits, goals, user_settings
-- Safe to run multiple times (idempotent IF NOT EXISTS guards).
-- =============================================================================

-- 1. Fitness Profiles (1 per user)
CREATE TABLE IF NOT EXISTS public.fitness_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm NUMERIC(6, 2),
  current_weight_kg NUMERIC(6, 2),
  target_weight_kg NUMERIC(6, 2),
  starting_weight_kg NUMERIC(6, 2),
  target_waist_inches NUMERIC(5, 2),
  calorie_target INTEGER NOT NULL DEFAULT 2000,
  protein_target_g INTEGER NOT NULL DEFAULT 130,
  carbs_target_g INTEGER,
  fat_target_g INTEGER,
  water_target_ml INTEGER NOT NULL DEFAULT 3000,
  steps_target INTEGER NOT NULL DEFAULT 8000,
  sleep_target_hours NUMERIC(4, 2) NOT NULL DEFAULT 7.5,
  activity_level TEXT NOT NULL DEFAULT 'moderate',
  goal_type TEXT NOT NULL DEFAULT 'fat_loss',
  diet_preference TEXT NOT NULL DEFAULT 'non_veg',
  gym_schedule_days INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6],
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fitness_profiles_user UNIQUE (user_id)
);

-- 2. Fitness Daily Logs (1 per user per date)
CREATE TABLE IF NOT EXISTS public.fitness_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC(6, 2),
  waist_inches NUMERIC(5, 2),
  water_ml INTEGER NOT NULL DEFAULT 0,
  steps INTEGER NOT NULL DEFAULT 0,
  sleep_hours NUMERIC(4, 2),
  sleep_quality INTEGER,
  energy_level INTEGER,
  soreness_level INTEGER,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fitness_daily_logs_user_date UNIQUE (user_id, date)
);

-- 3. Meal Templates (Saved Indian Staples & Repeats)
CREATE TABLE IF NOT EXISTS public.meal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hindi_aliases TEXT[] NOT NULL DEFAULT '{}',
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
  fiber_g NUMERIC(6, 2),
  serving_label TEXT NOT NULL DEFAULT '1 serving',
  meal_type TEXT,
  is_junk BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Meal Logs (Daily Diet Entries, with indexed soft UUID linked_transaction_id)
CREATE TABLE IF NOT EXISTS public.meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'snack',
  name TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
  fiber_g NUMERIC(6, 2),
  quantity_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1,
  is_junk BOOLEAN NOT NULL DEFAULT false,
  template_id UUID,
  linked_transaction_id UUID,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Workout Sessions (Gym & Exercise Logs with JSONB exercises/sets)
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  workout_type TEXT NOT NULL DEFAULT 'strength',
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  estimated_calories_burned INTEGER,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  rpe INTEGER,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Supplement Inventory (with indexed soft UUID linked_transaction_id)
CREATE TABLE IF NOT EXISTS public.supplement_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  unit_label TEXT NOT NULL DEFAULT 'scoop',
  total_servings NUMERIC(8, 2) NOT NULL DEFAULT 30,
  remaining_servings NUMERIC(8, 2) NOT NULL DEFAULT 30,
  daily_dosage NUMERIC(6, 2) NOT NULL DEFAULT 1,
  cost_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  low_stock_threshold_days INTEGER NOT NULL DEFAULT 7,
  linked_transaction_id UUID,
  last_restocked_at DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Supplement Logs (Daily intake tracking)
CREATE TABLE IF NOT EXISTS public.supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL,
  date DATE NOT NULL,
  servings_taken NUMERIC(6, 2) NOT NULL DEFAULT 1,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  generation_counter BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Additive Columns on Existing Tables
-- =============================================================================

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS polarity TEXT NOT NULL DEFAULT 'build',
  ADD COLUMN IF NOT EXISTS anchor_block TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS financial_link JSONB,
  ADD COLUMN IF NOT EXISTS fitness_link JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS show_fitness BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_finance BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_tasks BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_goals BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_milestones BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS habit_only_mode BOOLEAN DEFAULT FALSE;

-- =============================================================================
-- Performance Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_fitness_profiles_user
  ON public.fitness_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_fitness_daily_logs_user_date
  ON public.fitness_daily_logs(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_meal_templates_user
  ON public.meal_templates(user_id, is_pinned, order_index);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date
  ON public.meal_logs(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_meal_logs_linked_tx
  ON public.meal_logs(user_id, linked_transaction_id)
  WHERE linked_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date
  ON public.workout_sessions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_supplement_inventory_user
  ON public.supplement_inventory(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_supplement_inventory_linked_tx
  ON public.supplement_inventory(user_id, linked_transaction_id)
  WHERE linked_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_date
  ON public.supplement_logs(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_supplement_logs_supplement
  ON public.supplement_logs(supplement_id, date DESC);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE public.fitness_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fitness_profiles' AND policyname = 'Users manage own fitness_profiles') THEN
    CREATE POLICY "Users manage own fitness_profiles" ON public.fitness_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fitness_daily_logs' AND policyname = 'Users manage own fitness_daily_logs') THEN
    CREATE POLICY "Users manage own fitness_daily_logs" ON public.fitness_daily_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meal_templates' AND policyname = 'Users manage own meal_templates') THEN
    CREATE POLICY "Users manage own meal_templates" ON public.meal_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meal_logs' AND policyname = 'Users manage own meal_logs') THEN
    CREATE POLICY "Users manage own meal_logs" ON public.meal_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workout_sessions' AND policyname = 'Users manage own workout_sessions') THEN
    CREATE POLICY "Users manage own workout_sessions" ON public.workout_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplement_inventory' AND policyname = 'Users manage own supplement_inventory') THEN
    CREATE POLICY "Users manage own supplement_inventory" ON public.supplement_inventory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplement_logs' AND policyname = 'Users manage own supplement_logs') THEN
    CREATE POLICY "Users manage own supplement_logs" ON public.supplement_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =============================================================================
-- Realtime Replication + Vector Clock Guards
-- =============================================================================

ALTER TABLE public.fitness_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.fitness_daily_logs REPLICA IDENTITY FULL;
ALTER TABLE public.meal_templates REPLICA IDENTITY FULL;
ALTER TABLE public.meal_logs REPLICA IDENTITY FULL;
ALTER TABLE public.workout_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.supplement_inventory REPLICA IDENTITY FULL;
ALTER TABLE public.supplement_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fitness_profiles') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_profiles;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fitness_daily_logs') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_daily_logs;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'meal_templates') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_templates;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'meal_logs') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_logs;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workout_sessions') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'supplement_inventory') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.supplement_inventory;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'supplement_logs') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.supplement_logs;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_generation_clock_vector()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.generation_counter <= OLD.generation_counter THEN
      RETURN OLD;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_fitness_profiles_generation_vector_barrier ON public.fitness_profiles;
CREATE TRIGGER tr_fitness_profiles_generation_vector_barrier
  BEFORE UPDATE ON public.fitness_profiles
  FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_fitness_daily_logs_generation_vector_barrier ON public.fitness_daily_logs;
CREATE TRIGGER tr_fitness_daily_logs_generation_vector_barrier
  BEFORE UPDATE ON public.fitness_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_meal_templates_generation_vector_barrier ON public.meal_templates;
CREATE TRIGGER tr_meal_templates_generation_vector_barrier
  BEFORE UPDATE ON public.meal_templates
  FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_meal_logs_generation_vector_barrier ON public.meal_logs;
CREATE TRIGGER tr_meal_logs_generation_vector_barrier
  BEFORE UPDATE ON public.meal_logs
  FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_workout_sessions_generation_vector_barrier ON public.workout_sessions;
CREATE TRIGGER tr_workout_sessions_generation_vector_barrier
  BEFORE UPDATE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_supplement_inventory_generation_vector_barrier ON public.supplement_inventory;
CREATE TRIGGER tr_supplement_inventory_generation_vector_barrier
  BEFORE UPDATE ON public.supplement_inventory
  FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_supplement_logs_generation_vector_barrier ON public.supplement_logs;
CREATE TRIGGER tr_supplement_logs_generation_vector_barrier
  BEFORE UPDATE ON public.supplement_logs
  FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();
