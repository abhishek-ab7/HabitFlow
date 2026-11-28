-- Outbound Read-Only External MCP Sources (Bidirectional MCP Client)
create table if not exists public.user_external_mcp_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  provider_kind text not null check (provider_kind in ('google_calendar', 'gmail', 'strava_health', 'custom')),
  endpoint_url text not null,
  encrypted_token text,
  token_hint text,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_external_mcp_sources_user
  on public.user_external_mcp_sources (user_id);

alter table public.user_external_mcp_sources enable row level security;

create policy "Users can view own external MCP sources"
  on public.user_external_mcp_sources for select
  using (auth.uid() = user_id);

create policy "Users can insert own external MCP sources"
  on public.user_external_mcp_sources for insert
  with check (auth.uid() = user_id);

create policy "Users can update own external MCP sources"
  on public.user_external_mcp_sources for update
  using (auth.uid() = user_id);

create policy "Users can delete own external MCP sources"
  on public.user_external_mcp_sources for delete
  using (auth.uid() = user_id);
