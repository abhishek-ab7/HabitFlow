-- Migration: 20261124_add_mcp_audit_and_oauth.sql
-- Description: Adds tables for MCP write audit logging and MCP OAuth 2.1 RFC-compliant authorization

-- 1. MCP Audit Logs
CREATE TABLE IF NOT EXISTS mcp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    action TEXT,
    auth_mode TEXT NOT NULL,
    client_id TEXT,
    scopes TEXT[],
    input_summary TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mcp_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mcp audit logs"
    ON mcp_audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_user_created
    ON mcp_audit_logs (user_id, created_at DESC);

-- 2. MCP OAuth Clients (Registered via DCR or static pre-registration)
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
    client_id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_uri TEXT,
    logo_uri TEXT,
    redirect_uris TEXT[] NOT NULL,
    grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
    response_types TEXT[] NOT NULL DEFAULT ARRAY['code'],
    scope TEXT NOT NULL DEFAULT 'habitflow:read',
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
    is_trusted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read registered oauth client details"
    ON mcp_oauth_clients
    FOR SELECT
    USING (true);

-- 3. MCP OAuth Authorization Codes (Short-lived, single-use, PKCE S256 mandatory)
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
    code_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    resource TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expires
    ON mcp_oauth_codes (expires_at);

-- 4. MCP OAuth Tokens (SHA-256 hashed access and refresh tokens)
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_type TEXT NOT NULL DEFAULT 'access_token',
    resource TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and revoke their own oauth tokens"
    ON mcp_oauth_tokens
    FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_lookup
    ON mcp_oauth_tokens (token_hash, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user
    ON mcp_oauth_tokens (user_id, client_id);
