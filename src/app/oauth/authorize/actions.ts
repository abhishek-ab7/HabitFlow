'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { issueAuthorizationCode, validateOAuthClient } from '@/lib/mcp/oauth';
import { MCP_ENDPOINT } from '@/lib/mcp/config';
import { redirect } from 'next/navigation';

export async function approveAuthorizationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('User is not authenticated.');
  }

  const clientId = formData.get('client_id') as string;
  const redirectUri = formData.get('redirect_uri') as string;
  const codeChallenge = formData.get('code_challenge') as string;
  const codeChallengeMethod = (formData.get('code_challenge_method') as string) || 'S256';
  const state = formData.get('state') as string;
  const resource = (formData.get('resource') as string) || MCP_ENDPOINT;
  const rawScopes = formData.getAll('scopes') as string[];

  const scopes = rawScopes.length > 0 ? rawScopes : ['habitflow:read'];

  // Validate client and redirect_uri
  const validation = await validateOAuthClient(clientId, redirectUri);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid OAuth client.');
  }

  const code = await issueAuthorizationCode({
    userId: session.user.id,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    resource,
    scopes,
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  redirect(redirectUrl.toString());
}

export async function denyAuthorizationAction(formData: FormData) {
  const redirectUri = formData.get('redirect_uri') as string;
  const state = formData.get('state') as string;

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('error', 'access_denied');
  redirectUrl.searchParams.set('error_description', 'The user denied the authorization request.');
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  redirect(redirectUrl.toString());
}
