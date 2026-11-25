import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetUser, mockResolveKeys, mockFailover } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockResolveKeys: vi.fn(),
  mockFailover: vi.fn(),
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

import { POST } from '../route';

function makeRequest(body: unknown, ip = '10.0.0.1') {
  return new NextRequest(new URL('http://localhost:3000/api/ai/universal-capture'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/universal-capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockResolveKeys.mockReturnValue([]);
  });

  it('returns 401 Unauthorized when user session is missing', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await POST(makeRequest({ text: 'momo 60 slice' }, '10.0.1.1'));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when capture text is empty', async () => {
    const res = await POST(makeRequest({ text: '   ' }, '10.0.1.2'));
    expect(res.status).toBe(400);
  });

  it('falls back to deterministic Hinglish parser when Gemini keys are missing or Gemini fails', async () => {
    // 1. No keys -> deterministic
    mockResolveKeys.mockReturnValue([]);
    const res1 = await POST(
      makeRequest(
        {
          text: 'momo 60 slice',
          accounts: [{ id: 'acc_slice', name: 'Slice CC', type: 'credit_card' }],
          categories: [{ id: 'cat_junk', name: 'Junk Food', slug: 'junk-food', type: 'expense' }],
        },
        '10.0.1.3'
      )
    );
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.source).toBe('deterministic');
    expect(json1.actions.some((a: { kind: string }) => a.kind === 'expense')).toBe(true);
    expect(json1.actions.some((a: { kind: string }) => a.kind === 'meal')).toBe(true);

    // 2. Gemini throws -> graceful fallback to deterministic
    mockResolveKeys.mockReturnValue(['fake-key']);
    mockFailover.mockRejectedValueOnce(new Error('Gemini rate limit'));
    const res2 = await POST(makeRequest({ text: 'push workout 45m' }, '10.0.1.4'));
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.source).toBe('deterministic');
    expect(json2.actions[0]).toMatchObject({ kind: 'workout', workoutType: 'push', durationMinutes: 45 });
  });

  it('enforces 429 rate limit after 25 requests per minute per IP', async () => {
    const testIp = '192.168.99.77';
    for (let i = 0; i < 25; i++) {
      const okRes = await POST(makeRequest({ text: 'chai 20' }, testIp));
      expect(okRes.status).toBe(200);
    }

    const limitedRes = await POST(makeRequest({ text: 'chai 20' }, testIp));
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.headers.get('Retry-After')).toBeTruthy();
    const body = await limitedRes.json();
    expect(body.error).toMatch(/Too many requests/i);
  });

  it('returns Gemini structured actions when AI succeeds and preserves deterministic supplement cues', async () => {
    mockResolveKeys.mockReturnValue(['fake-key']);
    mockFailover.mockResolvedValueOnce({
      expenses: [
        {
          title: 'Dominos Pizza',
          amount: 299,
          txType: 'expense',
          accountNameHint: 'Slice',
          categorySlug: 'junk-food',
          isJunkFood: true,
        },
      ],
      meals: [
        {
          name: 'Dominos Pizza (2 slices)',
          calories: 560,
          proteinG: 22,
          carbsG: 62,
          fatG: 24,
          mealType: 'dinner',
          isJunk: true,
        },
      ],
      workouts: [],
      bio: null,
      tasks: [],
    });

    const res = await POST(
      makeRequest(
        {
          text: 'dominos pizza 299 slice + took creatine',
          accounts: [{ id: 'acc_slice', name: 'Slice CC', type: 'credit_card' }],
          categories: [{ id: 'cat_junk', name: 'Junk Food', slug: 'junk-food', type: 'expense' }],
        },
        '10.0.1.5'
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('gemini');
    expect(json.actions.some((a: { kind: string; amount?: number }) => a.kind === 'expense' && a.amount === 299)).toBe(true);
    expect(json.actions.some((a: { kind: string; calories?: number }) => a.kind === 'meal' && a.calories === 560)).toBe(true);
    expect(json.actions.some((a: { kind: string }) => a.kind === 'supplement')).toBe(true);
  });
});
