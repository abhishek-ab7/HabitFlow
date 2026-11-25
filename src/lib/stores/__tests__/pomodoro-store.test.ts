import { usePomodoroStore, POMODORO_DURATIONS } from '../pomodoro-store';
import { useTaskStore } from '../task-store';
import { CrossDomainActionMediator } from '../mediator';

// Mock task-store & mediator
vi.mock('../task-store', () => ({
    useTaskStore: {
        getState: vi.fn(() => ({
            editTask: vi.fn(),
        })),
    },
}));

vi.mock('../mediator', () => ({
    CrossDomainActionMediator: {
        dispatch: vi.fn().mockResolvedValue(undefined),
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
            endsAt: null,
            lastTickMs: null,
            completedSessions: 0,
            urgeHabitId: null,
            urgeHabitName: null,
            pendingUrgeReflection: false,
            lastCompletedMode: null,
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

    it('should adjust duration when not running', () => {
        usePomodoroStore.setState({ timeLeft: 1500, isRunning: false });
        usePomodoroStore.getState().adjustDuration(300); // add 5 minutes

        const state1 = usePomodoroStore.getState();
        expect(state1.timeLeft).toBe(1800);
        expect(state1.duration).toBe(1800);

        // Adjust negative
        usePomodoroStore.getState().adjustDuration(-600); // subtract 10 minutes
        const state2 = usePomodoroStore.getState();
        expect(state2.timeLeft).toBe(1200);
        expect(state2.duration).toBe(1200);
    });

    it('should not adjust duration when running', () => {
        usePomodoroStore.setState({ timeLeft: 1500, isRunning: true });
        usePomodoroStore.getState().adjustDuration(300);

        const state = usePomodoroStore.getState();
        expect(state.timeLeft).toBe(1500);
        expect(state.duration).toBe(1500);
    });

    describe('Wall-clock endsAt timer jumps (gym_rest, urge_10m, starter_2m)', () => {
        it('jumps gym_rest across mobile sleep/wake using wall-clock endsAt without drifting', () => {
            vi.useFakeTimers();
            const t0 = new Date('2026-11-24T10:00:00.000Z').getTime();
            vi.setSystemTime(t0);

            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
            usePomodoroStore.getState().startGymRestTimer(90, 'Incline Dumbbell Press');

            const started = usePomodoroStore.getState();
            expect(started.mode).toBe('gym_rest');
            expect(started.duration).toBe(90);
            expect(started.isRunning).toBe(true);
            expect(started.endsAt).toBe(t0 + 90_000);

            // Simulate mobile screen sleep for 45 seconds and wake sync
            usePomodoroStore.getState().syncFromClock(t0 + 45_000);
            expect(usePomodoroStore.getState().timeLeft).toBe(45);
            expect(usePomodoroStore.getState().isRunning).toBe(true);

            // Jump past completion (90s)
            usePomodoroStore.getState().syncFromClock(t0 + 90_000);
            const completed = usePomodoroStore.getState();
            expect(completed.isRunning).toBe(false);
            expect(completed.endsAt).toBeNull();
            expect(completed.lastCompletedMode).toBe('gym_rest');
            expect(completed.mode).toBe('gym_rest');
            expect(completed.timeLeft).toBe(90);
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'pomodoro-complete' })
            );

            vi.useRealTimers();
        });

        it('completes urge_10m on wall-clock jump, prompts reflection, and dispatches mediator outcome', async () => {
            vi.useFakeTimers();
            const t0 = new Date('2026-11-24T14:00:00.000Z').getTime();
            vi.setSystemTime(t0);

            usePomodoroStore.getState().startUrgeTimer('hab_quit_junk', 'No Junk Food');
            const started = usePomodoroStore.getState();
            expect(started.mode).toBe('urge_10m');
            expect(started.duration).toBe(POMODORO_DURATIONS.urge_10m);
            expect(started.endsAt).toBe(t0 + 600_000);
            expect(started.pendingUrgeReflection).toBe(false);

            // Jump 5 minutes via tick(nowMs)
            usePomodoroStore.getState().tick(t0 + 300_000);
            expect(usePomodoroStore.getState().timeLeft).toBe(300);

            // Jump past 10 minutes
            usePomodoroStore.getState().tick(t0 + 600_000);
            const finished = usePomodoroStore.getState();
            expect(finished.isRunning).toBe(false);
            expect(finished.pendingUrgeReflection).toBe(true);
            expect(finished.lastCompletedMode).toBe('urge_10m');

            usePomodoroStore.getState().resolveUrgeReflection('passed');
            expect(usePomodoroStore.getState().pendingUrgeReflection).toBe(false);
            await vi.waitFor(() => {
                expect(CrossDomainActionMediator.dispatch).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'HABIT_COMPLETED',
                        payload: expect.objectContaining({ habitId: 'hab_quit_junk' }),
                    })
                );
            });

            vi.useRealTimers();
        });

        it('transitions starter_2m to focus on wall-clock jump and preserves pause/resume accuracy', () => {
            vi.useFakeTimers();
            const t0 = new Date('2026-11-24T16:00:00.000Z').getTime();
            vi.setSystemTime(t0);

            usePomodoroStore.getState().startPresetTimer('starter_2m', { openPanel: false });
            expect(usePomodoroStore.getState().duration).toBe(120);

            // Advance 30s and pause
            vi.setSystemTime(t0 + 30_000);
            usePomodoroStore.getState().pauseTimer();
            expect(usePomodoroStore.getState().isRunning).toBe(false);
            expect(usePomodoroStore.getState().timeLeft).toBe(90);

            // Resume 60s later while paused -> still 90s remaining
            const tResume = t0 + 90_000;
            vi.setSystemTime(tResume);
            usePomodoroStore.getState().resumeTimer();
            expect(usePomodoroStore.getState().endsAt).toBe(tResume + 90_000);

            // Jump 90s past resume -> transitions to focus
            usePomodoroStore.getState().syncFromClock(tResume + 90_000);
            const done = usePomodoroStore.getState();
            expect(done.isRunning).toBe(false);
            expect(done.lastCompletedMode).toBe('starter_2m');
            expect(done.mode).toBe('focus');
            expect(done.timeLeft).toBe(POMODORO_DURATIONS.focus);

            vi.useRealTimers();
        });

        it('finalizes completion instead of clamping timeLeft to 1 if pauseTimer runs after endsAt has elapsed', () => {
            vi.useFakeTimers();
            const t0 = new Date('2026-11-24T17:00:00.000Z').getTime();
            vi.setSystemTime(t0);

            usePomodoroStore.getState().startUrgeTimer('hab_quit', 'No Junk Food');
            vi.setSystemTime(t0 + 605_000);
            usePomodoroStore.getState().pauseTimer();

            const state = usePomodoroStore.getState();
            expect(state.isRunning).toBe(false);
            expect(state.pendingUrgeReflection).toBe(true);
            expect(state.lastCompletedMode).toBe('urge_10m');

            vi.useRealTimers();
        });
    });
});
