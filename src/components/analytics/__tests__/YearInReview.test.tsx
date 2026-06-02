import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { expect, test, vi, beforeEach, describe, Mock } from 'vitest';
import { YearInReview } from '../YearInReview';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useTaskStore } from '@/lib/stores/task-store';

// Mock Stores
vi.mock('@/lib/stores/habit-store', () => ({
  useHabitStore: vi.fn(),
}));
vi.mock('@/lib/stores/goal-store', () => ({
  useGoalStore: vi.fn(),
}));
vi.mock('@/lib/stores/task-store', () => ({
  useTaskStore: vi.fn(),
}));

// Mock Framer Motion to handle motion.div, motion.h2, motion.p, etc. dynamically
vi.mock('framer-motion', () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: any) => {
          // Filter out framer-motion specific props to prevent DOM warnings
          const { transition, initial, animate, exit, ...domProps } = props;
          const Tag = prop as any;
          return <Tag {...domProps}>{children}</Tag>;
        };
      },
    }
  );
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// Mock html2canvas-pro to avoid canvas rendering complexities in JSDOM
vi.mock('html2canvas-pro', () => ({
  default: vi.fn().mockResolvedValue({
    toBlob: vi.fn((callback) => callback(new Blob(['test-image'], { type: 'image/png' }))),
    toDataURL: vi.fn(() => 'data:image/png;base64,test'),
  }),
}));

describe('YearInReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useHabitStore as unknown as Mock).mockReturnValue({
      habits: [
        { id: 'h1', title: 'Habit 1', category: 'health', archived: false }
      ],
      completions: [
        { habitId: 'h1', date: '2026-01-01', completed: true }
      ],
    });

    (useGoalStore as unknown as Mock).mockReturnValue({
      goals: [
        { id: 'g1', title: 'Goal 1', status: 'completed', deadline: '2026-12-31' }
      ],
    });

    (useTaskStore as unknown as Mock).mockReturnValue({
      tasks: [
        { id: 't1', title: 'Task 1', status: 'done', due_date: '2026-05-01' }
      ],
    });

    // Mock global objects
    vi.stubGlobal('navigator', {
      clipboard: {
        write: vi.fn().mockResolvedValue(undefined),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      share: vi.fn().mockResolvedValue(undefined),
      canShare: vi.fn().mockReturnValue(true),
    });
  });

  test('renders welcome slide initially', () => {
    render(<YearInReview />);
    expect(screen.getByText('Your 2026 Journey')).toBeInTheDocument();
  });

  test('can navigate slides using indicators and clicks share', async () => {
    render(<YearInReview />);

    // Click Next slide 4 times to reach summary slide
    const nextBtn = screen.getByTitle('Next slide');
    fireEvent.click(nextBtn); // slide 2
    fireEvent.click(nextBtn); // slide 3
    fireEvent.click(nextBtn); // slide 4
    fireEvent.click(nextBtn); // slide 5 (summary)

    expect(screen.getByText('Your 2026 Habit Scorecard')).toBeInTheDocument();

    const shareBtn = screen.getByText('Share Stats');
    expect(shareBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // Verify share is called
    expect(navigator.share).toHaveBeenCalled();
  });
});
