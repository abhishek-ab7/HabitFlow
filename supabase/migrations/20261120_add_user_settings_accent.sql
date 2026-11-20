-- Add accent palette persistence column to user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS accent text DEFAULT 'mint';
