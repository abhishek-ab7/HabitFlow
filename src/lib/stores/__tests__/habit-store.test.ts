import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useHabitStore } from '../habit-store'
import { getArchivedHabits, freezeCompletion, unfreezeCompletion } from '../../db'
import { useGamificationStore } from '../gamification-store'

// Mock dependencies
vi.mock('../../db', () => ({
    getHabits: vi.fn(),
    getArchivedHabits: vi.fn(),
    createHabit: vi.fn(),
    updateHabit: vi.fn(),
    deleteHabit: vi.fn(),
    toggleCompletion: vi.fn(),
    freezeCompletion: vi.fn(),
    unfreezeCompletion: vi.fn(),
    getAllCompletionsInRange: vi.fn(),
    reorderHabits: vi.fn(),
}))

vi.mock('../../supabase/client', () => ({
    getSupabaseClient: vi.fn(() => ({
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
        },
    })),
}))

vi.mock('../../sync', () => ({
    getSyncEngine: vi.fn(() => ({
        pushHabit: vi.fn(),
        deleteHabit: vi.fn(),
        pushCompletion: vi.fn(),
        deleteCompletion: vi.fn(),
    })),
}))

const mockAddXp = vi.fn()
const mockUseShield = vi.fn()

vi.mock('../gamification-store', () => ({
    useGamificationStore: {
        getState: vi.fn(() => ({
            addXp: mockAddXp,
            useShield: mockUseShield,
        })),
    },
    XP_PER_HABIT: 10,
}))

describe('HabitStore', () => {
    beforeEach(() => {
        useHabitStore.setState({ habits: [], completions: [], error: null, isLoading: false })
        vi.clearAllMocks()
    })

    it('should have initial state', () => {
        const state = useHabitStore.getState()
        expect(state.habits).toEqual([])
        expect(state.isLoading).toBe(false)
    })

    it('should calculate today progress correctly', () => {
        // Setup state
        useHabitStore.setState({
            habits: [
                { id: '1', name: 'H1', archived: false } as any,
                { id: '2', name: 'H2', archived: false } as any,
            ],
            completions: [
                { id: 'c1', habitId: '1', date: new Date().toISOString().split('T')[0], completed: true } as any,
            ],
        })

        const progress = useHabitStore.getState().getTodayProgress()
        expect(progress).toEqual({
            completed: 1,
            total: 2,
            percentage: 50,
        })
    })

    it('should filter archived habits from progress', () => {
        useHabitStore.setState({
            habits: [
                { id: '1', name: 'H1', archived: false } as any,
                { id: '2', name: 'H2', archived: true } as any,
            ],
            completions: [],
        })

        const progress = useHabitStore.getState().getTodayProgress()
        expect(progress).toEqual({
            completed: 0,
            total: 1,
            percentage: 0,
        })
    })

    it('loadArchivedHabits should call getArchivedHabits and return archived habits', async () => {
        const mockArchived = [{ id: 'archived-1', name: 'Archived Habit', archived: true }];
        vi.mocked(getArchivedHabits).mockResolvedValue(mockArchived as any);

        const result = await useHabitStore.getState().loadArchivedHabits();
        expect(getArchivedHabits).toHaveBeenCalledWith('test-user');
        expect(result).toEqual(mockArchived);
    });

    it('freezeHabit should unfreeze if already frozen', async () => {
        const habitId = 'habit-1';
        const date = '2026-05-26';
        const initialCompletion = { id: 'c1', habitId, date, completed: true, status: 'frozen' };
        useHabitStore.setState({
            completions: [initialCompletion as any],
        });

        const unfrozenCompletion = { id: 'c1', habitId, date, completed: false, status: undefined };
        vi.mocked(unfreezeCompletion).mockResolvedValue(unfrozenCompletion as any);

        await useHabitStore.getState().freezeHabit(habitId, date);

        expect(unfreezeCompletion).toHaveBeenCalledWith(habitId, date, 'test-user');
        const state = useHabitStore.getState();
        const comp = state.completions.find(c => c.habitId === habitId && c.date === date);
        expect(comp?.completed).toBe(false);
        expect(comp?.status).toBeUndefined();
    });

    it('freezeHabit should allow free weekly freeze if no other freezes in the same week', async () => {
        const habitId = 'habit-1';
        const date = '2026-05-26'; // Tuesday
        useHabitStore.setState({
            completions: [],
        });

        const frozenCompletion = { id: 'c1', habitId, date, completed: true, status: 'frozen' };
        vi.mocked(freezeCompletion).mockResolvedValue(frozenCompletion as any);

        await useHabitStore.getState().freezeHabit(habitId, date);

        expect(mockUseShield).not.toHaveBeenCalled();
        expect(freezeCompletion).toHaveBeenCalledWith(habitId, date, 'test-user');
        const state = useHabitStore.getState();
        const comp = state.completions.find(c => c.habitId === habitId && c.date === date);
        expect(comp?.status).toBe('frozen');
    });

    it('freezeHabit should consume shield if another freeze exists in the same week and shield use succeeds', async () => {
        const habitId = 'habit-1';
        const date = '2026-05-26'; // Tuesday
        // Another completion in the same week (e.g. Monday 2026-05-25) is already frozen
        const existingFrozen = { id: 'c0', habitId: 'habit-2', date: '2026-05-25', completed: true, status: 'frozen' };
        useHabitStore.setState({
            completions: [existingFrozen as any],
        });

        mockUseShield.mockResolvedValue(true);
        const frozenCompletion = { id: 'c1', habitId, date, completed: true, status: 'frozen' };
        vi.mocked(freezeCompletion).mockResolvedValue(frozenCompletion as any);

        await useHabitStore.getState().freezeHabit(habitId, date);

        expect(mockUseShield).toHaveBeenCalled();
        expect(freezeCompletion).toHaveBeenCalledWith(habitId, date, 'test-user');
        const state = useHabitStore.getState();
        const comp = state.completions.find(c => c.habitId === habitId && c.date === date);
        expect(comp?.status).toBe('frozen');
    });

    it('freezeHabit should throw error if another freeze exists in the same week and shield use fails', async () => {
        const habitId = 'habit-1';
        const date = '2026-05-26'; // Tuesday
        const existingFrozen = { id: 'c0', habitId: 'habit-2', date: '2026-05-25', completed: true, status: 'frozen' };
        useHabitStore.setState({
            completions: [existingFrozen as any],
        });

        mockUseShield.mockResolvedValue(false);

        await expect(useHabitStore.getState().freezeHabit(habitId, date)).rejects.toThrow(
            "No free weekly freezes or purchased streak shields left! Buy a shield in Settings."
        );
        expect(freezeCompletion).not.toHaveBeenCalled();
    });
});
