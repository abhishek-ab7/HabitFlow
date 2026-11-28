import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetUser, mockResolveKeys } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockResolveKeys: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/ai/gemini-server', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-4-hydrogen',
  resolveGeminiApiKeys: mockResolveKeys,
  runWithGeminiFailover: vi.fn(),
}));

import { POST } from '../route';

function makeReq(body: unknown, ip = '10.9.0.1') {
  return new NextRequest(new URL('http://localhost:3000/api/ai/weekly-review'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/weekly-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-weekly' } } });
    mockResolveKeys.mockReturnValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(makeReq({}, '10.9.0.2'));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid digest payload', async () => {
    const res = await POST(makeReq({ todayIso: '' }, '10.9.0.3'));
    expect(res.status).toBe(400);
  });

  it('returns 200 with deterministic weekly review when keys are absent', async () => {
    const res = await POST(
      makeReq(
        {
          todayIso: '2026-11-29',
          weeklyCompletionRate: 70,
          safeToSpendMonthly: 15000,
          safeToSpendDaily: 500,
          junkSpend14dInr: 800,
          emptyKcal14d: 1800,
          workouts7dCount: 3,
          avgSteps7d: 7500,
          catalog: {
            habits: [{ id: 'h1', name: 'Meditation' }],
            categories: [{ id: 'c1', name: 'Junk Food', slug: 'junk-food' }],
            tasks: [{ id: 't1', title: 'Review budget', priority: 'high' }],
          },
        },
        '10.9.0.4'
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('deterministic');
    expect(json.rootCause.headline).toBeTruthy();
    expect(json.proposals).toHaveLength(3);
  });
});
