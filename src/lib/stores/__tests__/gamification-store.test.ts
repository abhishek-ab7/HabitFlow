import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGamificationStore, SHIELD_COST, GEMS_PER_LEVEL } from '../gamification-store';
import * as db from '../../db'; // Actually, the path in gamification-store is '../db'
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

describe('gamification-store', () => {
    beforeEach(() => {
        // Reset store state before each test
        useGamificationStore.setState({
            xp: 0,
            level: 1,
            gems: 0,
            streakShield: 0,
            showLevelUp: false,
        });
        vi.clearAllMocks();
    });

    it('Initial state has xp=0, level=1, gems=0', () => {
        const state = useGamificationStore.getState();
        expect(state.xp).toBe(0);
        expect(state.level).toBe(1);
        expect(state.gems).toBe(0);
    });

    it('addXp increments XP correctly', async () => {
        const { addXp } = useGamificationStore.getState();
        const result = await addXp(50);
        
        expect(result.leveledUp).toBe(false);
        expect(result.newLevel).toBe(1);
        
        const state = useGamificationStore.getState();
        expect(state.xp).toBe(50);
        expect(state.level).toBe(1);
    });

    it('addXp triggers level-up at threshold and awards gems', async () => {
        const { addXp } = useGamificationStore.getState();
        
        // Level 1 requires 100 XP to level up
        const result = await addXp(100);
        
        expect(result.leveledUp).toBe(true);
        expect(result.newLevel).toBe(2);
        
        const state = useGamificationStore.getState();
        expect(state.xp).toBe(0);
        expect(state.level).toBe(2);
        expect(state.gems).toBe(GEMS_PER_LEVEL);
        expect(state.showLevelUp).toBe(true);
    });

    it('addXp carries over excess XP after level-up', async () => {
        const { addXp } = useGamificationStore.getState();
        
        // Level 1 requires 100 XP. We add 150.
        // Should reach Level 2 with 50 XP carrying over.
        await addXp(150);
        
        const state = useGamificationStore.getState();
        expect(state.xp).toBe(50);
        expect(state.level).toBe(2);
    });

    it('spendGems deducts correctly', async () => {
        useGamificationStore.setState({ gems: 10 });
        const { spendGems } = useGamificationStore.getState();
        
        const success = await spendGems(5);
        expect(success).toBe(true);
        
        const state = useGamificationStore.getState();
        expect(state.gems).toBe(5);
    });

    it('spendGems fails if insufficient gems', async () => {
        useGamificationStore.setState({ gems: 2 });
        const { spendGems } = useGamificationStore.getState();
        
        const success = await spendGems(5);
        expect(success).toBe(false);
        
        const state = useGamificationStore.getState();
        expect(state.gems).toBe(2);
    });

    it('buyShield costs SHIELD_COST gems and increments shields', async () => {
        useGamificationStore.setState({ gems: SHIELD_COST + 5, streakShield: 0 });
        const { buyShield } = useGamificationStore.getState();
        
        const success = await buyShield();
        expect(success).toBe(true);
        
        const state = useGamificationStore.getState();
        expect(state.gems).toBe(5);
        expect(state.streakShield).toBe(1);
    });

    it('buyShield fails if insufficient gems', async () => {
        useGamificationStore.setState({ gems: SHIELD_COST - 1, streakShield: 0 });
        const { buyShield } = useGamificationStore.getState();
        
        const success = await buyShield();
        expect(success).toBe(false);
        
        const state = useGamificationStore.getState();
        expect(state.gems).toBe(SHIELD_COST - 1); // Unchanged
        expect(state.streakShield).toBe(0); // Unchanged
    });

    it('getBufferProgress returns 0-100 range', () => {
        // Level 1: requires 100 XP
        useGamificationStore.setState({ level: 1, xp: 50 });
        let progress = useGamificationStore.getState().getBufferProgress();
        expect(progress).toBe(50); // 50%

        // Level 2: requires 200 XP
        useGamificationStore.setState({ level: 2, xp: 50 });
        progress = useGamificationStore.getState().getBufferProgress();
        expect(progress).toBe(25); // 50 / 200 = 25%

        // Cap at 100% just in case (though should've leveled up)
        useGamificationStore.setState({ level: 2, xp: 250 });
        progress = useGamificationStore.getState().getBufferProgress();
        expect(progress).toBe(100); 
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
});
