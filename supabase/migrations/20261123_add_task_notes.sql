-- Add quick notes persistence column to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
