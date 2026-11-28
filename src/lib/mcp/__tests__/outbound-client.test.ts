import { describe, expect, it, vi } from 'vitest';
import {
  decryptMcpToken,
  encryptMcpToken,
  fetchExternalMcpContext,
  isReadOnlyMcpTool,
  maskMcpToken,
  validateOutboundMcpUrl,
} from '../outbound-client';

describe('Outbound Read-Only MCP Client (Phase F3 Security & Timeout)', () => {
  it('blocks non-HTTPS and private/loopback/metadata SSRF targets', () => {
    expect(validateOutboundMcpUrl('http://example.com/mcp').ok).toBe(false);
    expect(validateOutboundMcpUrl('https://localhost:3000/mcp').ok).toBe(false);
    expect(validateOutboundMcpUrl('https://127.0.0.1/mcp').ok).toBe(false);
    expect(validateOutboundMcpUrl('https://169.254.169.254/latest/meta-data').ok).toBe(false);
    expect(validateOutboundMcpUrl('https://10.0.0.5/mcp').ok).toBe(false);
    expect(validateOutboundMcpUrl('https://192.168.1.1/mcp').ok).toBe(false);
    expect(validateOutboundMcpUrl('https://calendar.example.com/mcp').ok).toBe(true);
  });

  it('enforces strict read-only tool allowlist', () => {
    expect(isReadOnlyMcpTool('list_calendar_events')).toBe(true);
    expect(isReadOnlyMcpTool('search_gmail_bills')).toBe(true);
    expect(isReadOnlyMcpTool('get_strava_activities')).toBe(true);
    expect(isReadOnlyMcpTool('delete_event')).toBe(false);
    expect(isReadOnlyMcpTool('create_transaction')).toBe(false);
    expect(isReadOnlyMcpTool('send_email')).toBe(false);
  });

  it('encrypts, decrypts, and masks bearer tokens safely', () => {
    const encrypted = encryptMcpToken('secret_mcp_token_9876');
    expect(encrypted).not.toContain('secret_mcp_token_9876');
    expect(decryptMcpToken(encrypted)).toBe('secret_mcp_token_9876');
    expect(maskMcpToken('secret_mcp_token_9876')).toBe('••••9876');
  });

  it('degrades cleanly when an external MCP server fails or times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Timeout')));
    const res = await fetchExternalMcpContext([
      {
        id: 'src_1',
        label: 'Calendar',
        providerKind: 'google_calendar',
        endpointUrl: 'https://calendar.example.com/mcp',
        enabled: true,
      },
    ]);
    expect(res.sourcesChecked).toBe(1);
    expect(res.snippets).toEqual([]);
    vi.unstubAllGlobals();
  });
});
