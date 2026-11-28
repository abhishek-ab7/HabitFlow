import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveKeys, mockFailover } = vi.hoisted(() => ({
  mockResolveKeys: vi.fn(),
  mockFailover: vi.fn(),
}));

vi.mock('@/lib/ai/gemini-server', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-4-hydrogen',
  resolveGeminiApiKeys: mockResolveKeys,
  runWithGeminiFailover: mockFailover,
}));

import { routeCaptureDomains } from '../capture-extractors';
import { validateCaptureActions } from '../capture-validator';
import { runUniversalCaptureGraph } from '../universal-capture';
import type { UniversalParserContext } from '@/lib/quick-capture/parser-types';

const BASE_CONTEXT: UniversalParserContext = {
  todayIso: '2026-11-28',
  accounts: [
    { id: 'acc_slice', name: 'Slice CC', type: 'credit_card' },
    { id: 'acc_upi', name: 'HDFC UPI', type: 'upi' },
  ],
  categories: [
    { id: 'cat_junk', name: 'Junk Food', slug: 'junk-food', type: 'expense' },
    { id: 'cat_supps', name: 'Health & Supplements', slug: 'health-supplements', type: 'expense' },
  ],
};

describe('Universal Capture 5-Node State Graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveKeys.mockReturnValue([]);
  });

  describe('Node 1: Deterministic Intent Router', () => {
    it('routes single-domain expense/food input to finance_food only', () => {
      const domains = routeCaptureDomains('momo 60 slice', []);
      expect(domains).toEqual(['finance_food']);
    });

    it('routes multi-domain input to all matching domains', () => {
      const domains = routeCaptureDomains(
        'paid 850 whey protein + push workout 45m + remind me to pay rent Friday',
        []
      );
      expect(domains).toEqual(expect.arrayContaining(['finance_food', 'fitness_bio', 'tasks']));
      expect(domains).toHaveLength(3);
    });

    it('falls back to all domains when input has no obvious cues', () => {
      const domains = routeCaptureDomains('feeling great today', []);
      expect(domains).toEqual(['finance_food', 'fitness_bio', 'tasks']);
    });
  });

  describe('Node 2 + Node 3: Parallel Extraction, XML Isolation & Validation', () => {
    it('runs parallel domain extractors for multi-domain input and returns READY_TO_COMMIT when unambiguous', async () => {
      mockResolveKeys.mockReturnValue(['test-key']);
      const capturedPrompts: string[] = [];

      mockFailover.mockImplementation(async (op: (ai: unknown) => Promise<unknown>) => {
        return op({
          models: {
            generateContent: async ({ contents }: { contents: string }) => {
              capturedPrompts.push(contents);
              if (contents.includes('Extract ONLY finance')) {
                return {
                  text: JSON.stringify({
                    expenses: [
                      {
                        title: 'Whey Protein',
                        amount: 850,
                        txType: 'expense',
                        accountNameHint: 'HDFC UPI',
                        categorySlug: 'health-supplements',
                        isJunkFood: false,
                      },
                    ],
                    meals: [],
                  }),
                };
              }
              if (contents.includes('Extract ONLY workouts')) {
                return {
                  text: JSON.stringify({
                    workouts: [{ title: 'Push Day', workoutType: 'push', durationMinutes: 45 }],
                    bio: null,
                  }),
                };
              }
              return {
                text: JSON.stringify({
                  tasks: [{ title: 'Pay rent', priority: 'high', category: 'finance', dueDate: '2026-12-04' }],
                }),
              };
            },
          },
        });
      });

      const result = await runUniversalCaptureGraph({
        rawText: 'paid 850 whey protein hdfc upi + push workout 45m + remind me to pay rent Friday',
        todayIso: '2026-11-28',
        context: BASE_CONTEXT,
        recentTransactions: [],
      });

      expect(result.source).toBe('gemini');
      expect(result.status).toBe('READY_TO_COMMIT');
      expect(result.ambiguities).toHaveLength(0);
      expect(result.duplicateWarnings).toHaveLength(0);
      expect(result.actions.map((a) => a.kind)).toEqual(expect.arrayContaining(['expense', 'workout', 'task']));
      // Prompt injection isolation check
      expect(capturedPrompts.length).toBe(3);
      for (const prompt of capturedPrompts) {
        expect(prompt).toContain('<untrusted_input>');
        expect(prompt).toContain('</untrusted_input>');
      }
    });

    it('pauses with AWAITING_HUMAN when 2+ accounts exist and no account was specified', async () => {
      mockResolveKeys.mockReturnValue(['test-key']);
      mockFailover.mockResolvedValueOnce({
        expenses: [
          {
            title: 'Whey Protein',
            amount: 850,
            txType: 'expense',
            categorySlug: 'health-supplements',
          },
        ],
        meals: [],
      });

      const result = await runUniversalCaptureGraph({
        rawText: 'paid 850 for whey protein',
        todayIso: '2026-11-28',
        context: BASE_CONTEXT,
      });

      expect(result.status).toBe('AWAITING_HUMAN');
      expect(result.overallConfidence).toBeLessThan(0.85);
      expect(result.ambiguities).toHaveLength(1);
      expect(result.ambiguities[0].field).toBe('accountId');
      expect(result.ambiguities[0].options).toEqual([
        { label: 'Slice CC', value: 'acc_slice' },
        { label: 'HDFC UPI', value: 'acc_upi' },
      ]);
    });

    it('flags 24h duplicate transaction warning in Node 3 validator', () => {
      const outcome = validateCaptureActions({
        actions: [
          {
            id: 'ai_exp_0',
            kind: 'expense',
            enabled: true,
            title: 'Dominos Pizza',
            amount: 299,
            txType: 'expense',
            accountId: 'acc_slice',
            accountName: 'Slice CC',
            categoryId: 'cat_junk',
            categorySlug: 'junk-food',
            categoryName: 'Junk Food',
            date: '2026-11-28',
            isJunkFood: true,
          },
        ],
        context: BASE_CONTEXT,
        recentTransactions: [
          { id: 'tx_existing_1', title: 'Dominos', amount: 299, date: '2026-11-28' },
        ],
      });

      expect(outcome.status).toBe('AWAITING_HUMAN');
      expect(outcome.ambiguities).toHaveLength(0);
      expect(outcome.duplicateWarnings).toHaveLength(1);
      expect(outcome.duplicateWarnings[0].existingTxId).toBe('tx_existing_1');
    });
  });
});
