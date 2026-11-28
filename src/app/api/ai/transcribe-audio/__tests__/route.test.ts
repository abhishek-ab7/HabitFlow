import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetUser, mockResolveKeys, mockFailover } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockResolveKeys: vi.fn(),
  mockFailover: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/ai/gemini-server', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-4-hydrogen',
  resolveGeminiApiKeys: mockResolveKeys,
  runWithGeminiFailover: mockFailover,
}));

import { POST } from '../route';

function makeReq(body: unknown, ip = '10.8.0.1') {
  return new NextRequest(new URL('http://localhost:3000/api/ai/transcribe-audio'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/transcribe-audio (Hold-to-Talk fallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-voice' } } });
    mockResolveKeys.mockReturnValue(['test-key']);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(makeReq({ audioBase64: 'ZmFrZQ==' }, '10.8.0.2'));
    expect(res.status).toBe(401);
  });

  it('returns 413 when audio payload exceeds 4 MB', async () => {
    const hugeBase64 = 'A'.repeat(6_000_000);
    const res = await POST(makeReq({ audioBase64: hugeBase64, mimeType: 'audio/webm' }, '10.8.0.3'));
    expect(res.status).toBe(413);
  });

  it('returns transcript on valid audio payload', async () => {
    mockFailover.mockResolvedValueOnce('Spent 180 on auto, drank 2L water');
    const res = await POST(makeReq({ audioBase64: 'ZmFrZQ==', mimeType: 'audio/webm' }, '10.8.0.4'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.transcript).toBe('Spent 180 on auto, drank 2L water');
  });
});
