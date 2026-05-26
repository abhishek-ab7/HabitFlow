-- Update habits table to support quantitative trackers
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_quantitative BOOLEAN DEFAULT FALSE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS target_value INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '';

-- Update completions table to support completion value
ALTER TABLE completions ADD COLUMN IF NOT EXISTS value INTEGER DEFAULT 0;

-- Create mood_logs table for daily check-ins
CREATE TABLE IF NOT EXISTS mood_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  mood TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Users can view own mood logs" ON mood_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mood logs" ON mood_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mood logs" ON mood_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mood logs" ON mood_logs FOR DELETE USING (auth.uid() = user_id);

-- Add to Realtime publication if not already present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Check if table is already in publication to avoid errors
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'mood_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE mood_logs;
    END IF;
  END IF;
END $$;
