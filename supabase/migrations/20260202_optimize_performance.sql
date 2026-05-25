-- Add missing foreign key indexes
-- These indexes were flagged by the Supabase linter as missing, causing performance issues on joins.
CREATE INDEX IF NOT EXISTS idx_habits_routine_id ON public.habits(routine_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON public.milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON public.routines(user_id);

-- Optimize RLS Policies
-- The linter flagged that using `auth.uid()` directly in policies can cause re-evaluation for every row.
-- The fix is to wrap it in a scalar subquery: `(select auth.uid())`.

-- USER_SETTINGS
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings 
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings 
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings 
    FOR UPDATE USING (user_id = (select auth.uid()));

-- ROUTINES
DROP POLICY IF EXISTS "Users can view own routines" ON public.routines;
CREATE POLICY "Users can view own routines" ON public.routines 
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own routines" ON public.routines;
CREATE POLICY "Users can insert own routines" ON public.routines 
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own routines" ON public.routines;
CREATE POLICY "Users can update own routines" ON public.routines 
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own routines" ON public.routines;
CREATE POLICY "Users can delete own routines" ON public.routines 
    FOR DELETE USING (user_id = (select auth.uid()));

-- TASKS
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks" ON public.tasks 
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks" ON public.tasks 
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks" ON public.tasks 
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks" ON public.tasks 
    FOR DELETE USING (user_id = (select auth.uid()));

-- HABIT_ROUTINES
DROP POLICY IF EXISTS "Users can view own habit_routines" ON public.habit_routines;
CREATE POLICY "Users can view own habit_routines" ON public.habit_routines 
    FOR SELECT USING (EXISTS ( 
        SELECT 1 FROM habits 
        WHERE habits.id = habit_routines.habit_id 
        AND habits.user_id = (select auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert own habit_routines" ON public.habit_routines;
CREATE POLICY "Users can insert own habit_routines" ON public.habit_routines 
    FOR INSERT WITH CHECK (EXISTS ( 
        SELECT 1 FROM habits 
        WHERE habits.id = habit_routines.habit_id 
        AND habits.user_id = (select auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update own habit_routines" ON public.habit_routines;
CREATE POLICY "Users can update own habit_routines" ON public.habit_routines 
    FOR UPDATE USING (EXISTS ( 
        SELECT 1 FROM habits 
        WHERE habits.id = habit_routines.habit_id 
        AND habits.user_id = (select auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete own habit_routines" ON public.habit_routines;
CREATE POLICY "Users can delete own habit_routines" ON public.habit_routines 
    FOR DELETE USING (EXISTS ( 
        SELECT 1 FROM habits 
        WHERE habits.id = habit_routines.habit_id 
        AND habits.user_id = (select auth.uid())
    ));
