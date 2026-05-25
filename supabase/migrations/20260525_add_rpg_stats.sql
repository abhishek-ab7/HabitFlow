-- Up migration
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS stats jsonb DEFAULT '{"vitality": 1, "intelligence": 1, "discipline": 1, "charisma": 1, "wealth": 1, "creativity": 1}'::jsonb;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS unlocked_themes text[] DEFAULT '{}'::text[];
