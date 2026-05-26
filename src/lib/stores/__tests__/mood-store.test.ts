import { useMoodStore } from '../mood-store';
import { getMoodLogs, setMoodLog } from '../../db';
import { getSyncEngine } from '../../sync';

// Mock dependencies
vi.mock('../../db', () => ({
    getMoodLogs: vi.fn(),
    setMoodLog: vi.fn(),
}));

vi.mock('../../supabase/client', () => ({
    getSupabaseClient: vi.fn(() => ({
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
        },
    })),
}));

vi.mock('../../sync', () => ({
    getSyncEngine: vi.fn(() => ({
        pushMoodLog: vi.fn(),
    })),
}));

describe('MoodStore', () => {
    beforeEach(() => {
        useMoodStore.setState({ moodLogs: [], isLoading: false, error: null });
        vi.clearAllMocks();
    });

    it('should have initial state', () => {
        const state = useMoodStore.getState();
        expect(state.moodLogs).toEqual([]);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it('should load mood logs correctly', async () => {
        const mockLogs = [
            { id: '1', userId: 'test-user', date: '2026-05-26', mood: 'happy' as const }
        ];
        vi.mocked(getMoodLogs).mockResolvedValue(mockLogs);

        await useMoodStore.getState().loadMoodLogs('2026-05-20', '2026-05-26');

        expect(getMoodLogs).toHaveBeenCalledWith('test-user', '2026-05-20', '2026-05-26');
        expect(useMoodStore.getState().moodLogs).toEqual(mockLogs);
        expect(useMoodStore.getState().isLoading).toBe(false);
    });

    it('should log mood and trigger sync', async () => {
        const mockLog = { id: '1', userId: 'test-user', date: '2026-05-26', mood: 'happy' as const };
        vi.mocked(setMoodLog).mockResolvedValue(mockLog);
        
        const pushMoodLogMock = vi.fn();
        vi.mocked(getSyncEngine).mockReturnValue({ pushMoodLog: pushMoodLogMock } as any);

        await useMoodStore.getState().logMood('2026-05-26', 'happy');

        expect(setMoodLog).toHaveBeenCalledWith('test-user', '2026-05-26', 'happy');
        expect(useMoodStore.getState().moodLogs).toContainEqual(mockLog);
        expect(pushMoodLogMock).toHaveBeenCalledWith(mockLog);
    });

    it('should get mood for a specific date', () => {
        useMoodStore.setState({
            moodLogs: [
                { id: '1', userId: 'test-user', date: '2026-05-26', mood: 'happy' as const },
                { id: '2', userId: 'test-user', date: '2026-05-25', mood: 'calm' as const },
            ]
        });

        const mood = useMoodStore.getState().getMoodForDate('2026-05-26');
        expect(mood).toBe('happy');

        const nonExistentMood = useMoodStore.getState().getMoodForDate('2026-05-24');
        expect(nonExistentMood).toBeUndefined();
    });
});
