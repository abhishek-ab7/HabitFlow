import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGamificationStore } from '../gamification-store';
import * as db from '../../db';
import * as supabaseClient from '../../supabase/client';
import * as sync from '../../sync';

// Mock dependencies
vi.mock('../../db', () => ({
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
}));

vi.mock('../../supabase/client', () => ({
    getSupabaseClient: vi.fn(() => ({
        auth: {
            getSession: vi.fn().mockResolvedValue({
                data: { session: null }
            })
        }
    }))
}));

vi.mock('../../sync', () => ({
    getSyncEngine: vi.fn(() => ({
        pushUserSettings: vi.fn()
    }))
}));

describe('gamification-store (personal settings & streak shields)', () => {
    beforeEach(() => {
        useGamificationStore.setState({
            streakShield: 0,
            isLoading: false,
            settings: null,
        });
        vi.clearAllMocks();
    });

    it('Initial state has streakShield=0 and settings=null', () => {
        const state = useGamificationStore.getState();
        expect(state.streakShield).toBe(0);
        expect(state.settings).toBeNull();
    });

    it('loadGamification loads settings and streakShield for authenticated session', async () => {
        const mockSettings = {
            id: 's1',
            userId: 'u1',
            streakShield: 2,
            theme: 'dark',
            weekStartsOn: 1,
            defaultCategory: 'health',
        } as any;

        vi.mocked(supabaseClient.getSupabaseClient).mockReturnValue({
            auth: {
                getSession: vi.fn().mockResolvedValue({
                    data: { session: { user: { id: 'u1' } } }
                })
            }
        } as any);
        vi.mocked(db.getSettings).mockResolvedValue(mockSettings);

        await useGamificationStore.getState().loadGamification();

        const state = useGamificationStore.getState();
        expect(state.streakShield).toBe(2);
        expect(state.settings).toEqual(mockSettings);
        expect(state.isLoading).toBe(false);
    });

    it('useShield decrements streakShield and returns true if shields > 0', async () => {
        useGamificationStore.setState({ streakShield: 3 });
        const { useShield } = useGamificationStore.getState();

        const success = await useShield();
        expect(success).toBe(true);

        const state = useGamificationStore.getState();
        expect(state.streakShield).toBe(2);
    });

    it('useShield returns false and does not decrement if shields is 0', async () => {
        useGamificationStore.setState({ streakShield: 0 });
        const { useShield } = useGamificationStore.getState();

        const success = await useShield();
        expect(success).toBe(false);

        const state = useGamificationStore.getState();
        expect(state.streakShield).toBe(0);
    });

    it('setStreakShields updates and persists sanitized shield count', async () => {
        const pushUserSettings = vi.fn();
        vi.mocked(sync.getSyncEngine).mockReturnValue({ pushUserSettings } as any);
        vi.mocked(supabaseClient.getSupabaseClient).mockReturnValue({
            auth: {
                getSession: vi.fn().mockResolvedValue({
                    data: { session: { user: { id: 'u1' } } }
                })
            }
        } as any);
        vi.mocked(db.getSettings).mockResolvedValue({
            userId: 'u1',
            streakShield: 3,
        } as any);

        useGamificationStore.setState({
            streakShield: 0,
            settings: { id: 's1', userId: 'u1', streakShield: 0 } as any,
        });

        await useGamificationStore.getState().setStreakShields(3);

        const state = useGamificationStore.getState();
        expect(state.streakShield).toBe(3);
        expect(state.settings?.streakShield).toBe(3);
        expect(db.updateSettings).toHaveBeenCalledWith({ userId: 'u1', streakShield: 3 });
        expect(pushUserSettings).toHaveBeenCalled();
    });

    it('updateUserSettings merges partial workspace settings and persists them', async () => {
        useGamificationStore.setState({
            settings: {
                id: 's1',
                userId: 'u1',
                showTasks: true,
                habitOnlyMode: false,
            } as any,
        });

        vi.mocked(supabaseClient.getSupabaseClient).mockReturnValue({
            auth: {
                getSession: vi.fn().mockResolvedValue({
                    data: { session: { user: { id: 'u1' } } }
                })
            }
        } as any);
        vi.mocked(db.getSettings).mockResolvedValue({
            id: 's1',
            userId: 'u1',
            showTasks: true,
            habitOnlyMode: true,
        } as any);

        await useGamificationStore.getState().updateUserSettings({ habitOnlyMode: true });

        const state = useGamificationStore.getState();
        expect(state.settings?.habitOnlyMode).toBe(true);
        expect(db.updateSettings).toHaveBeenCalledWith({ userId: 'u1', habitOnlyMode: true });
    });
});
