// AI Feature Types and Interfaces

export type AIFeature = 
  | 'coach'
  | 'prioritize'
  | 'recommend-habits'
  | 'plan-week'
  | 'burnout-check'
  | 'generate-milestones'
  | 'suggest-stacks'
  | 'parse-task'
  | 'streak-recovery'
  | 'progress-summary'
  | 'motivate'
  | 'enhance-habit'
  | 'analyze-correlations'
  | 'optimize-deadline'
  | 'generate-subtasks';

export interface AIRequest<T = any> {
  feature: AIFeature;
  data: T;
  userId?: string;
  cacheKey?: string;
  cacheTTL?: number;
}

export interface AIResponse<T = any> {
  data: T;
  cached: boolean;
  generatedAt: string;
  feature: AIFeature;
}

export interface AIError {
  feature: AIFeature;
  error: string;
  code: 'RATE_LIMIT' | 'NETWORK' | 'PARSE' | 'VALIDATION' | 'UNKNOWN';
  retryable: boolean;
  retryAfter?: number;
}

// Feature-specific types

export interface CoachBriefingInput {
  userData: {
    userName?: string;
    level?: number;
    xp?: number;
    userId: string;
  };
  context: {
    unfinishedTasks?: number;
    todaysHabits?: string;
    mode?: 'briefing' | 'suggestion';
    category?: string;
    burnoutRisk?: number;
    topPriorityTask?: string;
    upcomingDeadlines?: Array<{ title: string; daysLeft: number }>;
  };
}

export interface CoachBriefingOutput {
  greeting: string;
  focus: string;
  quote: string;
  energyForecast?: 'low' | 'medium' | 'high';
  streaksAtRisk?: string[];
  quickWins?: string[];
  goalsDeadline?: string;
  weekMomentum?: 'up' | 'down' | 'stable';
}

export interface TaskPriorityInput {
  task: {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    priority?: string;
    tags?: string[];
  };
  userContext: {
    completionPatterns?: any;
    activeGoals?: Array<{ title: string; deadline: string }>;
    currentTime?: string;
    weekdayStats?: any;
  };
}

export interface TaskPriorityOutput {
  taskId: string;
  suggestedPriority: 'low' | 'medium' | 'high';
  reasoning: string;
  estimatedDuration?: string;
  bestTimeSlot?: string;
  dependencies?: string[];
  urgencyScore: number;
}

export interface HabitRecommendationInput {
  goals: Array<{
    id: string;
    title: string;
    description?: string;
    areaOfLife: string;
  }>;
  currentHabits: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  categoryPerformance?: Record<string, number>;
  userLevel?: number;
}

export interface HabitRecommendationOutput {
  recommendations: Array<{
    habitName: string;
    category: string;
    reasoning: string;
    targetDaysPerWeek: number;
    stackWith?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    expectedImpact: 'low' | 'medium' | 'high';
    relatedGoals?: string[];
  }>;
}

export interface BurnoutCheckInput {
  completionRates: {
    last7Days: number;
    last30Days: number;
    previous7Days: number;
  };
  streakData: Array<{
    habitName: string;
    currentStreak: number;
    consecutiveSkips: number;
  }>;
  taskVelocity: {
    current: number;
    baseline: number;
  };
  xpGainRate?: {
    current: number;
    baseline: number;
  };
}

export interface BurnoutCheckOutput {
  burnoutRisk: 'low' | 'medium' | 'high';
  score: number;
  indicators: string[];
  recommendations: string[];
  recoveryPlan?: string;
}

export interface SubtaskGenerationInput {
  title: string;
  description?: string;
}

export interface SubtaskGenerationOutput {
  subtasks: string[];
}

export interface WeeklyPlanInput {
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    due_date?: string;
    estimatedDuration?: number;
  }>;
  habits: Array<{
    id: string;
    name: string;
    targetDaysPerWeek: number;
  }>;
  goals: Array<{
    id: string;
    title: string;
    deadline: string;
  }>;
  weekdayStats?: Record<string, number>;
}

export interface WeeklyPlanOutput {
  weekPlan: Record<string, {
    focus: string;
    tasks: string[];
    habits: string[];
    goalProgress?: string;
    estimatedWorkload: string;
    energyLevel: 'low' | 'medium' | 'high';
  }>;
  insights: string[];
}

// ========== Goal Milestone Generator ==========
export interface MilestoneGenerationInput {
  goal: {
    id: string;
    title: string;
    description?: string;
    deadline: string;
    areaOfLife: string;
  };
  userContext?: {
    userLevel?: number;
    currentMilestones?: number;
    timelinePreference?: 'aggressive' | 'balanced' | 'relaxed';
  };
}

export interface GeneratedMilestone {
  title: string;
  description: string;
  suggestedDeadline: string;
  difficulty: 'easy' | 'medium' | 'hard';
  reasoning: string;
  orderIndex: number;
  estimatedTimeWeeks: number;
}

export interface MilestoneGenerationOutput {
  goalId: string;
  milestones: GeneratedMilestone[];
  totalEstimatedWeeks: number;
  confidenceScore: number;
  alternativeApproaches?: string[];
}

// ========== Smart Habit Stacking ==========
export interface HabitStackingInput {
  existingHabits: Array<{
    id: string;
    name: string;
    category: string;
    currentStreak: number;
    completionRate: number;
  }>;
  userContext?: {
    availableTimeSlots?: string[];
    strugglingCategories?: string[];
    topPerformingHabits?: string[];
  };
}

export interface HabitStack {
  name: string;
  description: string;
  triggerHabitId: string;
  stackedHabitIds: string[];
  suggestedOrder: string[];
  reasoning: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTimeMinutes: number;
  expectedSuccessRate: number;
}

export interface HabitStackingOutput {
  stacks: HabitStack[];
  topRecommendation: string;
  tips: string[];
}

// ========== Motivational Quote Personalizer ==========
export interface QuotePersonalizationInput {
  userContext: {
    userName: string;
    currentMood?: 'struggling' | 'motivated' | 'neutral' | 'accomplished';
    recentActivity?: {
      completedHabitsToday: number;
      missedStreak?: boolean;
      upcomingDeadline?: string;
      recentWin?: string;
    };
    goals?: Array<{ title: string; progress: number }>;
  };
  context?: 'morning' | 'evening' | 'struggling' | 'celebrating' | 'general';
}

export interface PersonalizedQuote {
  quote: string;
  author?: string;
  relevanceScore: number;
  context: string;
  reasoning: string;
  actionableInsight?: string;
}

export interface QuotePersonalizationOutput {
  primaryQuote: PersonalizedQuote;
  alternativeQuotes?: PersonalizedQuote[];
}

// ========== Smart Habit Descriptions ==========
export interface HabitDescriptionInput {
  habit: {
    name: string;
    category: string;
  };
  userGoals?: Array<{ title: string; areaOfLife: string }>;
  generateTips?: boolean;
}

export interface HabitDescriptionOutput {
  description: string;
  benefits: string[];
  tips: string[];
  difficultyAssessment: 'beginner' | 'intermediate' | 'advanced';
  estimatedTimeMinutes: number;
  scientificBacking?: string;
  commonPitfalls?: string[];
}
