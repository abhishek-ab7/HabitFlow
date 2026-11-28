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

import {
  buildWeeklyDigest,
  runWeeklyReviewGraph,
  sanitizeWeeklyProposals,
  type WeeklyReviewDigestInput,
} from '../weekly-review';

const SAMPLE_INPUT: WeeklyReviewDigestInput = {
  todayIso: '2026-11-29',
  weeklyCompletionRate: 58,
  bestHabitName: 'Morning Walk',
  bestHabitRate: 86,
  safeToSpendMonthly: 18500,
  safeToSpendDaily: 617,
  junkSpend14dInr: 1450,
  emptyKcal14d: 3100,
  topTriggerLabel: 'Late-night stress',
  triggerMultiplier: 1.8,
  workouts7dCount: 2,
  avgSteps7d: 6400,
  catalog: {
    habits: [{ id: 'hab_1', name: 'Read 30m', targetDaysPerWeek: 7 }],
    categories: [{ id: 'cat_junk', name: 'Junk Food', slug: 'junk-food', monthlyBudgetLimit: 2000 }],
    tasks: [
      { id: 'task_1', title: 'Pay credit card bill', priority: 'high' },
      { id: 'task_2', title: 'Prep weekly groceries', priority: 'medium' },
    ],
  },
};

describe('Weekly Life-OS Review Graph (Slice 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveKeys.mockReturnValue([]);
  });

  it('builds a compact digest and valid ID sets in Node 1', () => {
    const { digest, validIds } = buildWeeklyDigest(SAMPLE_INPUT);
    expect(digest.habitsPct).toBe(58);
    expect(digest.junk14dInr).toBe(1450);
    expect(validIds.habitIds.has('hab_1')).toBe(true);
    expect(validIds.categoryIds.has('cat_junk')).toBe(true);
    expect(validIds.taskIds.has('task_1')).toBe(true);
  });

  it('deterministically rejects hallucinated FK IDs in LLM proposals', () => {
    const { validIds } = buildWeeklyDigest(SAMPLE_INPUT);
    const cleaned = sanitizeWeeklyProposals(
      [
        {
          id: 'p1',
          domain: 'habit',
          habitId: 'fake_habit_999',
          title: 'Bad habit',
          rationale: 'Invalid ID',
          actionType: 'set_two_minute_floor',
          payload: { twoMinuteVersion: '2 pages' },
        },
        {
          id: 'p2',
          domain: 'finance',
          title: 'Cap junk food',
          rationale: 'High 14d spend',
          actionType: 'adjust_category_budget',
          payload: { categoryId: 'cat_junk', suggestedLimitINR: 1500 },
        },
        {
          id: 'p3',
          domain: 'task',
          title: 'Lock MITs',
          rationale: 'Focus',
          actionType: 'preselect_mits',
          payload: { taskIds: ['task_1', 'hallucinated_task'] },
        },
      ],
      validIds
    );

    expect(cleaned).toHaveLength(2);
    expect(cleaned.some((p) => p.domain === 'habit')).toBe(false);
    const taskProp = cleaned.find((p) => p.domain === 'task');
    expect(taskProp && taskProp.domain === 'task' ? taskProp.payload.taskIds : []).toEqual(['task_1']);
  });

  it('falls back deterministically when Gemini keys are missing or Gemini throws', async () => {
    mockResolveKeys.mockReturnValue([]);
    const res1 = await runWeeklyReviewGraph(SAMPLE_INPUT);
    expect(res1.source).toBe('deterministic');
    expect(res1.proposals.length).toBe(3);

    mockResolveKeys.mockReturnValue(['test-key']);
    mockFailover.mockRejectedValueOnce(new Error('Gemini timeout'));
    const res2 = await runWeeklyReviewGraph(SAMPLE_INPUT);
    expect(res2.source).toBe('deterministic');
    expect(res2.rootCause.headline).toContain('Junk Spend');
  });

  it('returns verified Gemini diagnosis & sanitized proposals on success', async () => {
    mockResolveKeys.mockReturnValue(['test-key']);
    mockFailover.mockResolvedValueOnce({
      rootCause: {
        headline: 'Late-night stress drove ₹1,450 junk spend',
        explanation: 'Junk spend hit ₹1,450 (3,100 kcal) while habit consistency dipped to 58%.',
        primaryDomain: 'cross_domain',
      },
      proposals: [
        {
          id: 'ai_h1',
          domain: 'habit',
          habitId: 'hab_1',
          title: 'Set Read 30m to 2 pages on weekdays',
          rationale: 'Keeps streak alive.',
          actionType: 'set_two_minute_floor',
          payload: { twoMinuteVersion: 'Read 2 pages' },
        },
      ],
    });

    const res = await runWeeklyReviewGraph(SAMPLE_INPUT);
    expect(res.source).toBe('gemini');
    expect(res.rootCause.primaryDomain).toBe('cross_domain');
    expect(res.proposals).toHaveLength(1);
    expect(res.proposals[0].domain).toBe('habit');
  });
});
