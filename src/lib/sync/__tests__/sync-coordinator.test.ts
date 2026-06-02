import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncCoordinator } from '../sync-coordinator';
import { resolveConflict } from '../conflict-resolution';
import type { ISynchronizer } from '../types';

describe('Conflict Resolution Logic', () => {
  it('should prefer completed items if preferCompleted option is set', () => {
    const local = { id: '1', completed: true, updated_at: '2026-06-01T12:00:00Z' };
    const remote = { id: '1', completed: false, updated_at: '2026-06-01T13:00:00Z' };

    const result = resolveConflict(local, remote, { preferCompleted: true });

    expect(result.winner).toBe('local');
    expect(result.data.completed).toBe(true);
    expect(result.reason).toContain('Local is completed');
  });

  it('should fallback to most recent timestamp when completion state matches', () => {
    const local = { id: '1', completed: true, updated_at: '2026-06-01T12:00:00Z' };
    const remote = { id: '1', completed: true, updated_at: '2026-06-01T13:00:00Z' };

    const result = resolveConflict(local, remote, { preferCompleted: true });

    expect(result.winner).toBe('remote');
    expect(result.data.updated_at).toBe('2026-06-01T13:00:00Z');
    expect(result.reason).toContain('Remote is newer');
  });

  it('should fallback to local as tie-breaker if timestamps are equal', () => {
    const local = { id: '1', updated_at: '2026-06-01T12:00:00Z' };
    const remote = { id: '1', updated_at: '2026-06-01T12:00:00Z' };

    const result = resolveConflict(local, remote);

    expect(result.winner).toBe('equal');
    expect(result.reason).toContain('Timestamps equal');
  });

  it('should prefer completed status for tasks/goals when matching options', () => {
    const local = { id: 't1', status: 'completed', updated_at: '2026-06-01T12:00:00Z' };
    const remote = { id: 't1', status: 'in-progress', updated_at: '2026-06-01T13:00:00Z' };

    const result = resolveConflict(local, remote, { completedStatuses: ['completed', 'done'] });

    expect(result.winner).toBe('local');
    expect(result.reason).toContain('Local has completed status');
  });
});

describe('SyncCoordinator Isolation & Pipeline Execution', () => {
  let mockEngineSuccess: ISynchronizer;
  let mockEngineFailure: ISynchronizer;

  beforeEach(() => {
    mockEngineSuccess = {
      domainName: 'habits',
      sync: vi.fn().mockResolvedValue({ pushed: 5, pulled: 2, status: 'success' })
    };

    mockEngineFailure = {
      domainName: 'tasks',
      sync: vi.fn().mockRejectedValue(new Error('PostgREST connection timed out'))
    };
  });

  it('should skip synchronization and report failure if no user session is provided', async () => {
    const coordinator = new SyncCoordinator([mockEngineSuccess]);
    const report = await coordinator.syncAll(null);

    expect(report.globalStatus).toBe('failed');
    expect(mockEngineSuccess.sync).not.toHaveBeenCalled();
  });

  it('should run successful engines and separate failures inside boundary catch blocks', async () => {
    const coordinator = new SyncCoordinator([mockEngineSuccess, mockEngineFailure]);
    const report = await coordinator.syncAll('user-123');

    // Assert that success engine completes and counts pushed/pulled items
    expect(mockEngineSuccess.sync).toHaveBeenCalledWith('user-123');
    expect(report.details['habits']).toEqual({
      status: 'success',
      pushed: 5,
      pulled: 2
    });

    // Assert that the failure engine is caught safely without throwing globally
    expect(mockEngineFailure.sync).toHaveBeenCalledWith('user-123');
    expect(report.details['tasks']).toEqual({
      status: 'failed',
      error: 'PostgREST connection timed out',
      pushed: 0,
      pulled: 0
    });

    // Collective pipeline status is degraded rather than completely failed
    expect(report.globalStatus).toBe('degraded');
  });

  it('should run both HabitsSyncEngine and TasksSyncEngine successfully and return a healthy globalStatus report', async () => {
    const HabitsSyncEngine: ISynchronizer = {
      domainName: 'habits',
      sync: vi.fn().mockResolvedValue({ pushed: 3, pulled: 4, status: 'success' })
    };
    const TasksSyncEngine: ISynchronizer = {
      domainName: 'tasks',
      sync: vi.fn().mockResolvedValue({ pushed: 10, pulled: 1, status: 'success' })
    };

    const coordinator = new SyncCoordinator([HabitsSyncEngine, TasksSyncEngine]);
    const report = await coordinator.syncAll('user-123');

    expect(HabitsSyncEngine.sync).toHaveBeenCalledWith('user-123');
    expect(TasksSyncEngine.sync).toHaveBeenCalledWith('user-123');
    expect(report.globalStatus).toBe('healthy');
    expect(report.details['habits']).toEqual({
      status: 'success',
      pushed: 3,
      pulled: 4
    });
    expect(report.details['tasks']).toEqual({
      status: 'success',
      pushed: 10,
      pulled: 1
    });
  });

  it('should catch error in HabitsSyncEngine but allow TasksSyncEngine to succeed and return a degraded globalStatus report', async () => {
    const HabitsSyncEngine: ISynchronizer = {
      domainName: 'habits',
      sync: vi.fn().mockRejectedValue(new Error('Network Error'))
    };
    const TasksSyncEngine: ISynchronizer = {
      domainName: 'tasks',
      sync: vi.fn().mockResolvedValue({ pushed: 2, pulled: 0, status: 'success' })
    };

    const coordinator = new SyncCoordinator([HabitsSyncEngine, TasksSyncEngine]);
    const report = await coordinator.syncAll('user-123');

    expect(HabitsSyncEngine.sync).toHaveBeenCalledWith('user-123');
    expect(TasksSyncEngine.sync).toHaveBeenCalledWith('user-123');
    
    expect(report.globalStatus).toBe('degraded');
    expect(report.details['habits']).toEqual({
      status: 'failed',
      error: 'Network Error',
      pushed: 0,
      pulled: 0
    });
    expect(report.details['tasks']).toEqual({
      status: 'success',
      pushed: 2,
      pulled: 0
    });
  });
});

