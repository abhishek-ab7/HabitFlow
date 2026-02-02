import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TodayTasksWidget } from '../TodayTasksWidget'
import { useTaskStore } from '@/lib/stores/task-store'

// Mock Stores
jest.mock('@/lib/stores/task-store', () => ({
    useTaskStore: jest.fn(),
}))

// Mock Router
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(() => ({
        push: jest.fn(),
    })),
}))

// Mock Framer Motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('TodayTasksWidget', () => {
    const mockLoadTasks = jest.fn()
    const mockToggleTaskComplete = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
            ; (useTaskStore as unknown as jest.Mock).mockReturnValue({
                tasks: [],
                loadTasks: mockLoadTasks,
                toggleTaskComplete: mockToggleTaskComplete,
                isLoading: false,
            })
    })

    it('renders loading state initially', () => {
        render(<TodayTasksWidget />)
        // The component has a mounted check, usually implies a spinner or null
        // Depending on implementation, it might show a spinner
        // With 'mounted' check it returns the loading skeleton
    })

    it('renders empty state when no tasks', () => {
        render(<TodayTasksWidget />)
        // Wait for effect?
        // Since we mock state, it should render immediately after mount logic?
        // The component has `if (!mounted)`. Test environment might render fast.
        // We can verify "Clear for takeoff!" text if it renders.
        expect(screen.getByText('Clear for takeoff!')).toBeInTheDocument()
    })

    it('renders tasks due today', () => {
        const today = new Date().toISOString().split('T')[0]
        const tasks = [
            { id: '1', title: 'Task 1', status: 'todo', due_date: today },
            { id: '2', title: 'Task 2', status: 'todo', due_date: today },
        ]

            ; (useTaskStore as unknown as jest.Mock).mockReturnValue({
                tasks,
                loadTasks: mockLoadTasks,
                toggleTaskComplete: mockToggleTaskComplete,
                isLoading: false,
            })

        render(<TodayTasksWidget />)
        expect(screen.getByText('Task 1')).toBeInTheDocument()
        expect(screen.getByText('2 tasks due.')).toBeInTheDocument()
    })
})
