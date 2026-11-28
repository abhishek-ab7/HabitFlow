'use client';

import React, { useEffect, useState } from 'react';
import { Globe, Loader2, Plug, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ExternalMcpProviderKind } from '@/lib/mcp/outbound-client';

interface ExternalSourceItem {
  id: string;
  label: string;
  providerKind: ExternalMcpProviderKind;
  endpointUrl: string;
  tokenHint?: string;
  enabled: boolean;
}

const PROVIDER_PRESETS: Array<{ kind: ExternalMcpProviderKind; label: string; placeholder: string }> = [
  { kind: 'google_calendar', label: 'Google Calendar MCP', placeholder: 'https://your-calendar-mcp.example.com/mcp' },
  { kind: 'gmail', label: 'Gmail Bills MCP', placeholder: 'https://your-gmail-mcp.example.com/mcp' },
  { kind: 'strava_health', label: 'Strava / Health MCP', placeholder: 'https://your-strava-mcp.example.com/mcp' },
  { kind: 'custom', label: 'Custom Read-Only MCP', placeholder: 'https://your-mcp-server.example.com/mcp' },
];

export function ExternalMcpSourcesCard() {
  const [sources, setSources] = useState<ExternalSourceItem[]>([]);
  const [providerKind, setProviderKind] = useState<ExternalMcpProviderKind>('google_calendar');
  const [label, setLabel] = useState('Google Calendar MCP');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [busy, setBusy] = useState(false);

  const loadSources = async () => {
    try {
      const res = await fetch('/api/mcp/external');
      if (res.ok) {
        const json = await res.json();
        setSources(Array.isArray(json.sources) ? json.sources : []);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    void loadSources();
  }, []);

  const handleSelectPreset = (preset: (typeof PROVIDER_PRESETS)[number]) => {
    setProviderKind(preset.kind);
    setLabel(preset.label);
  };

  const handleTest = async () => {
    if (!endpointUrl.trim()) return void toast.error('Enter an HTTPS MCP endpoint URL first');
    setBusy(true);
    try {
      const res = await fetch('/api/mcp/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', endpointUrl, bearerToken }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(`Connected! Found ${json.readOnlyTools?.length ?? 0} read-only tool(s)`);
      } else {
        toast.error(json.error || 'MCP connection test failed');
      }
    } catch {
      toast.error('Could not reach external MCP endpoint');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpointUrl.trim()) return void toast.error('Endpoint URL is required');
    setBusy(true);
    try {
      const res = await fetch('/api/mcp/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, providerKind, endpointUrl, bearerToken }),
      });
      const json = await res.json();
      if (!res.ok) return void toast.error(json.error || 'Failed to save MCP source');
      toast.success(`Connected ${label} (read-only)`);
      setEndpointUrl('');
      setBearerToken('');
      void loadSources();
    } catch {
      toast.error('Failed to save external MCP source');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/mcp/external?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Removed external MCP source');
        setSources((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      toast.error('Failed to remove source');
    }
  };

  const activePreset = PROVIDER_PRESETS.find((p) => p.kind === providerKind) || PROVIDER_PRESETS[0];

  return (
    <div
      data-testid="external-mcp-sources-card"
      className="rounded-2xl border border-border bg-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Outbound Read-Only MCP Sources (Coach Swarm Context)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect external HTTPS Streamable HTTP MCP servers (Calendar, Gmail, Strava). Tokens are encrypted at rest; only read-only tools are ever called.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
          <ShieldCheck className="h-3 w-3" /> Read-Only
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PROVIDER_PRESETS.map((preset) => (
          <Button
            key={preset.kind}
            type="button"
            size="sm"
            variant={providerKind === preset.kind ? 'default' : 'outline'}
            className="h-7 px-2.5 text-xs"
            onClick={() => handleSelectPreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Source label"
          className="px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground"
        />
        <input
          type="url"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          placeholder={activePreset.placeholder}
          className="px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground"
        />
        <input
          type="password"
          value={bearerToken}
          onChange={(e) => setBearerToken(e.target.value)}
          placeholder="Optional Bearer token (encrypted at rest)"
          className="px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground sm:col-span-2"
        />
        <div className="sm:col-span-2 flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleTest} className="text-xs gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
            Test Connection
          </Button>
          <Button type="submit" size="sm" disabled={busy} className="text-xs">
            Save Read-Only Source
          </Button>
        </div>
      </form>

      {sources.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {sources.map((src) => (
            <div key={src.id} className="p-3 flex items-center justify-between gap-2 bg-muted/10 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{src.label}</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  {src.endpointUrl} {src.tokenHint ? `· ${src.tokenHint}` : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${src.label}`}
                onClick={() => handleRemove(src.id)}
                className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
