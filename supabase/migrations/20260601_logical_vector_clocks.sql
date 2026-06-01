-- Add generation_counter to all 10 synchronized tables
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.completions ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.habit_routines ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.routine_completions ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;
ALTER TABLE public.mood_logs ADD COLUMN IF NOT EXISTS generation_counter BIGINT DEFAULT 1 NOT NULL;

-- Create optimization procedures to automatically increment generation parameters inside database mutation hooks
CREATE OR REPLACE FUNCTION public.increment_generation_clock_vector()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF NEW.generation_counter <= OLD.generation_counter THEN
            -- Silently skip updates with older vector clocks, allowing client to succeed the push and pull the newer state later.
            RETURN OLD;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind protective evaluation boundaries to all tables
DROP TRIGGER IF EXISTS tr_user_settings_generation_vector_barrier ON public.user_settings;
CREATE TRIGGER tr_user_settings_generation_vector_barrier
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_habits_generation_vector_barrier ON public.habits;
CREATE TRIGGER tr_habits_generation_vector_barrier
    BEFORE UPDATE ON public.habits
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_completions_generation_vector_barrier ON public.completions;
CREATE TRIGGER tr_completions_generation_vector_barrier
    BEFORE UPDATE ON public.completions
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_goals_generation_vector_barrier ON public.goals;
CREATE TRIGGER tr_goals_generation_vector_barrier
    BEFORE UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_milestones_generation_vector_barrier ON public.milestones;
CREATE TRIGGER tr_milestones_generation_vector_barrier
    BEFORE UPDATE ON public.milestones
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_tasks_generation_vector_barrier ON public.tasks;
CREATE TRIGGER tr_tasks_generation_vector_barrier
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_routines_generation_vector_barrier ON public.routines;
CREATE TRIGGER tr_routines_generation_vector_barrier
    BEFORE UPDATE ON public.routines
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_habit_routines_generation_vector_barrier ON public.habit_routines;
CREATE TRIGGER tr_habit_routines_generation_vector_barrier
    BEFORE UPDATE ON public.habit_routines
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_routine_completions_generation_vector_barrier ON public.routine_completions;
CREATE TRIGGER tr_routine_completions_generation_vector_barrier
    BEFORE UPDATE ON public.routine_completions
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();

DROP TRIGGER IF EXISTS tr_mood_logs_generation_vector_barrier ON public.mood_logs;
CREATE TRIGGER tr_mood_logs_generation_vector_barrier
    BEFORE UPDATE ON public.mood_logs
    FOR EACH ROW EXECUTE FUNCTION public.increment_generation_clock_vector();
