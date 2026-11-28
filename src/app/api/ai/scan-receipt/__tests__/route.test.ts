import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockResolveKeys, mockFailover } = vi.hoisted(() => ({
  mockResolveKeys: vi.fn(),
  mockFailover: vi.fn(),
}));

vi.mock('@/lib/ai/gemini-server', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-4-hydrogen',
  resolveGeminiApiKeys: mockResolveKeys,
  runWithGeminiFailover: mockFailover,
}));

import { POST } from '../route';

describe('POST /api/ai/scan-receipt (24h duplicate detection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveKeys.mockReturnValue(['test-key']);
  });

  it('attaches duplicateWarning when scanned receipt matches a recentTransaction within 24h', async () => {
    mockFailover.mockResolvedValueOnce({
      text: JSON.stringify({
        items: [
          {
            title: 'Swiggy Order',
            merchantName: 'Swiggy',
            amount: 450,
            type: 'expense',
            date: '2026-11-28',
            categorySlug: 'food-dining',
            paymentMethodType: 'upi',
            confidence: 95,
          },
        ],
      }),
    });

    const req = new NextRequest(new URL('http://localhost:3000/api/ai/scan-receipt'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [{ data: 'ZmFrZQ==', mimeType: 'image/jpeg', fileName: 'bill.jpg' }],
        recentTransactions: [{ id: 'tx_dup_1', title: 'Swiggy', amount: 450, date: '2026-11-28' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].duplicateWarning).toMatchObject({
      existingTxId: 'tx_dup_1',
      amount: 450,
    });
  });
});
