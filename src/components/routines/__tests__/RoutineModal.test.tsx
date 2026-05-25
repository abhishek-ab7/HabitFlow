import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoutineModal } from '../RoutineModal'
import { Routine } from '@/lib/types'

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Define stable mock functions
const mockAddRoutine = vi.fn()
const mockUpdateRoutine = vi.fn()
const mockGetRoutineHabits = vi.fn().mockResolvedValue([])
const mockLinkHabit = vi.fn()
const mockUnlinkHabit = vi.fn()

const mockRoutineStore = {
    addRoutine: mockAddRoutine,
    updateRoutine: mockUpdateRoutine,
    getRoutineHabits: mockGetRoutineHabits,
    linkHabit: mockLinkHabit,
    unlinkHabit: mockUnlinkHabit,
}

const mockLoadHabits = vi.fn().mockResolvedValue([])
const mockHabits = [
    { id: '1', name: 'Meditation', archived: false, icon: '🧘' },
    { id: '2', name: 'Running', archived: false, icon: '🏃' },
]

const mockHabitStore = {
    habits: mockHabits,
    loadHabits: mockLoadHabits,
}

// Mock stores with stable returns
vi.mock('@/lib/stores/routine-store', () => ({
    useRoutineStore: () => mockRoutineStore,
}))

vi.mock('@/lib/stores/habit-store', () => ({
    useHabitStore: () => mockHabitStore,
}))

// Mock location
vi.mock('@/lib/location', () => ({
    getCurrentPosition: vi.fn(),
}))

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('RoutineModal', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // Reset mock implementation if needed
    })

    it('renders correctly when creating a new routine', () => {
        // Need to await effects? Text rendering should be immediate enough for tests usually
        render(<RoutineModal isOpen={true} onClose={mockOnClose} />)

        expect(screen.getByText('Design New Routine')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('e.g. Morning Focus Protocol')).toBeInTheDocument()
        // "Habit Stack" might be inside the form
        expect(screen.getByText('Habit Stack')).toBeInTheDocument()
    })

    it('renders correctly when editing a routine', () => {
        const mockRoutine: Routine = {
            id: '123',
            title: 'Morning Routine',
            description: 'Start the day right',
            triggerType: 'manual',
            triggerValue: '',
            userId: 'u1',
            isActive: true,
            orderIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        render(<RoutineModal isOpen={true} onClose={mockOnClose} routine={mockRoutine} />)

        expect(screen.getByText('Edit Routine')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Morning Routine')).toBeInTheDocument()
    })

    it('calls onClose when Cancel is clicked', () => {
        render(<RoutineModal isOpen={true} onClose={mockOnClose} />)

        const cancelButton = screen.getByText('Cancel')
        fireEvent.click(cancelButton)

        expect(mockOnClose).toHaveBeenCalled()
    })
})
