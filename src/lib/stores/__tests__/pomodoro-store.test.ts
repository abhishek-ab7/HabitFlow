import { usePomodoroStore } from '../pomodoro-store';
import { useTaskStore } from '../task-store';

// Mock task-store
vi.mock('../task-store', () => ({
    useTaskStore: {
        getState: vi.fn(() => ({
            editTask: vi.fn(),
        })),
    },
}));

describe('PomodoroStore', () => {
    beforeEach(() => {
        usePomodoroStore.setState({
            activeTaskId: null,
            activeTaskTitle: null,
            mode: 'focus',
            timeLeft: 25 * 60,
            duration: 25 * 60,
            isRunning: false,
            completedSessions: 0,
        });
        vi.clearAllMocks();
    });

    it('should have initial state', () => {
        const state = usePomodoroStore.getState();
        expect(state.activeTaskId).toBeNull();
        expect(state.mode).toBe('focus');
        expect(state.isRunning).toBe(false);
    });

    it('should start timer and set task status to in_progress', () => {
        const editTaskMock = vi.fn();
        vi.mocked(useTaskStore.getState).mockReturnValue({ editTask: editTaskMock } as any);

        usePomodoroStore.getState().startTimer('task-1', 'Test Task');

        expect(editTaskMock).toHaveBeenCalledWith('task-1', { status: 'in_progress' });
        const state = usePomodoroStore.getState();
        expect(state.activeTaskId).toBe('task-1');
        expect(state.activeTaskTitle).toBe('Test Task');
        expect(state.isRunning).toBe(true);
    });

    it('should pause and resume timer', () => {
        const state = usePomodoroStore.getState();
        state.startTimer('task-1', 'Test Task');
        expect(usePomodoroStore.getState().isRunning).toBe(true);

        usePomodoroStore.getState().pauseTimer();
        expect(usePomodoroStore.getState().isRunning).toBe(false);

        usePomodoroStore.getState().resumeTimer();
        expect(usePomodoroStore.getState().isRunning).toBe(true);
    });

    it('should handle timer ticks and complete session', () => {
        const state = usePomodoroStore.getState();
        state.startTimer('task-1', 'Test Task');
        
        // set timeLeft to 2 seconds
        usePomodoroStore.setState({ timeLeft: 2 });
        
        // tick 1
        usePomodoroStore.getState().tick();
        expect(usePomodoroStore.getState().timeLeft).toBe(1);
        expect(usePomodoroStore.getState().isRunning).toBe(true);

        // tick 2 (reaches 0 and completes session)
        const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
        usePomodoroStore.getState().tick();

        const finishedState = usePomodoroStore.getState();
        expect(finishedState.timeLeft).toBe(5 * 60); // short break duration
        expect(finishedState.mode).toBe('short_break');
        expect(finishedState.completedSessions).toBe(1);
        expect(finishedState.isRunning).toBe(false);
        expect(dispatchEventSpy).toHaveBeenCalled();
    });

    it('should reset timer to mode default duration', () => {
        usePomodoroStore.setState({ mode: 'focus', timeLeft: 100, isRunning: true });
        usePomodoroStore.getState().resetTimer();

        const state = usePomodoroStore.getState();
        expect(state.timeLeft).toBe(25 * 60);
        expect(state.isRunning).toBe(false);
    });
});
