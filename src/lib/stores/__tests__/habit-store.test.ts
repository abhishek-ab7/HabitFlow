import { useHabitStore } from '../habit-store'

// Mock dependencies
vi.mock('../../db', () => ({
    getHabits: vi.fn(),
    createHabit: vi.fn(),
    updateHabit: vi.fn(),
    deleteHabit: vi.fn(),
    toggleCompletion: vi.fn(),
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

vi.mock('../gamification-store', () => ({
    useGamificationStore: {
        getState: vi.fn(() => ({
            addXp: vi.fn(),
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
})
