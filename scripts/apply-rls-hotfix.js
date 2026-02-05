#!/usr/bin/env node

/**
 * Hotfix: Apply RLS policy fix to Supabase
 * This script applies the RLS policy fix migration to resolve 409 Conflict errors
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyRLSFix() {
  console.log('🔧 Applying RLS policy hotfix...\n');

  try {
    // Step 1: Enable RLS
    console.log('1️⃣  Enabling RLS on completions table...');
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE completions ENABLE ROW LEVEL SECURITY;'
    });

    // Step 2: Drop existing policies
    console.log('2️⃣  Dropping existing policies...');
    const policiesToDrop = [
      "Users can view own completions",
      "Users can insert own completions",
      "Users can update own completions",
      "Users can delete own completions"
    ];

    for (const policy of policiesToDrop) {
      await supabase.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "${policy}" ON completions;`
      });
    }

    // Step 3: Create SELECT policy
    console.log('3️⃣  Creating SELECT policy...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can view own completions" ON completions
        FOR SELECT
        USING (auth.uid() = user_id);
      `
    });

    // Step 4: Create INSERT policy
    console.log('4️⃣  Creating INSERT policy...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can insert own completions" ON completions
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      `
    });

    // Step 5: Create UPDATE policy
    console.log('5️⃣  Creating UPDATE policy...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can update own completions" ON completions
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
      `
    });

    // Step 6: Create DELETE policy
    console.log('6️⃣  Creating DELETE policy...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Users can delete own completions" ON completions
        FOR DELETE
        USING (auth.uid() = user_id);
      `
    });

    // Step 7: Fix NULL updated_at values
    console.log('7️⃣  Fixing NULL updated_at values...');
    const { error: updateError } = await supabase
      .from('completions')
      .update({ updated_at: new Date().toISOString() })
      .is('updated_at', null);

    if (updateError && updateError.code !== 'PGRST116') {
      console.warn('⚠️  Warning:', updateError.message);
    }

    console.log('\n✅ RLS policy hotfix applied successfully!');
    console.log('✅ 409 Conflict errors should now be resolved');
    console.log('\n📋 Next steps:');
    console.log('   1. Test the production site: https://habitflow.tech');
    console.log('   2. Login with a non-dev account');
    console.log('   3. Check browser console for 409 errors');
    
  } catch (error) {
    console.error('\n❌ Error applying RLS fix:', error);
    console.error('\n📝 Manual fix required:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Run the SQL from: supabase-hotfix-rls-409.sql');
    process.exit(1);
  }
}

// Note: Supabase doesn't support exec_sql RPC by default
// We need to use direct SQL execution via dashboard
console.log('⚠️  Supabase JS client cannot execute raw SQL for security.');
console.log('📝 Please apply the fix manually:\n');
console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/zqzegbvtoyqxidxuuzim');
console.log('2. Navigate to: SQL Editor');
console.log('3. Copy and run the SQL from: supabase-hotfix-rls-409.sql');
console.log('\n   OR\n');
console.log('4. Install PostgreSQL client: sudo dnf install postgresql');
console.log('5. Run: psql "$DATABASE_URL" -f supabase-hotfix-rls-409.sql');
