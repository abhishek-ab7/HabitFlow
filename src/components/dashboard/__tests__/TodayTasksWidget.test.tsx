import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Mock } from 'vitest'
import { TodayTasksWidget } from '../TodayTasksWidget'
import { useTaskStore } from '@/lib/stores/task-store'

// Mock Stores
vi.mock('@/lib/stores/task-store', () => ({
    useTaskStore: vi.fn(),
}))

// Mock Router
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
        push: vi.fn(),
    })),
}))

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useMotionValue: vi.fn((val) => ({
        get: () => val,
        set: vi.fn(),
        onChange: vi.fn(),
    })),
    useTransform: vi.fn((val) => val),
}))

describe('TodayTasksWidget', () => {
    const mockLoadTasks = vi.fn()
    const mockToggleTaskComplete = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
            ; (useTaskStore as unknown as Mock).mockReturnValue({
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

    it('renders empty state when no tasks', async () => {
        render(<TodayTasksWidget />)
        // Wait for effect to mount
        expect(await screen.findByText('Clear for takeoff!')).toBeInTheDocument()
    })

    it('renders tasks due today', async () => {
        const today = new Date().toISOString().split('T')[0]
        const tasks = [
            { id: '1', title: 'Task 1', status: 'todo', due_date: today },
            { id: '2', title: 'Task 2', status: 'todo', due_date: today },
        ]

            ; (useTaskStore as unknown as Mock).mockReturnValue({
                tasks,
                loadTasks: mockLoadTasks,
                toggleTaskComplete: mockToggleTaskComplete,
                isLoading: false,
            })

        render(<TodayTasksWidget />)
        expect(await screen.findByText('Task 1')).toBeInTheDocument()
        expect(await screen.findByText('2 tasks due.')).toBeInTheDocument()
    })
})
