'use client';

import { useState, useEffect } from 'react';
import {
  Server,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Trash2,
  RefreshCw,
  Terminal,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ConnectedApp {
  clientId: string;
  scopes: string[];
  firstConnectedAt: string;
}

const CLIENT_TABS = [
  { id: 'gemini', label: 'Gemini App' },
  { id: 'claude_code', label: 'Claude Code' },
  { id: 'claude_desktop', label: 'Claude Desktop' },
  { id: 'cursor', label: 'Cursor / Antigravity' },
] as const;

type ClientTabId = (typeof CLIENT_TABS)[number]['id'];

function buildClientSnippets(endpointUrl: string): Record<ClientTabId, string> {
  return {
    gemini: `# Gemini App (Developer Mode) Settings:
1. Open Gemini -> Settings -> Developer / Extensions -> Custom MCP
2. URL: ${endpointUrl}
3. Auth: Select OAuth 2.1 (recommended) or Bearer Token`,
    claude_code: `# Claude Code CLI:
claude mcp add --transport http habitflow ${endpointUrl}`,
    claude_desktop: `// claude_desktop_config.json:
{
  "mcpServers": {
    "habitflow": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${endpointUrl}",
        "--header",
        "Authorization: Bearer \${HABITFLOW_MCP_SECRET}"
      ],
      "env": {
        "HABITFLOW_MCP_SECRET": "<YOUR_SECRET>"
      }
    }
  }
}`,
    cursor: `// .cursor/mcp.json (or Antigravity mcp_config.json):
{
  "mcpServers": {
    "habitflow": {
      "url": "${endpointUrl}",
      "headers": {
        "Authorization": "Bearer <YOUR_SECRET>"
      }
    }
  }
}`,
  };
}

function ConnectedOAuthAppsList({
  connectedApps,
  onRevoke,
}: {
  connectedApps: ConnectedApp[];
  onRevoke: (clientId: string) => void;
}) {
  return (
    <div className="lg:col-span-5 space-y-5 min-w-0">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connected OAuth Applications</h3>
        </div>
        {connectedApps.length === 0 ? (
          <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
            No external OAuth applications currently connected.
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {connectedApps.map((app) => (
              <div key={app.clientId} className="p-3.5 flex items-center justify-between gap-3 bg-muted/10">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{app.clientId}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">Scopes: {app.scopes.join(', ')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onRevoke(app.clientId)} className="h-8 px-2.5 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 border-red-500/20 shrink-0 gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function McpConnectionsCard() {
  const [endpointUrl, setEndpointUrl] = useState('https://habitflow.tech/api/mcp');
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientTabId>('gemini');
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnectionsData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/mcp/connections');
      if (res.ok) {
        const data = await res.json();
        if (data.endpointUrl) setEndpointUrl(data.endpointUrl);
        setConnectedApps(data.connectedApps || []);
      }
    } catch (err) {
      console.warn('Failed to fetch MCP connection info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectionsData();
  }, []);

  const snippets = buildClientSnippets(endpointUrl);

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopiedEndpoint(true);
    toast.success('MCP Endpoint copied to clipboard');
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleRevokeApp = async (clientId: string) => {
    try {
      const res = await fetch('/api/mcp/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_app', clientId }),
      });
      if (res.ok) {
        toast.success(`Revoked access for ${clientId}`);
        fetchConnectionsData();
      } else {
        toast.error('Failed to revoke application');
      }
    } catch {
      toast.error('Error revoking application');
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopiedSnippet(true);
    toast.success('Configuration snippet copied');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0"><Server className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground tracking-tight">Model Context Protocol (MCP) Server</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                Live Remote
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Connect external AI agents (Gemini App, Claude Desktop, Cursor, Antigravity) to query and edit your HabitFlow data.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConnectionsData} className="h-8 px-3 text-xs gap-1.5 shrink-0 self-start sm:self-center">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5 min-w-0">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Canonical Streamable HTTP Endpoint</label>
            <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl p-2.5">
              <code className="text-xs font-mono text-foreground flex-1 truncate select-all">{endpointUrl}</code>
              <Button variant="outline" size="sm" onClick={handleCopyEndpoint} className="h-8 px-3 text-xs gap-1.5 shrink-0">
                {copiedEndpoint ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedEndpoint ? 'Copied' : 'Copy URL'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client Connection Setup</label>
              <Button variant="ghost" size="sm" onClick={handleCopySnippet} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0">
                {copiedSnippet ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy Snippet
              </Button>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border rounded-xl text-xs overflow-x-auto">
              {CLIENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <pre className="p-3.5 bg-zinc-950 border border-border/80 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {snippets[activeTab]}
            </pre>
          </div>
        </div>

        <ConnectedOAuthAppsList connectedApps={connectedApps} onRevoke={handleRevokeApp} />
      </div>
    </section>
  );
}
