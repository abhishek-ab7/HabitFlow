-- Migration to completely remove Routines feature tables and dependencies
DROP TABLE IF EXISTS public.habit_routines CASCADE;
DROP TABLE IF EXISTS public.routine_completions CASCADE;
DROP TABLE IF EXISTS public.routines CASCADE;
ALTER TABLE public.habits DROP COLUMN IF EXISTS routine_id;
