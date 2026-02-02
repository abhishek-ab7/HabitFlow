// ============================================
// HABIT TRACKER - TYPE DEFINITIONS
// ============================================

// Categories for habits
export type Category =
  | 'health'
  | 'work'
  | 'learning'
  | 'personal'
  | 'finance'
  | 'relationships';

// Areas of life for goals
export type AreaOfLife =
  | 'career'
  | 'health'
  | 'relationships'
  | 'personal_growth'
  | 'finance'
  | 'fun';

// Priority levels
export type Priority = 'high' | 'medium' | 'low';

// Goal status
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';

// Trend direction for analytics
export type Trend = 'up' | 'down' | 'stable';

// ============================================
// HABIT MODELS
// ============================================

// ============================================
// HABIT MODELS
// ============================================

export interface Habit {
  id: string;
  userId: string; // Added for data isolation
  name: string;
  category: Category;
  targetDaysPerWeek: number; // 1-7
  createdAt: string; // ISO date string or timestamp
  archived: boolean;
  archivedAt?: string; // ISO date string - when habit was archived/deleted
  updatedAt?: string; // ISO date string - last modification time
  order: number; // For drag-and-drop ordering
  icon?: string; // Optional emoji or icon name
  routineId?: string | null; // For linking to routines
}

export interface HabitCompletion {
  id: string;
  userId: string; // Added for data isolation
  habitId: string;
  date: string; // YYYY-MM-DD format
  completed: boolean;
  note?: string;
  skipped?: boolean; // Intentionally skipped (e.g., rest day)
}

// Derived habit statistics
export interface HabitStats {
  habitId: string;
  currentStreak: number;
  bestStreak: number;
  completionRate: number; // 0-100
  totalCompletions: number;
  totalDays: number;
  momentum: Trend; // Based on recent performance
}

// ============================================
// GOAL MODELS
// ============================================

export interface Goal {
  id: string;
  userId: string; // Added for data isolation
  title: string;
  description?: string;
  areaOfLife: AreaOfLife;
  priority: Priority;
  status: GoalStatus;
  startDate: string; // ISO date string
  deadline: string; // ISO date string
  isFocus: boolean; // Featured goal on dashboard
  createdAt: string;
  completedAt?: string;
  archived: boolean;
}

export interface Milestone {
  id: string;
  userId: string; // Added for data isolation
  goalId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  deadline?: string;
  order: number;
}

// Derived goal statistics
export interface GoalStats {
  goalId: string;
  progress: number; // 0-100, based on milestone completion
  milestonesCompleted: number;
  milestonesTotal: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  isOnTrack: boolean;
  projectedCompletion?: number; // Projected completion % by deadline
}

// ============================================
// ROUTINE MODELS
// ============================================

export interface Routine {
  id: string;
  userId: string;
  title: string;
  description?: string;
  triggerType: 'manual' | 'time' | 'location';
  triggerValue?: string;
  isActive: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

// Junction table for many-to-many habit-routine relationship
export interface HabitRoutine {
  id: string;
  habitId: string;
  routineId: string;
  orderIndex: number; // Order of habit within the routine
  createdAt: string;
}

// ============================================
// TASK MODELS
// ============================================

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date?: string | null;
  goal_id?: string | null;
  tags?: string[];
  metadata?: Record<string, any>; // For flexibility
  created_at: string;
  updated_at: string;
}

// ============================================
// USER SETTINGS
// ============================================

export interface UserSettings {
  id: string;
  userId: string; // Added for data isolation
  theme: 'light' | 'dark' | 'system';
  userName?: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
  showMotivationalQuotes: boolean;
  defaultCategory: Category;
  createdAt: string;
  // Gamification fields
  xp: number;
  level: number;
  gems: number;
  streakShield: number;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export type TimeRange = 'week' | 'month' | 'quarter' | 'year';

export interface DailyStats {
  date: string;
  completedHabits: number;
  totalHabits: number;
  completionRate: number;
}

export interface CategoryBreakdown {
  category: Category;
  count: number;
  percentage: number;
  completionRate: number;
}

export interface WeekdayStats {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  dayName: string;
  averageCompletionRate: number;
  totalCompletions: number;
}

export interface HeatmapData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4; // Intensity level for coloring
}

export interface Insight {
  id: string;
  type: 'achievement' | 'warning' | 'suggestion' | 'info';
  title: string;
  description: string;
  icon: string;
  relatedId?: string; // Optional link to habit or goal
  priority: number; // For sorting insights
}

// ============================================
// UI STATE TYPES
// ============================================

export interface ViewFilters {
  categories: Category[];
  showArchived: boolean;
  searchQuery: string;
}

export interface ModalState {
  isOpen: boolean;
  type: 'habit' | 'goal' | 'milestone' | 'settings' | 'confirm' | null;
  data?: unknown;
}

// ============================================
// FORM TYPES
// ============================================

export interface HabitFormData {
  name: string;
  category: Category;
  targetDaysPerWeek: number;
  icon?: string;
}

export interface GoalFormData {
  title: string;
  description?: string;
  areaOfLife: AreaOfLife;
  priority: Priority;
  startDate: string;
  deadline: string;
  milestones: string[]; // Just titles for initial creation
  isFocus?: boolean;
}

export interface MilestoneFormData {
  title: string;
  deadline?: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  priority: Priority;
  due_date?: string;
  goal_id?: string;
  tags?: string[];
}

// ============================================
// API / STORE RESPONSE TYPES
// ============================================

export interface StoreState<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
}

// ============================================
// CONSTANTS
// ============================================

export const CATEGORY_LABELS: Record<Category, string> = {
  health: 'Health',
  work: 'Work',
  learning: 'Learning',
  personal: 'Personal',
  finance: 'Finance',
  relationships: 'Relationships',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  health: 'Heart',
  work: 'Briefcase',
  learning: 'BookOpen',
  personal: 'User',
  finance: 'DollarSign',
  relationships: 'Users',
};

export const AREA_LABELS: Record<AreaOfLife, string> = {
  career: 'Career',
  health: 'Health',
  relationships: 'Relationships',
  personal_growth: 'Personal Growth',
  finance: 'Finance',
  fun: 'Fun & Recreation',
};

export const AREA_ICONS: Record<AreaOfLife, string> = {
  career: 'Briefcase',
  health: 'Heart',
  relationships: 'Users',
  personal_growth: 'Sparkles',
  finance: 'TrendingUp',
  fun: 'Smile',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

export const STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
};

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAYS_OF_WEEK_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Streak milestones for special styling
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 100, 365] as const;
