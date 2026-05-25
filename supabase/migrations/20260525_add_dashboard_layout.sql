-- Add dashboard_layout to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS dashboard_layout JSONB DEFAULT '["hero", "metrics", "today-tasks", "habit-overview", "focus-goal", "ai-quote", "ai-coach", "quick-actions"]'::jsonb;
