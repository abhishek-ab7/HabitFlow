-- Up migration
ALTER TABLE public.completions ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed'::text;
-- Set default for existing records
UPDATE public.completions SET status = 'completed' WHERE status IS NULL;
-- Add constraint
ALTER TABLE public.completions ADD CONSTRAINT chk_completion_status CHECK (status IN ('completed', 'missed', 'frozen'));
