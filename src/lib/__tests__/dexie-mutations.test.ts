import { describe, it, expect, beforeEach } from 'vitest';
import { db, createHabit, updateHabit } from '../db';

describe('Local Database Mutations (Dexie Hooks)', () => {
  beforeEach(async () => {
    // Clean database table before each test
    await db.habits.clear();
  });

  /**
   * Test Suite 2 - Test A: Creating a new habit
   * Verify that calling the local createHabit repository function creates a record in Dexie
   * with isDirty: true and generationCounter: 1.
   */
  it('should create a habit record in Dexie with isDirty: true and generationCounter: 1', async () => {
    // Arrange
    const habitData = {
      name: 'Exercise Daily',
      category: 'health' as const,
      targetDaysPerWeek: 5,
      difficulty: 'medium' as const,
      userId: 'test-user',
    };

    // Act
    const created = await createHabit(habitData);

    // Assert
    // Verify object returned by repository function has correct fields
    expect(created.isDirty).toBe(true);
    expect(created.generationCounter).toBe(1);

    // Verify object actually saved in Dexie database
    const saved = await db.habits.get(created.id);
    expect(saved).toBeDefined();
    expect(saved?.name).toBe('Exercise Daily');
    expect(saved?.isDirty).toBe(true);
    expect(saved?.generationCounter).toBe(1);
  });

  /**
   * Test Suite 2 - Test B: Updating an existing habit
   * Verify that updating an existing habit increments its generationCounter by 1 and sets isDirty: true.
   */
  it('should update an existing habit, incrementing its generationCounter by 1 and setting isDirty: true', async () => {
    // Arrange
    const habitData = {
      name: 'Read Books',
      category: 'learning' as const,
      targetDaysPerWeek: 7,
      difficulty: 'easy' as const,
      userId: 'test-user',
    };

    // Create initial habit (generationCounter: 1, isDirty: true)
    const created = await createHabit(habitData);
    expect(created.generationCounter).toBe(1);
    expect(created.isDirty).toBe(true);

    // Simulate database sync completion (setting isDirty: false) by writing it directly
    // Setting mods.isDirty = false triggers the hook guard to not auto-update generationCounter/dirty
    await db.habits.update(created.id, { isDirty: false });
    
    const beforeUpdate = await db.habits.get(created.id);
    expect(beforeUpdate?.isDirty).toBe(false);
    expect(beforeUpdate?.generationCounter).toBe(1);

    // Act
    // Update the habit's name to trigger the 'updating' hook
    await updateHabit(created.id, { name: 'Read 30 mins' });

    // Assert
    const updated = await db.habits.get(created.id);
    expect(updated).toBeDefined();
    expect(updated?.name).toBe('Read 30 mins');
    expect(updated?.isDirty).toBe(true);
    expect(updated?.generationCounter).toBe(2);
  });
});
