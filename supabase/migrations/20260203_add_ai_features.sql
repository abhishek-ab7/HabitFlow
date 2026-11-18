-- ============================================
-- AI FEATURES EXPANSION - MIGRATION
-- Created: 2026-02-03
-- Features: Goal Milestones, Habit Stacking, Personalized Quotes, Habit Descriptions
-- ============================================

-- ============================================
-- 1. AI GENERATED MILESTONES
-- ============================================

CREATE TABLE IF NOT EXISTS ai_generated_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  milestone_title TEXT NOT NULL,
  description TEXT,
  suggested_deadline DATE,
  order_index INTEGER NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_accepted BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  ai_reasoning TEXT,
  estimated_time_weeks INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_goal_milestone UNIQUE(goal_id, order_index)
);

-- Indexes
CREATE INDEX idx_ai_milestones_user ON ai_generated_milestones(user_id);
CREATE INDEX idx_ai_milestones_goal ON ai_generated_milestones(goal_id);
CREATE INDEX idx_ai_milestones_accepted ON ai_generated_milestones(is_accepted) WHERE is_accepted = true;

-- RLS Policies
ALTER TABLE ai_generated_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI milestones" ON ai_generated_milestones
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own AI milestones" ON ai_generated_milestones
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own AI milestones" ON ai_generated_milestones
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own AI milestones" ON ai_generated_milestones
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 2. HABIT STACKS
-- ============================================

CREATE TABLE IF NOT EXISTS habit_stacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  stacked_habit_ids UUID[] NOT NULL,
  suggested_order TEXT[],
  ai_reasoning TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_time_minutes INTEGER,
  expected_success_rate INTEGER CHECK (expected_success_rate BETWEEN 0 AND 100),
  is_active BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT true,
  activation_count INTEGER DEFAULT 0,
  last_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_habit_stacks_user ON habit_stacks(user_id);
CREATE INDEX idx_habit_stacks_active ON habit_stacks(is_active) WHERE is_active = true;
CREATE INDEX idx_habit_stacks_trigger ON habit_stacks(trigger_habit_id);

-- RLS Policies
ALTER TABLE habit_stacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habit stacks" ON habit_stacks
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can manage own habit stacks" ON habit_stacks
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 3. MOTIVATIONAL QUOTES
-- ============================================

CREATE TABLE IF NOT EXISTS motivational_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_text TEXT NOT NULL,
  author TEXT,
  context TEXT,
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
  reasoning TEXT,
  actionable_insight TEXT,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  user_reaction TEXT CHECK (user_reaction IN ('liked', 'disliked', 'neutral', null)),
  related_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  related_habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  is_ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quotes_user ON motivational_quotes(user_id);
CREATE INDEX idx_quotes_context ON motivational_quotes(context);
CREATE INDEX idx_quotes_liked ON motivational_quotes(user_reaction) WHERE user_reaction = 'liked';
CREATE INDEX idx_quotes_recent ON motivational_quotes(shown_at DESC);

-- RLS Policies
ALTER TABLE motivational_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quotes" ON motivational_quotes
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can manage own quotes" ON motivational_quotes
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 4. HABIT DESCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS habit_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  benefits TEXT[],
  tips TEXT[],
  difficulty_assessment TEXT CHECK (difficulty_assessment IN ('beginner', 'intermediate', 'advanced')),
  estimated_time_minutes INTEGER,
  scientific_backing TEXT,
  common_pitfalls TEXT[],
  is_active BOOLEAN DEFAULT true,
  user_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: only one active description per habit
CREATE UNIQUE INDEX idx_unique_active_habit_desc ON habit_descriptions(habit_id, is_active) WHERE is_active = true;

-- Indexes
CREATE INDEX idx_habit_desc_habit ON habit_descriptions(habit_id);
CREATE INDEX idx_habit_desc_user ON habit_descriptions(user_id);

-- RLS Policies
ALTER TABLE habit_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habit descriptions" ON habit_descriptions
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can manage own habit descriptions" ON habit_descriptions
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 5. AI CACHE (Persistent)
-- ============================================

CREATE TABLE IF NOT EXISTS ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  feature_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cached_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);
CREATE INDEX idx_ai_cache_user_feature ON ai_cache(user_id, feature_type);

-- RLS Policies
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache" ON ai_cache
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

CREATE POLICY "System can manage cache" ON ai_cache
  FOR ALL USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_ai_milestones_updated_at
  BEFORE UPDATE ON ai_generated_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habit_stacks_updated_at
  BEFORE UPDATE ON habit_stacks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habit_descriptions_updated_at
  BEFORE UPDATE ON habit_descriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ANALYTICS VIEWS (Optional)
-- ============================================

-- View for habit stack performance
CREATE OR REPLACE VIEW habit_stack_analytics AS
SELECT 
  hs.id,
  hs.user_id,
  hs.name,
  hs.is_active,
  hs.activation_count,
  hs.expected_success_rate,
  COUNT(DISTINCT c.id) as actual_completions,
  hs.created_at
FROM habit_stacks hs
LEFT JOIN completions c ON c.habit_id = ANY(hs.stacked_habit_ids)
  AND c.date >= hs.last_activated_at::date
GROUP BY hs.id;

-- View for quote engagement
CREATE OR REPLACE VIEW quote_engagement_analytics AS
SELECT 
  user_id,
  context,
  COUNT(*) as total_quotes,
  AVG(relevance_score) as avg_relevance,
  COUNT(*) FILTER (WHERE user_reaction = 'liked') as liked_count,
  COUNT(*) FILTER (WHERE user_reaction = 'disliked') as disliked_count,
  COUNT(*) FILTER (WHERE user_reaction IS NULL) as neutral_count
FROM motivational_quotes
GROUP BY user_id, context;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ai_generated_milestones IS 'AI-generated milestones for goals with acceptance tracking';
COMMENT ON TABLE habit_stacks IS 'Smart habit stacking suggestions based on user patterns';
COMMENT ON TABLE motivational_quotes IS 'Personalized motivational quotes with context awareness';
COMMENT ON TABLE habit_descriptions IS 'AI-generated habit descriptions with benefits and tips';
COMMENT ON TABLE ai_cache IS 'Persistent cache for AI responses to reduce API calls';

-- ============================================
-- GRANT PERMISSIONS (if needed)
-- ============================================

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
