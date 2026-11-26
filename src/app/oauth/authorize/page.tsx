import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateOAuthClient } from '@/lib/mcp/oauth';
import { MCP_SCOPES, SCOPE_DESCRIPTIONS, type McpScope } from '@/lib/mcp/config';
import { approveAuthorizationAction, denyAuthorizationAction } from './actions';
import { ShieldCheck, Lock, ExternalLink, AlertTriangle } from 'lucide-react';

interface AuthorizePageProps {
  searchParams: Promise<{
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    resource?: string;
  }>;
}

function OAuthErrorView({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function validateOAuthRequestParams(params: {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}) {
  if (params.response_type !== 'code') {
    return (
      <OAuthErrorView title="Unsupported Response Type">
        <p className="text-sm text-zinc-400">
          HabitFlow MCP OAuth 2.1 requires <code className="text-zinc-200">response_type=code</code>.
        </p>
      </OAuthErrorView>
    );
  }
  const hasRequiredParams = Boolean(params.client_id && params.redirect_uri && params.code_challenge);
  if (!hasRequiredParams) {
    return (
      <OAuthErrorView title="Missing Parameters">
        <p className="text-sm text-zinc-400">
          Authorization requires <code className="text-zinc-200">client_id</code>,{' '}
          <code className="text-zinc-200">redirect_uri</code>, and PKCE{' '}
          <code className="text-zinc-200">code_challenge</code>.
        </p>
      </OAuthErrorView>
    );
  }
  if (params.code_challenge_method && params.code_challenge_method !== 'S256') {
    return (
      <OAuthErrorView title="Insecure PKCE Method">
        <p className="text-sm text-zinc-400">
          HabitFlow MCP strictly enforces PKCE with <code className="text-zinc-200">code_challenge_method=S256</code>.
        </p>
      </OAuthErrorView>
    );
  }
  return null;
}

export default async function OAuthAuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = await searchParams;
  const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, resource } = params;

  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const fullQuery = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/login?redirectedFrom=/oauth/authorize?${fullQuery}`);
  }

  const paramError = validateOAuthRequestParams(params);
  if (paramError) return paramError;

  const clientId = client_id!;
  const redirectUri = redirect_uri!;
  const codeChallenge = code_challenge!;

  const validation = await validateOAuthClient(clientId, redirectUri);
  if (!validation.valid) {
    return (
      <OAuthErrorView title="Client Verification Failed">
        <p className="text-sm text-zinc-400 mb-2">{validation.error}</p>
        <div className="bg-zinc-950/60 p-3 rounded-lg text-xs font-mono text-zinc-400 break-all">
          client_id: {clientId}
          <br />
          redirect_uri: {redirectUri}
        </div>
      </OAuthErrorView>
    );
  }

  const requestedScopesList = (scope ? scope.split(' ') : [...MCP_SCOPES])
    .map((s) => s.trim())
    .filter((s): s is McpScope => MCP_SCOPES.includes(s as McpScope));
  const scopesToDisplay = requestedScopesList.length > 0 ? requestedScopesList : [...MCP_SCOPES];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090D0E] p-4 text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300">
      <div className="max-w-lg w-full bg-[#111618] border border-zinc-800/80 rounded-3xl p-7 shadow-2xl shadow-black/60 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80" />
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">HabitFlow Authorization</h1>
            <p className="text-xs text-zinc-400">OAuth 2.1 Remote MCP Connection</p>
          </div>
        </div>

        <div className="bg-[#171E20] border border-zinc-800/60 rounded-2xl p-4 mb-5">
          <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Connecting Application</div>
          <div className="text-base font-semibold text-emerald-400 flex items-center gap-1.5">
            {validation.clientName}
            {clientId.startsWith('https://') && <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />}
          </div>
          <div className="text-xs text-zinc-400 mt-1 truncate font-mono">
            Redirect URI: {redirectUri}
          </div>
        </div>

        <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
          <strong>{validation.clientName}</strong> is requesting permission to access your HabitFlow workspace logged in as{' '}
          <span className="text-zinc-100 font-medium">{session.user.email}</span>.
        </p>

        <form action={approveAuthorizationAction} className="space-y-4">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={code_challenge_method || 'S256'} />
          {state && <input type="hidden" name="state" value={state} />}
          {resource && <input type="hidden" name="resource" value={resource} />}

          <div className="space-y-2.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Requested Permissions</div>
            {scopesToDisplay.map((s) => (
              <label
                key={s}
                className="flex items-start gap-3 bg-[#171E20]/60 border border-zinc-800/60 rounded-xl p-3 cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <input
                  type="checkbox"
                  name="scopes"
                  value={s}
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20"
                />
                <div className="text-xs">
                  <div className="font-semibold text-zinc-200">{s}</div>
                  <div className="text-zinc-400 leading-snug">{SCOPE_DESCRIPTIONS[s]}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="pt-3 flex items-center gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-all duration-150 shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              Authorize Access
            </button>
          </div>
        </form>

        <form action={denyAuthorizationAction} className="mt-2.5">
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          {state && <input type="hidden" name="state" value={state} />}
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl border border-zinc-800 hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel & Deny Request
          </button>
        </form>

        <div className="mt-5 text-center text-[11px] text-zinc-400">
          You can revoke access to external applications at any time in HabitFlow Settings.
        </div>
      </div>
    </div>
  );
}
