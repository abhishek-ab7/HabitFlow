import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from '../sync-engine';
import type { HabitCompletion } from '@/lib/types';

const upsertCalls: Array<{ table: string; payload: any; options?: any }> = [];
const mockSchemaMismatch = vi.hoisted(() => ({ dropRestReasonOnce: false }));

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn((table: string) => ({
      upsert: vi.fn(async (payload: any, options?: any) => {
        upsertCalls.push({ table, payload, options });
        if (
          mockSchemaMismatch.dropRestReasonOnce &&
          table === 'completions' &&
          !Array.isArray(payload) &&
          Object.prototype.hasOwnProperty.call(payload, 'rest_reason')
        ) {
          return {
            error: {
              code: 'PGRST204',
              message: "Could not find the 'rest_reason' column of 'completions' in the schema cache",
            },
          };
        }
        return { error: null };
      }),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabase,
}));

describe('SyncEngine completion push & pending op column fallback', () => {
  beforeEach(() => {
    upsertCalls.length = 0;
    mockSchemaMismatch.dropRestReasonOnce = false;
    vi.clearAllMocks();
  });

  it('pushes completed: false and status: null on uncomplete / clearRestCompletion (never completed)', async () => {
    const engine = new SyncEngine();
    engine.userId = 'user-sync-1';
    engine.isOnline = true;

    const uncompleted: HabitCompletion = {
      id: 'comp_1',
      userId: 'user-sync-1',
      habitId: 'hab_1',
      date: '2026-11-24',
      completed: false,
      status: undefined,
      skipped: false,
      restReason: undefined,
      generationCounter: 2,
      updatedAt: '2026-11-24T12:00:00.000Z',
    };

    await engine.pushCompletion(uncompleted);

    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].table).toBe('completions');
    expect(upsertCalls[0].payload).toEqual(
      expect.objectContaining({
        id: 'comp_1',
        habit_id: 'hab_1',
        date: '2026-11-24',
        completed: false,
        status: null,
        skipped: false,
        rest_reason: null,
      })
    );
    expect(upsertCalls[0].options).toEqual({ onConflict: 'habit_id,date' });
  });

  it('degrades gracefully via column fallback when pushing completion with missing remote column', async () => {
    mockSchemaMismatch.dropRestReasonOnce = true;
    const engine = new SyncEngine();
    engine.userId = 'user-sync-1';
    engine.isOnline = true;

    await engine.pushCompletion({
      id: 'comp_2',
      userId: 'user-sync-1',
      habitId: 'hab_2',
      date: '2026-11-24',
      completed: false,
      status: 'rest',
      skipped: true,
      restReason: 'Low-Energy Day',
      generationCounter: 3,
    });

    expect(upsertCalls.length).toBeGreaterThanOrEqual(2);
    const finalCall = upsertCalls[upsertCalls.length - 1];
    expect(finalCall.payload).not.toHaveProperty('rest_reason');
    expect(finalCall.payload.status).toBe('rest');
    expect(finalCall.payload.skipped).toBe(true);
  });

  it('processPendingOperations pushes queued updates via column fallback cleanly', async () => {
    const engine = new SyncEngine();
    engine.userId = 'user-sync-1';
    engine.isOnline = false;

    engine.queueOperation({
      type: 'update',
      table: 'completions',
      data: {
        id: 'comp_q1',
        habit_id: 'hab_q1',
        date: '2026-11-24',
        completed: false,
        status: null,
        rest_reason: 'Recovery',
      },
    });

    expect(engine.pendingOperations.size).toBe(1);
    mockSchemaMismatch.dropRestReasonOnce = true;
    engine.isOnline = true;

    await engine.processPendingOperations();

    expect(engine.pendingOperations.size).toBe(0);
    const last = upsertCalls[upsertCalls.length - 1];
    expect(last.table).toBe('completions');
    expect(last.options).toEqual({ onConflict: 'habit_id,date' });
  });
});
