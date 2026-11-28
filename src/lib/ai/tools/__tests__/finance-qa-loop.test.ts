import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFailover } = vi.hoisted(() => ({
  mockFailover: vi.fn(),
}));

vi.mock('@/lib/ai/gemini-server', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-4-hydrogen',
  runWithGeminiFailover: mockFailover,
}));

import { runFinanceQaLoop } from '../finance-qa-loop';

describe('runFinanceQaLoop (bounded 4-step ReAct + CodeAct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes evaluate_finance_math tool call and synthesizes verified answer', async () => {
    mockFailover
      .mockResolvedValueOnce({
        functionCalls: [
          {
            name: 'evaluate_finance_math',
            args: { expression: 'surplus - phone', variables: { surplus: 31800, phone: 45000 } },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: 'Buying cash leaves a ₹13,200 shortfall.',
      });

    const res = await runFinanceQaLoop({
      question: 'Can I buy a 45000 phone next month?',
      context: { surplus: 31800 },
      history: [],
    });

    expect(res).not.toBeNull();
    expect(res?.steps).toBe(2);
    expect(res?.toolCallsUsed).toEqual(['evaluate_finance_math']);
    expect(res?.answer).toContain('13,200');
  });

  it('enforces the 4-step tool loop ceiling and runs final synthesis', async () => {
    mockFailover
      .mockResolvedValueOnce({ functionCalls: [{ name: 'query_snapshot_section', args: { section: 'accounts' } }] })
      .mockResolvedValueOnce({ functionCalls: [{ name: 'query_snapshot_section', args: { section: 'summary' } }] })
      .mockResolvedValueOnce({ functionCalls: [{ name: 'query_snapshot_section', args: { section: 'sips' } }] })
      .mockResolvedValueOnce({ functionCalls: [{ name: 'query_snapshot_section', args: { section: 'emis' } }] })
      .mockResolvedValueOnce({ text: 'Synthesized after max steps.' });

    const res = await runFinanceQaLoop({
      question: 'Full audit',
      context: { accounts: [], summary: {} },
      history: [],
    });

    expect(res?.steps).toBe(4);
    expect(res?.toolCallsUsed).toHaveLength(4);
    expect(res?.answer).toBe('Synthesized after max steps.');
  });
});
