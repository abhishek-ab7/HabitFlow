-- =============================================
-- HOTFIX: 409 Conflict Errors on Completions
-- =============================================
-- This migration fixes RLS policies that are blocking users from accessing their data
-- Root cause: Recent conflict-resolution migration may have altered or removed RLS policies

-- ===========================================
-- CRITICAL FIX: Restore RLS Policies
-- ===========================================

-- Enable RLS if not already enabled
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view own completions" ON completions;
DROP POLICY IF EXISTS "Users can insert own completions" ON completions;
DROP POLICY IF EXISTS "Users can update own completions" ON completions;
DROP POLICY IF EXISTS "Users can delete own completions" ON completions;

-- Recreate RLS policies with correct permissions

-- SELECT policy: Users can view their own completions
CREATE POLICY "Users can view own completions" ON completions
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT policy: Users can create their own completions
CREATE POLICY "Users can insert own completions" ON completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: Users can update their own completions
CREATE POLICY "Users can update own completions" ON completions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE policy: Users can delete their own completions
CREATE POLICY "Users can delete own completions" ON completions
FOR DELETE
USING (auth.uid() = user_id);

-- ===========================================
-- VERIFICATION: Ensure updated_at exists
-- ===========================================

-- Verify updated_at column exists (should from conflict-resolution migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'completions' AND column_name = 'updated_at'
    ) THEN
        -- Add it if it doesn't exist
        ALTER TABLE completions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Backfill with created_at
        UPDATE completions SET updated_at = created_at WHERE updated_at IS NULL;
        
        -- Create trigger
        CREATE TRIGGER update_completions_updated_at 
        BEFORE UPDATE ON completions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ===========================================
-- OPTIONAL: Fix any NULL updated_at values
-- ===========================================

-- Ensure no NULL values in updated_at
UPDATE completions 
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'completions';

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'completions'
ORDER BY cmd;

-- Check for NULL updated_at values
SELECT COUNT(*) as null_updated_at_count
FROM completions
WHERE updated_at IS NULL;

-- SUCCESS MESSAGE
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies restored on completions table';
    RAISE NOTICE '✅ updated_at column verified';
    RAISE NOTICE '✅ 409 Conflict errors should now be resolved';
END $$;
