import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetUser, mockResolveKeys, mockFailover, mockCachedGet, mockCachedSet } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockResolveKeys: vi.fn(),
  mockFailover: vi.fn(),
  mockCachedGet: vi.fn(),
  mockCachedSet: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@/lib/ai/gemini-server', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-4-hydrogen',
  resolveGeminiApiKeys: mockResolveKeys,
  runWithGeminiFailover: mockFailover,
}));

vi.mock('@/lib/ai/cache', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/cache')>('@/lib/ai/cache');
  return {
    ...actual,
    getCachedResponse: mockCachedGet,
    setCachedResponse: mockCachedSet,
  };
});

import { POST as coachPost } from '../coach/route';
import { POST as financeQaPost } from '../finance-qa/route';

function makeCoachReq(body: unknown, ip = '10.1.0.1') {
  return new NextRequest(new URL('http://localhost:3000/api/ai/coach'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function makeQaReq(body: unknown, ip = '10.2.0.1') {
  return new NextRequest(new URL('http://localhost:3000/api/ai/finance-qa'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/coach & POST /api/ai/finance-qa Security & Cross-Domain Integration', () => {
  const cacheStore = new Map<string, unknown>();

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES = 'true';

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-alpha' } } });
    mockResolveKeys.mockReturnValue(['test-key']);
    mockCachedGet.mockImplementation(async (key: string) => cacheStore.get(key) ?? null);
    mockCachedSet.mockImplementation(async (key: string, val: unknown) => {
      cacheStore.set(key, val);
    });
  });

  it('/api/ai/coach returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await coachPost(makeCoachReq({ userData: {}, context: {} }, '10.1.0.2'));
    expect(res.status).toBe(401);
  });

  it('/api/ai/coach isolates cache keys by verified Supabase user.id regardless of spoofed userData.userId', async () => {
    mockFailover
      .mockResolvedValueOnce({
        text: JSON.stringify({
          greeting: 'Morning Alpha',
          focus: 'Hit 130g protein & 3 MITs',
          quote: 'Keep going Alpha',
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          greeting: 'Morning Beta',
          focus: 'Cut junk food spend',
          quote: 'Keep going Beta',
        }),
      });

    // User Alpha logs in (even if payload spoofs same userId or omits userId)
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-alpha' } } });
    const resAlpha = await coachPost(
      makeCoachReq(
        {
          userData: { userName: 'Alpha', userId: 'shared-spoof' },
          context: {
            todaysHabits: ['Morning Run'],
            fitnessTelemetry: { avgSleepHours14d: 6.1, junkSpend14dInr: 900, junkEmptyKcal14d: 1800 },
          },
        },
        '10.1.0.3'
      )
    );
    expect(resAlpha.status).toBe(200);
    const jsonAlpha = await resAlpha.json();
    expect(jsonAlpha.greeting).toBe('Morning Alpha');
    expect(Array.isArray(jsonAlpha.consultedSpecialists)).toBe(true);
    expect(jsonAlpha.consultedSpecialists.length).toBeGreaterThan(0);
    expect(jsonAlpha.guardrail?.readOnlyEnforced).toBe(true);
    expect(Array.isArray(jsonAlpha.actionProposals)).toBe(true);

    // User Beta logs in -> MUST NOT get Alpha's cached briefing even with spoofed userId!
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-beta' } } });
    const resBeta = await coachPost(
      makeCoachReq(
        {
          userData: { userName: 'Beta', userId: 'shared-spoof' },
          context: { todaysHabits: ['Meditation'] },
        },
        '10.1.0.4'
      )
    );
    expect(resBeta.status).toBe(200);
    const jsonBeta = await resBeta.json();
    expect(jsonBeta.greeting).toBe('Morning Beta');
    expect(Array.isArray(jsonBeta.consultedSpecialists)).toBe(true);
    expect(jsonBeta.guardrail?.readOnlyEnforced).toBe(true);
    expect(Array.isArray(jsonBeta.actionProposals)).toBe(true);

    // Verify Gemini prompt contained telemetry & keys use verified user IDs (never 'anonymous' or spoofed)
    const firstCallPrompt = mockFailover.mock.calls[0][0];
    expect(typeof firstCallPrompt).toBe('function');
    const savedKeys = mockCachedSet.mock.calls.map((c) => c[0]);
    expect(savedKeys.some((k: string) => k.startsWith('coach:user-alpha:'))).toBe(true);
    expect(savedKeys.some((k: string) => k.startsWith('coach:user-beta:'))).toBe(true);
    expect(savedKeys.every((k: string) => !k.includes('anonymous') && !k.includes('shared-spoof'))).toBe(true);
  });

  it('/api/ai/coach enforces 429 rate limit after 20 requests/min per IP', async () => {
    const ip = '172.16.0.44';
    mockResolveKeys.mockReturnValue([]);
    for (let i = 0; i < 20; i++) {
      const ok = await coachPost(makeCoachReq({ userData: {}, context: {}, forceRefresh: true }, ip));
      expect(ok.status).toBe(200);
    }
    const blocked = await coachPost(makeCoachReq({ userData: {}, context: {} }, ip));
    expect(blocked.status).toBe(429);
  });

  it('/api/ai/finance-qa returns 401 when unauthenticated, falls back deterministically, and enforces 429', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const unauth = await financeQaPost(makeQaReq({ question: 'whey ROI' }, '10.2.0.2'));
    expect(unauth.status).toBe(401);

    mockResolveKeys.mockReturnValue([]);
    const ok = await financeQaPost(
      makeQaReq(
        {
          question: 'What is my junk food kcal impact?',
          context: {
            lifeOs: {
              crossDomain: {
                walletWaistline: {
                  spend14dInr: 700,
                  spend30dInr: 1400,
                  emptyKcal14d: 1540,
                  emptyKcal30d: 3080,
                  fatLossDragKg30d: 0.4,
                  savings70PctMonthlyInr: 980,
                },
              },
            },
          },
        },
        '10.2.0.3'
      )
    );
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.source).toBe('local');
    expect(json.answer).toContain('3,080 empty kcal');

    const ip = '172.16.0.55';
    for (let i = 0; i < 25; i++) {
      const r = await financeQaPost(makeQaReq({ question: 'safe spend', context: {} }, ip));
      expect(r.status).toBe(200);
    }
    const throttled = await financeQaPost(makeQaReq({ question: 'safe spend', context: {} }, ip));
    expect(throttled.status).toBe(429);
  });
});
