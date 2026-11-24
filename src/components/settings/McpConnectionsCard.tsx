'use client';

import { useState, useEffect } from 'react';
import {
  Server,
  Copy,
  Check,
  KeyRound,
  ExternalLink,
  Shield,
  Activity,
  Trash2,
  RefreshCw,
  Terminal,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  tool_name: string;
  action: string | null;
  status: string;
  duration_ms: number;
  created_at: string;
  input_summary: string;
}

interface ConnectedApp {
  clientId: string;
  scopes: string[];
  firstConnectedAt: string;
}

export function McpConnectionsCard() {
  const endpointUrl = 'https://habit-flow-ochre-two.vercel.app/api/mcp';
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'gemini' | 'claude_code' | 'claude_desktop' | 'cursor'>('gemini');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnectionsData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/mcp/connections');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.auditLogs || []);
        setConnectedApps(data.connectedApps || []);
        setUserId(data.userId || '');
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

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopiedEndpoint(true);
    toast.success('MCP Endpoint copied to clipboard');
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleGenerateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    setGeneratedSecret(hex);
    toast.success('Generated 256-bit random secret');
  };

  const handleCopySecret = () => {
    if (!generatedSecret) return;
    navigator.clipboard.writeText(generatedSecret);
    setCopiedSecret(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setCopiedSecret(false), 2000);
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

  const snippets = {
    gemini: `# Gemini App (Developer Mode) Settings:
1. Open Gemini -> Settings -> Developer / Extensions -> Custom MCP
2. URL: https://habit-flow-ochre-two.vercel.app/api/mcp
3. Auth: Select OAuth 2.1 (recommended) or Bearer Token`,
    claude_code: `# Claude Code CLI:
claude mcp add --transport http habitflow https://habit-flow-ochre-two.vercel.app/api/mcp`,
    claude_desktop: `// claude_desktop_config.json:
{
  "mcpServers": {
    "habitflow": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://habit-flow-ochre-two.vercel.app/api/mcp",
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
      "url": "https://habit-flow-ochre-two.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_SECRET>"
      }
    }
  }
}`,
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopiedSnippet(true);
    toast.success('Configuration snippet copied');
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
              Model Context Protocol (MCP) Server
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Live Remote
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect external AI agents (Gemini App, Claude Desktop, Cursor, Antigravity) to query and edit your HabitFlow data.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchConnectionsData}
          className="h-8 px-2.5 text-xs gap-1.5 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Production Endpoint Display */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Canonical Streamable HTTP Endpoint
        </label>
        <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl p-2.5">
          <code className="text-xs font-mono text-foreground flex-1 truncate select-all">
            {endpointUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyEndpoint}
            className="h-8 px-3 text-xs gap-1.5 shrink-0"
          >
            {copiedEndpoint ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedEndpoint ? 'Copied' : 'Copy URL'}
          </Button>
        </div>
      </div>

      {/* Client Configuration Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Client Connection Setup
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopySnippet}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            {copiedSnippet ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            Copy Snippet
          </Button>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border rounded-xl text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'gemini' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Gemini App
          </button>
          <button
            onClick={() => setActiveTab('claude_code')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'claude_code' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Claude Code
          </button>
          <button
            onClick={() => setActiveTab('claude_desktop')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'claude_desktop' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Claude Desktop
          </button>
          <button
            onClick={() => setActiveTab('cursor')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'cursor' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cursor / Antigravity
          </button>
        </div>

        <pre className="p-3.5 bg-zinc-950 border border-border/80 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {snippets[activeTab]}
        </pre>
      </div>

      {/* Secret Token Generator Helper */}
      <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Personal Token Generator (Vercel Env Vars)</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSecret}
            className="h-8 px-3 text-xs gap-1.5"
          >
            Generate New Token
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground leading-normal">
          For fast-track Bearer token auth, generate a 256-bit random secret below, then copy and paste it into your{' '}
          <strong>Vercel Project Settings → Environment Variables</strong> as <code className="text-foreground">HABITFLOW_MCP_SECRET</code>, alongside{' '}
          <code className="text-foreground">HABITFLOW_MCP_USER_ID={userId || '<your-user-id>'}</code>.
        </p>

        {generatedSecret && (
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-2">
            <code className="text-xs font-mono text-emerald-500 flex-1 truncate select-all">
              {generatedSecret}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopySecret}
              className="h-7 px-2.5 text-xs gap-1"
            >
              {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              Copy
            </Button>
          </div>
        )}
      </div>

      {/* Connected OAuth Applications */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Connected OAuth Applications
          </h3>
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
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
                    Scopes: {app.scopes.join(', ')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevokeApp(app.clientId)}
                  className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 shrink-0 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redacted Audit Logs Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent MCP Tool Activity (Redacted Audit Trail)
          </h3>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
            No write operations logged yet. Invocations of write tools will automatically appear here.
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="py-2.5 px-3">Tool</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {auditLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 font-semibold text-foreground">{log.tool_name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{log.action || '-'}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          log.status === 'ok'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                      {log.duration_ms}ms
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground text-[11px] tabular-nums">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
