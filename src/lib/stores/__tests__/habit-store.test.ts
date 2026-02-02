import { useHabitStore } from '../habit-store'

// Mock dependencies
jest.mock('../../db', () => ({
    getHabits: jest.fn(),
    createHabit: jest.fn(),
    updateHabit: jest.fn(),
    deleteHabit: jest.fn(),
    toggleCompletion: jest.fn(),
    getAllCompletionsInRange: jest.fn(),
    reorderHabits: jest.fn(),
}))

jest.mock('../../supabase/client', () => ({
    getSupabaseClient: jest.fn(() => ({
        auth: {
            getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
        },
    })),
}))

jest.mock('../../sync', () => ({
    getSyncEngine: jest.fn(() => ({
        pushHabit: jest.fn(),
        deleteHabit: jest.fn(),
        pushCompletion: jest.fn(),
        deleteCompletion: jest.fn(),
    })),
}))

jest.mock('../gamification-store', () => ({
    useGamificationStore: {
        getState: jest.fn(() => ({
            addXp: jest.fn(),
        })),
    },
    XP_PER_HABIT: 10,
}))

describe('HabitStore', () => {
    beforeEach(() => {
        useHabitStore.setState({ habits: [], completions: [], error: null, isLoading: false })
        jest.clearAllMocks()
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
})
