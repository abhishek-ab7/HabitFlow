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

export type HabitFrequencyType =
  | 'daily'
  | 'weekly_flexible'
  | 'specific_days'
  | 'interval';

export type HabitAutoTrackRule =
  | 'log_expense_today'
  | 'under_daily_safe_spend'
  | 'no_spend_day'
  | 'sip_completed_month';

export type AutoTrackHabitRule = HabitAutoTrackRule | 'none';

export interface Habit {
  id: string;
  userId: string; // Added for data isolation
  name: string;
  category: Category;
  targetDaysPerWeek: number; // 1-7
  frequencyType?: HabitFrequencyType;
  scheduledDays?: number[]; // 0 = Sun .. 6 = Sat (used when frequencyType === 'specific_days')
  intervalDays?: number; // e.g., 2 = every 2 days (used when frequencyType === 'interval')
  allowBonusCompletions?: boolean;
  weekStartsOn?: 0 | 1;
  autoTrackRule?: AutoTrackHabitRule;
  createdAt: string; // ISO date string or timestamp
  archived: boolean;
  archivedAt?: string; // ISO date string - when habit was archived/deleted
  updatedAt?: string; // ISO date string - last modification time
  order: number; // For drag-and-drop ordering
  icon?: string; // Optional emoji or icon name
  isQuantitative?: boolean;
  targetValue?: number;
  unit?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  metadata?: Record<string, any>;
  generationCounter?: number;
  isDirty?: boolean;
}

export type CompletionStatus = 'completed' | 'rest' | 'missed' | 'frozen';

export interface HabitCompletion {
  id: string;
  userId: string; // Added for data isolation
  habitId: string;
  date: string; // YYYY-MM-DD format
  completed: boolean; // Keep for backward compatibility
  status?: CompletionStatus; // Added for advanced states ('completed' | 'rest' | 'missed' | 'frozen')
  note?: string;
  skipped?: boolean; // Intentionally skipped (e.g., rest day)
  restReason?: string;
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp - for conflict resolution
  value?: number; // Added for quantitative habits
  generationCounter?: number;
  isDirty?: boolean;
}

export type MoodType = 'happy' | 'calm' | 'neutral' | 'sad' | 'stressed';

export interface MoodLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  mood: MoodType;
  createdAt?: string;
  updatedAt?: string;
  generationCounter?: number;
  isDirty?: boolean;
}

// Derived habit statistics
export interface HabitStats {
  habitId: string;
  currentStreak: number;
  bestStreak: number;
  weeklyStreak?: number;
  completionRate: number; // 0-100
  totalCompletions: number;
  totalDays: number;
  momentum: Trend; // Based on recent performance
  completedThisWeek?: number;
  targetThisWeek?: number;
  restDaysUsedThisWeek?: number;
  restDaysAllowedThisWeek?: number;
}

// ============================================
// GOAL MODELS
// ============================================

export type FinancialGoalLinkType =
  | 'savings_target'
  | 'debt_payoff'
  | 'net_worth'
  | 'sip_corpus';

export interface FinancialGoalLink {
  type: FinancialGoalLinkType;
  targetAmount: number;
  startingAmount?: number;
  linkedAccountIds?: string[];
  linkedDebtIds?: string[];
  linkedSipIds?: string[];
}

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
  updatedAt?: string; // ISO timestamp - for conflict resolution
  completedAt?: string;
  archived: boolean;
  financialLink?: FinancialGoalLink;
  metadata?: Record<string, any>;
  generationCounter?: number;
  isDirty?: boolean;
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
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp - for conflict resolution
  generationCounter?: number;
  isDirty?: boolean;
}

// Derived goal statistics
export interface GoalStats {
  goalId: string;
  progress: number; // 0-100, based on milestone completion or live financial balance
  milestonesCompleted: number;
  milestonesTotal: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  isOnTrack: boolean;
  projectedCompletion?: number; // Projected completion % by deadline
  currentFinancialAmount?: number;
  targetFinancialAmount?: number;
}



// ============================================
// TASK MODELS
// ============================================

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';

export interface Task {
  recurrenceRule?: string;
  estimatedTime?: number;
  actualTime?: number;
  isUrgent?: boolean;
  isImportant?: boolean;
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
  parentTaskId?: string | null; // For sub-tasks
  depth?: number; // Nesting level (0=root, 1=subtask, 2=sub-subtask, max 3)
  generationCounter?: number;
  isDirty?: boolean;
}

// ============================================
// USER SETTINGS & GAMIFICATION
// ============================================

export interface UserStats {
  vitality: number;      // from 'health'
  intelligence: number;  // from 'learning' and 'work'
  discipline: number;    // from overall consistency
  charisma: number;      // from 'relationships'
  wealth: number;        // from 'finance'
  creativity: number;    // from 'personal' and 'fun'
  focus?: number;
  resilience?: number;
}

export interface DashboardWidgetConfig {
  id: string;
  size: '1/4' | '1/2' | '2/3' | 'full';
  hidden?: boolean;
  pinned?: boolean;
}

export interface UserSettings {
  id: string;
  userId: string; // Added for data isolation
  theme: 'light' | 'dark' | 'system';
  userName?: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
  showMotivationalQuotes: boolean;
  defaultCategory: Category;
  createdAt: string;
  updatedAt?: string; // ISO timestamp - for conflict resolution
  // Gamification fields
  xp: number;
  level: number;
  gems: number;
  streakShield: number;
  avatarId?: string;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  stats?: UserStats;
  unlockedThemes?: string[];
  motivation_text?: string;
  dashboardLayout?: (string | DashboardWidgetConfig)[];
  // Workspace module toggles
  showTasks?: boolean;
  showGoals?: boolean;
  showMilestones?: boolean;
  showFinance?: boolean;
  habitOnlyMode?: boolean;
  generationCounter?: number;
  isDirty?: boolean;
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
  actionLabel?: string;
  actionHref?: string;
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
  frequencyType?: HabitFrequencyType;
  scheduledDays?: number[];
  intervalDays?: number;
  allowBonusCompletions?: boolean;
  autoTrackRule?: AutoTrackHabitRule;
  icon?: string;
  isQuantitative?: boolean;
  targetValue?: number;
  unit?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  metadata?: Record<string, any>;
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
  financialLink?: FinancialGoalLink;
}

export interface MilestoneFormData {
  title: string;
  deadline?: string;
}

export interface TaskFormData {
  recurrenceRule?: string;
  estimatedTime?: number;
  actualTime?: number;
  isUrgent?: boolean;
  isImportant?: boolean;
  title: string;
  description?: string;
  priority: Priority;
  due_date?: string;
  goal_id?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  parentTaskId?: string | null;
  depth?: number;
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

// ============================================
// FLOWFINANCE V2 - PERSONAL FINANCE & LEDGER MODELS
// ============================================

export type FinanceAccountType =
  | 'cash'
  | 'bank'
  | 'upi'
  | 'credit_card'
  | 'wallet'
  | 'investment';

export interface FinanceAccount {
  id: string;
  userId: string;
  name: string;
  type: FinanceAccountType;
  balance: number;
  creditLimit?: number; // For credit_card accounts
  statementDay?: number; // 1-31
  dueDay?: number; // 1-31
  includeInNetWorth?: boolean;
  currency: string;
  color: string;
  icon: string;
  isDefault: boolean;
  archived: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export type FinanceTransactionType = 'expense' | 'income' | 'transfer' | 'investment';

export interface FinanceCategory {
  id: string;
  userId: string;
  name: string;
  slug: string;
  type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
  monthlyBudgetLimit: number;
  rolloverEnabled?: boolean;
  subcategories: string[];
  order: number;
  isSystem: boolean;
  archived: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export type CommitmentContributionType = 'direct_payment' | 'offset_expense';

export interface FinanceTransaction {
  id: string;
  userId: string;
  title: string;
  merchantName?: string;
  rawMerchant?: string;
  amount: number;
  type: FinanceTransactionType;
  categoryId: string;
  subcategory?: string;
  accountId: string;
  toAccountId?: string;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  notes?: string;
  tags: string[];
  isRecurring: boolean;
  recurrenceRule?: string;
  needsReview?: boolean;
  splitGroupId?: string | null;
  // Cross-Linking to Monthly Commitments, Friend Debts, EMIs, or SIPs
  linkedCommitmentId?: string | null;
  commitmentContributionType?: CommitmentContributionType | null;
  linkedDebtId?: string | null;
  linkedDebtInstallmentId?: string | null;
  linkedEmiId?: string | null;
  linkedSipId?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export type FinanceBudgetMode = 'cap' | 'zero_based';

export interface FinanceBudget {
  id: string;
  userId: string;
  monthKey: string; // YYYY-MM
  totalBudget: number;
  expectedIncome: number;
  plannedSipAmount?: number;
  budgetMode?: FinanceBudgetMode;
  assignedIncome?: number;
  currency: string;
  notes?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export interface FinanceNetWorthSnapshot {
  id: string;
  userId: string;
  monthKey: string; // YYYY-MM
  snapshotDate: string; // YYYY-MM-DD
  liquidAssets: number;
  investmentAssets: number;
  friendReceivables: number;
  totalAssets: number;
  creditCardLiabilities: number;
  emiRemainingPrincipal: number;
  friendPayables: number;
  totalLiabilities: number;
  netWorth: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export interface CashFlowForecastPoint {
  dayOffset: number;
  dateStr: string;
  label: string;
  projectedBalance: number;
  scheduledInflow: number;
  scheduledOutflow: number;
  discretionaryBurn: number;
  events: string[];
}

export interface FinanceAnomalyAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  kind: 'category_spike' | 'idle_friend_debt' | 'review_backlog' | 'cash_crunch' | 'subscription_hike';
  title: string;
  description: string;
  amount?: number;
  actionLabel: string;
  actionTarget: 'activity' | 'trackers' | 'accounts' | 'budgets' | 'finance';
}

export type CommitmentCategory = 'family_support' | 'allowance' | 'shared_household' | 'rent' | 'other';

export interface MonthlyCommitment {
  id: string;
  userId: string;
  title: string;
  recipientName: string;
  relationship: string;
  monthlyTargetAmount: number;
  dueDayOfMonth: number; // 1-31
  category: CommitmentCategory;
  defaultCategoryId?: string;
  autoRolloverOverpayment: boolean;
  icon: string;
  color: string;
  isActive: boolean;
  notes?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export interface CommitmentLedgerSummary {
  commitment: MonthlyCommitment;
  monthKey: string;
  baseTargetAmount: number;
  rolloverFromPreviousMonth: number; // Positive if previous month was overpaid and autoRolloverOverpayment is true
  effectiveTargetAmount: number; // max(0, baseTargetAmount - rolloverFromPreviousMonth)
  directPaidAmount: number;
  offsetExpensesAmount: number;
  totalFulfilledAmount: number;
  remainingBalance: number;
  overpaidAmount: number;
  progressPercentage: number;
  status: 'unpaid' | 'in_progress' | 'settled' | 'overpaid';
  transactions: FinanceTransaction[];
  directTransactions: FinanceTransaction[];
  offsetTransactions: FinanceTransaction[];
}

export type DebtDirection = 'borrowed' | 'lent';
export type DebtRepaymentSchedule = 'monthly_partial' | 'lump_sum' | 'flexible';
export type DebtStatus = 'active' | 'settled' | 'archived';

export interface DebtRecord {
  id: string;
  userId: string;
  personName: string;
  contactInfo?: string;
  direction: DebtDirection; // 'borrowed' = I owe them; 'lent' = They owe me
  title: string;
  principalAmount: number;
  totalRepaidAmount: number;
  remainingAmount: number;
  startDate: string;
  targetSettlementDate?: string;
  repaymentSchedule: DebtRepaymentSchedule;
  plannedMonthlyInstallment?: number;
  dueDayOfMonth?: number;
  status: DebtStatus;
  notes?: string;
  color: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export type DebtPaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'offset_expense';

export interface DebtInstallment {
  id: string;
  userId: string;
  debtId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  paymentMethod: DebtPaymentMethod;
  transactionId?: string | null;
  note?: string;
  balanceAfterPayment: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export type EmiStatus = 'active' | 'completed' | 'foreclosed';

export interface EmiTracker {
  id: string;
  userId: string;
  loanName: string;
  lenderName: string;
  principalAmount: number;
  interestRateAnnual: number;
  emiAmount: number;
  tenureMonths: number;
  paidMonths: number;
  startDate: string; // YYYY-MM-DD
  billingDayOfMonth: number; // 1-31
  categoryId: string;
  accountId?: string;
  autoCreateTaskReminder: boolean;
  lastPaidMonthKey?: string;
  status: EmiStatus;
  notes?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export type SipAssetClass = 'equity_mf' | 'debt_mf' | 'stocks' | 'gold' | 'fd_rd' | 'crypto' | 'other';

export interface FinanceSipPlan {
  id: string;
  userId: string;
  name: string;
  platform?: string; // e.g., Groww, Zerodha Coin, Kuvera
  assetClass: SipAssetClass;
  monthlyAmount: number;
  sipDayOfMonth: number; // 1-31
  startDate: string;
  totalInvested: number;
  currentValue: number;
  expectedReturnAnnual?: number;
  accountId?: string;
  categoryId?: string;
  lastInvestedMonthKey?: string;
  isActive: boolean;
  color: string;
  notes?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export interface FinanceCategorizationRule {
  id: string;
  userId: string;
  matchPattern: string;
  cleanMerchantName: string;
  categoryId: string;
  subcategory?: string;
  defaultTags?: string[];
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export interface FinanceRecurringBill {
  id: string;
  userId: string;
  name: string;
  amount: number;
  previousAmount?: number;
  cadence: 'monthly' | 'quarterly' | 'yearly';
  dueDayOfMonth: number;
  categoryId: string;
  accountId?: string;
  autoLog: boolean;
  lastPaidMonthKey?: string;
  isActive: boolean;
  color: string;
  icon: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  generationCounter?: number;
  isDirty?: boolean;
}

export interface CategorySpendItem {
  category: FinanceCategory;
  spent: number;
  budgetLimit: number;
  baseBudgetLimit?: number;
  rolloverAmount?: number;
  percentageOfBudget: number;
  percentageOfTotalSpend: number;
  transactionCount: number;
  status: 'safe' | 'warning' | 'exceeded';
  paceDiffPercentage?: number; // Positive means spending faster than day-of-month pace
}

export interface DailyPacePoint {
  day: number; // 1..31
  dateStr: string;
  cumulativeSpent: number | null; // null for future days in current month
  idealCumulativeBudget: number;
  lastMonthCumulativeSpent: number;
}

export interface NetWorthSummary {
  liquidAssets: number;
  investmentAssets: number;
  friendReceivables: number;
  totalAssets: number;
  creditCardLiabilities: number;
  emiRemainingPrincipal: number;
  friendPayables: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface MonthlyFinanceSummary {
  monthKey: string;
  totalIncome: number;
  totalSpent: number;
  totalInvested: number;
  monthlyBudget: number;
  expectedIncome: number;
  remainingUnpaidEmis: number;
  remainingUnpaidCommitments: number;
  plannedDebtInstallmentsDue: number;
  remainingUnpaidBills: number;
  remainingPlannedSips: number;
  safeToSpendMonthly: number;
  safeToSpendDaily: number;
  remainingDaysInMonth: number;
  dayOfMonthProgressPct: number;
  netSavings: number;
  savingsRate: number;
  needsReviewCount: number;
  categoryBreakdown: CategorySpendItem[];
}

export interface FinancialObligationItem {
  id: string;
  sourceId: string;
  type: 'emi' | 'commitment' | 'debt' | 'bill' | 'sip' | 'credit_card';
  title: string;
  subtitle: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  daysUntilDue: number;
  isOverdue: boolean;
  status: 'pending' | 'paid';
}

export interface FinanceTransactionFormData {
  title: string;
  merchantName?: string;
  rawMerchant?: string;
  amount: number;
  type: FinanceTransactionType;
  categoryId: string;
  subcategory?: string;
  accountId: string;
  toAccountId?: string;
  date: string;
  notes?: string;
  tags?: string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
  needsReview?: boolean;
  splitGroupId?: string | null;
  linkedCommitmentId?: string | null;
  commitmentContributionType?: CommitmentContributionType | null;
  linkedDebtId?: string | null;
  linkedEmiId?: string | null;
  linkedSipId?: string | null;
}

export interface FinanceFilterState {
  searchQuery: string;
  type: 'all' | FinanceTransactionType;
  categoryId: string | 'all';
  accountId: string | 'all';
  commitmentId: string | 'all';
  debtId: string | 'all';
  tag: string | 'all';
  needsReview: 'all' | 'only_review';
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}


