import { useAchievementStore } from '../achievement-store';
import { useHabitStore } from '../habit-store';
import { useTaskStore } from '../task-store';
import { useMoodStore } from '../mood-store';
import { useGamificationStore } from '../gamification-store';

// Mock sibling stores
vi.mock('../habit-store', () => ({
  useHabitStore: {
    getState: vi.fn(() => ({
      habits: [],
      completions: [],
      getCurrentStreaks: vi.fn(() => new Map()),
    })),
  },
}));

vi.mock('../task-store', () => ({
  useTaskStore: {
    getState: vi.fn(() => ({
      tasks: [],
    })),
  },
}));

vi.mock('../mood-store', () => ({
  useMoodStore: {
    getState: vi.fn(() => ({
      moodLogs: [],
    })),
  },
}));

vi.mock('../gamification-store', () => ({
  useGamificationStore: {
    getState: vi.fn(() => ({
      addXp: vi.fn(),
      addGems: vi.fn(),
    })),
  },
}));

describe('useAchievementStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    useAchievementStore.setState({
      achievements: [],
      newlyUnlockedId: null,
    });
  });

  it('should calculate initial achievements as locked', () => {
    useAchievementStore.getState().calculateAchievements();
    const state = useAchievementStore.getState();
    
    expect(state.achievements).toHaveLength(7);
    state.achievements.forEach(ach => {
      expect(ach.isUnlocked).toBe(false);
      expect(ach.isClaimed).toBe(false);
    });
  });

  it('should unlock Discipline Starter when progress is achieved', () => {
    vi.mocked(useHabitStore.getState).mockReturnValue({
      habits: [],
      completions: [{ id: 'comp-1' }] as any,
      getCurrentStreaks: vi.fn(() => new Map()),
    } as any);

    useAchievementStore.getState().calculateAchievements();
    const ach = useAchievementStore.getState().achievements.find(a => a.id === 'discipline_starter');
    
    expect(ach?.progress).toBe(1);
    expect(ach?.isUnlocked).toBe(true);
    expect(useAchievementStore.getState().newlyUnlockedId).toBe('discipline_starter');
  });

  it('should unlock streak achievements correctly', () => {
    const mockStreaks = new Map();
    mockStreaks.set('habit-1', 8);

    vi.mocked(useHabitStore.getState).mockReturnValue({
      habits: [],
      completions: [],
      getCurrentStreaks: () => mockStreaks,
    } as any);

    useAchievementStore.getState().calculateAchievements();
    const starter = useAchievementStore.getState().achievements.find(a => a.id === 'streak_starter');
    const master = useAchievementStore.getState().achievements.find(a => a.id === 'streak_master');

    expect(starter?.isUnlocked).toBe(true);
    expect(master?.isUnlocked).toBe(true);
    expect(starter?.progress).toBe(3); // capped at target
    expect(master?.progress).toBe(7); // capped at target
  });

  it('should allow claiming rewards and updating gamification store', () => {
    const addXpMock = vi.fn();
    const addGemsMock = vi.fn();
    vi.mocked(useGamificationStore.getState).mockReturnValue({
      addXp: addXpMock,
      addGems: addGemsMock,
    } as any);

    // Setup state where discipline_starter is unlocked but unclaimed
    useAchievementStore.setState({
      achievements: [
        {
          id: 'discipline_starter',
          title: 'Discipline Starter',
          description: '',
          icon: 'Zap',
          category: 'general',
          progress: 1,
          target: 1,
          isUnlocked: true,
          isClaimed: false,
          gemReward: 5,
          xpReward: 50,
        },
      ],
    });

    useAchievementStore.getState().claimReward('discipline_starter');

    expect(addXpMock).toHaveBeenCalledWith(50);
    expect(addGemsMock).toHaveBeenCalledWith(5);
    
    const ach = useAchievementStore.getState().achievements.find(a => a.id === 'discipline_starter');
    expect(ach?.isClaimed).toBe(true);
  });
});
