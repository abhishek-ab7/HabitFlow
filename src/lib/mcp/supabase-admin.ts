import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from './config';

let adminClientInstance: SupabaseClient | null = null;

/**
 * Returns a singleton server-only Supabase client initialized with the Service Role key.
 * 
 * IMPORTANT SECURITY RULE:
 * Because the Service Role key bypasses Row Level Security (RLS), every table query
 * constructed with this client MUST explicitly include `.eq('user_id', authenticatedUserId)`.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClientInstance) return adminClientInstance;

  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  adminClientInstance = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClientInstance;
}
