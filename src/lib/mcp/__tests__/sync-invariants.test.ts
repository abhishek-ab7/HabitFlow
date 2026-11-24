import { describe, it, expect } from 'vitest';
import { getInsertMetadata, getUpdateMetadata, getSoftDeleteMetadata } from '../sync-helpers';
import { getIstIsoDate, getIstMonthKey } from '../config';

describe('MCP Sync Invariants & Vector Clock Trigger Compliance', () => {
  it('getInsertMetadata initializes generation_counter to 1 and sets ISO timestamps', () => {
    const meta = getInsertMetadata();
    expect(meta.id).toBeDefined();
    expect(meta.generation_counter).toBe(1);
    expect(meta.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(meta.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('getUpdateMetadata bumps generation_counter by +1 to prevent silent drop trigger', () => {
    // If NEW.generation_counter <= OLD.generation_counter, the PostgreSQL vector clock trigger silently drops updates.
    const existingRow = { generation_counter: 5 };
    const meta = getUpdateMetadata(existingRow);
    expect(meta.generation_counter).toBe(6);
    expect(meta.updated_at).toBeDefined();

    // Handles null or missing initial counters safely
    const initialMeta = getUpdateMetadata(null);
    expect(initialMeta.generation_counter).toBe(1);
  });

  it('getSoftDeleteMetadata increments counter and sets deleted_at', () => {
    const existing = { generation_counter: 12 };
    const meta = getSoftDeleteMetadata(existing);
    expect(meta.generation_counter).toBe(13);
    expect(meta.deleted_at).toBeDefined();
    expect(meta.updated_at).toBeDefined();
  });

  it('getIstIsoDate returns valid YYYY-MM-DD in Asia/Kolkata timezone', () => {
    const dateStr = getIstIsoDate();
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const monthStr = getIstMonthKey();
    expect(monthStr).toMatch(/^\d{4}-\d{2}$/);
    expect(dateStr.startsWith(monthStr)).toBe(true);

    // Verify UTC midnight boundary: e.g. 2026-11-24T00:15:00Z should be 2026-11-24 in IST (+05:30)
    const testDate = new Date('2026-11-24T00:15:00Z');
    expect(getIstIsoDate(testDate)).toBe('2026-11-24');
    expect(getIstMonthKey(testDate)).toBe('2026-11');
  });
});
