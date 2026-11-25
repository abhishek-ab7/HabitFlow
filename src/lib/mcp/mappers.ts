/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Category,
  CommitmentCategory,
  CompletionStatus,
  CreditCardStatement,
  DebtBucketType,
  DebtDirection,
  DebtInstallment,
  DebtPaymentMethod,
  DebtRecord,
  DebtRepaymentSchedule,
  DebtStatus,
  DietPreference,
  EmiStatus,
  EmiTracker,
  FinanceAccount,
  FinanceAccountType,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringBill,
  FinanceSipPlan,
  FinanceTransaction,
  FinanceTransactionType,
  FitnessActivityLevel,
  FitnessDailyLog,
  FitnessGoalType,
  FitnessProfile,
  Habit,
  HabitAnchorBlock,
  HabitCompletion,
  HabitFrequencyType,
  HabitPolarity,
  MealLog,
  MealLogSource,
  MealTemplate,
  MealType,
  MonthlyCommitment,
  MoodLog,
  MoodType,
  SipAssetClass,
  StatementStatus,
  SupplementCategory,
  SupplementInventory,
  SupplementLog,
  WorkoutExercise,
  WorkoutSession,
  WorkoutType,
} from '@/lib/types';

function fallbackIsoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Maps a Supabase `finance_accounts` row (`snake_case`) into a `FinanceAccount`.
 */
export function mapFinanceAccountFromRow(r: Record<string, any>): FinanceAccount {
  const now = fallbackIsoTimestamp();
  const billingDay = r.billing_day ?? r.statement_day ?? undefined;
  const statementDay = r.statement_day ?? r.billing_day ?? undefined;

  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    name: String(r.name || ''),
    type: (r.type || 'bank') as FinanceAccountType,
    balance: Number(r.balance || 0),
    creditLimit:
      r.credit_limit !== null && r.credit_limit !== undefined
        ? Number(r.credit_limit)
        : undefined,
    billingDay: billingDay !== undefined && billingDay !== null ? Number(billingDay) : undefined,
    statementDay:
      statementDay !== undefined && statementDay !== null ? Number(statementDay) : undefined,
    dueDay: r.due_day !== null && r.due_day !== undefined ? Number(r.due_day) : undefined,
    gracePeriodDays:
      r.grace_period_days !== null && r.grace_period_days !== undefined
        ? Number(r.grace_period_days)
        : undefined,
    lastStatementCheckedAt: r.last_statement_checked_at || undefined,
    includeInNetWorth: r.include_in_net_worth !== false,
    currency: r.currency || 'INR',
    color: r.color || '#10b981',
    icon: r.icon || 'Wallet',
    isDefault: !!r.is_default,
    archived: !!r.is_archived,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `finance_categories` row (`snake_case`) into a `FinanceCategory`.
 */
export function mapFinanceCategoryFromRow(r: Record<string, any>): FinanceCategory {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    name: String(r.name || ''),
    slug: String(r.slug || ''),
    type: (r.type || 'expense') as 'expense' | 'income' | 'both',
    icon: r.icon || 'Tag',
    color: r.color || '#6B7280',
    monthlyBudgetLimit: Number(r.monthly_budget_limit || 0),
    rolloverEnabled: !!r.rollover_enabled,
    subcategories: Array.isArray(r.subcategories) ? r.subcategories : [],
    order: Number(r.order_index ?? 0),
    isSystem: !!r.is_system,
    archived: !!r.is_archived,
    deletedAt: r.deleted_at || (r.is_archived ? r.updated_at || now : null),
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `finance_transactions` row (`snake_case`) into a `FinanceTransaction`.
 */
export function mapFinanceTransactionFromRow(r: Record<string, any>): FinanceTransaction {
  const now = fallbackIsoTimestamp();
  const dateStr = String(r.date || '');
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    title: String(r.title || ''),
    merchantName: r.merchant_name ?? undefined,
    rawMerchant: r.raw_merchant ?? undefined,
    amount: Number(r.amount || 0),
    type: (r.type || 'expense') as FinanceTransactionType,
    categoryId: String(r.category_id || ''),
    subcategory: r.subcategory || undefined,
    accountId: String(r.account_id || ''),
    toAccountId: r.to_account_id || undefined,
    date: dateStr,
    monthKey: r.month_key || (dateStr ? dateStr.slice(0, 7) : ''),
    notes: r.notes || undefined,
    tags: Array.isArray(r.tags) ? r.tags : [],
    isRecurring: !!r.is_recurring,
    recurrenceRule: r.recurrence_rule || undefined,
    needsReview: !!r.needs_review,
    splitGroupId: r.split_group_id ?? null,
    linkedCommitmentId: r.linked_commitment_id || null,
    commitmentContributionType: r.commitment_contribution_type || null,
    linkedDebtId: r.linked_debt_id || null,
    linkedDebtInstallmentId: r.linked_debt_installment_id || null,
    linkedEmiId: r.linked_emi_id || null,
    linkedSipId: r.linked_sip_id || null,
    statementCycleKey: r.statement_cycle_key ?? null,
    paidStatementId: r.paid_statement_id ?? null,
    isCreditCardPayment: !!r.is_credit_card_payment,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `finance_budgets` row (`snake_case`) into a `FinanceBudget`.
 */
export function mapFinanceBudgetFromRow(r: Record<string, any>): FinanceBudget {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    monthKey: String(r.month_key || ''),
    totalBudget: Number(r.total_budget || 0),
    expectedIncome: Number(r.expected_income || 0),
    plannedSipAmount: Number(r.planned_sip_amount || 0),
    budgetMode: r.budget_mode === 'zero_based' ? 'zero_based' : 'cap',
    assignedIncome:
      r.assigned_income !== null && r.assigned_income !== undefined
        ? Number(r.assigned_income)
        : undefined,
    currency: r.currency || 'INR',
    notes: r.notes || undefined,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `monthly_commitments` row (`snake_case`) into a `MonthlyCommitment`.
 */
export function mapMonthlyCommitmentFromRow(r: Record<string, any>): MonthlyCommitment {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    title: String(r.title || ''),
    recipientName: String(r.recipient_name || ''),
    relationship: String(r.relationship || 'Family'),
    monthlyTargetAmount: Number(r.monthly_target_amount || 0),
    dueDayOfMonth: Number(r.due_day_of_month || 5),
    category: (r.category || 'family_support') as CommitmentCategory,
    defaultCategoryId: r.default_category_id || undefined,
    autoRolloverOverpayment: !!r.auto_rollover_overpayment,
    icon: r.icon || 'HeartHandshake',
    color: r.color || '#ec4899',
    isActive: r.is_active !== false,
    notes: r.notes || undefined,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `debt_records` row (`snake_case`) into a `DebtRecord`.
 */
export function mapDebtRecordFromRow(r: Record<string, any>): DebtRecord {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    personName: String(r.person_name || 'Friend'),
    contactInfo: r.contact_info || undefined,
    direction: (r.direction || 'lent') as DebtDirection,
    title: String(r.title || ''),
    principalAmount: Number(r.principal_amount || 0),
    totalRepaidAmount: Number(r.total_repaid_amount || 0),
    remainingAmount: Number(r.remaining_amount || 0),
    startDate: String(r.start_date || ''),
    targetSettlementDate: r.target_settlement_date || undefined,
    repaymentSchedule: (r.repayment_schedule || 'flexible') as DebtRepaymentSchedule,
    plannedMonthlyInstallment:
      r.planned_monthly_installment !== null && r.planned_monthly_installment !== undefined
        ? Number(r.planned_monthly_installment)
        : undefined,
    dueDayOfMonth:
      r.due_day_of_month !== null && r.due_day_of_month !== undefined
        ? Number(r.due_day_of_month)
        : undefined,
    status: (r.status || 'active') as DebtStatus,
    bucketType: (r.bucket_type || 'long_term_loan') as DebtBucketType,
    isEmi: !!r.is_emi,
    emiAmount:
      r.emi_amount !== null && r.emi_amount !== undefined ? Number(r.emi_amount) : undefined,
    emiDueDay:
      r.emi_due_day !== null && r.emi_due_day !== undefined
        ? Number(r.emi_due_day)
        : undefined,
    totalInstallments:
      r.total_installments !== null && r.total_installments !== undefined
        ? Number(r.total_installments)
        : undefined,
    paidInstallments: Number(r.paid_installments || 0),
    notes: r.notes || undefined,
    color: r.color || '#3b82f6',
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `debt_installments` row (`snake_case`) into a `DebtInstallment`.
 */
export function mapDebtInstallmentFromRow(r: Record<string, any>): DebtInstallment {
  const now = fallbackIsoTimestamp();
  const dateStr = String(r.date || '');
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    debtId: String(r.debt_id || ''),
    amount: Number(r.amount || 0),
    date: dateStr,
    monthKey: r.month_key || (dateStr ? dateStr.slice(0, 7) : ''),
    paymentMethod: (r.payment_method || 'upi') as DebtPaymentMethod,
    transactionId: r.transaction_id || null,
    note: r.note || undefined,
    balanceAfterPayment: Number(r.balance_after_payment || 0),
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `emi_trackers` row (`snake_case`) into an `EmiTracker`.
 */
export function mapEmiTrackerFromRow(r: Record<string, any>): EmiTracker {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    loanName: String(r.loan_name || ''),
    lenderName: String(r.lender_name || ''),
    principalAmount: Number(r.principal_amount || 0),
    interestRateAnnual: Number(r.interest_rate_annual || 0),
    emiAmount: Number(r.emi_amount || 0),
    tenureMonths: Number(r.tenure_months || 1),
    paidMonths: Number(r.paid_months || 0),
    startDate: String(r.start_date || ''),
    billingDayOfMonth: Number(r.billing_day_of_month || 5),
    categoryId: String(r.category_id || ''),
    accountId: r.account_id || undefined,
    autoCreateTaskReminder: !!r.auto_create_task_reminder,
    lastPaidMonthKey: r.last_paid_month_key || undefined,
    status: (r.status || 'active') as EmiStatus,
    notes: r.notes || undefined,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `finance_sip_plans` row (`snake_case`) into a `FinanceSipPlan`.
 */
export function mapFinanceSipPlanFromRow(r: Record<string, any>): FinanceSipPlan {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    name: String(r.name || ''),
    platform: r.platform || undefined,
    assetClass: (r.asset_class || 'equity_mf') as SipAssetClass,
    monthlyAmount: Number(r.monthly_amount || 0),
    sipDayOfMonth: Number(r.sip_day_of_month || 5),
    startDate: String(r.start_date || ''),
    totalInvested: Number(r.total_invested || 0),
    currentValue: Number(r.current_value || 0),
    expectedReturnAnnual:
      r.expected_return_annual !== null && r.expected_return_annual !== undefined
        ? Number(r.expected_return_annual)
        : undefined,
    accountId: r.account_id || undefined,
    categoryId: r.category_id || undefined,
    lastInvestedMonthKey: r.last_invested_month_key || undefined,
    isActive: r.is_active !== false,
    color: r.color || '#10b981',
    notes: r.notes || undefined,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `finance_recurring_bills` row (`snake_case`) into a `FinanceRecurringBill`.
 */
export function mapFinanceRecurringBillFromRow(r: Record<string, any>): FinanceRecurringBill {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    name: String(r.name || ''),
    amount: Number(r.amount || 0),
    previousAmount:
      r.previous_amount !== null && r.previous_amount !== undefined
        ? Number(r.previous_amount)
        : undefined,
    cadence: (r.cadence || 'monthly') as 'monthly' | 'quarterly' | 'yearly',
    dueDayOfMonth: Number(r.due_day_of_month || 5),
    categoryId: String(r.category_id || ''),
    accountId: r.account_id || undefined,
    autoLog: !!r.auto_log,
    lastPaidMonthKey: r.last_paid_month_key || undefined,
    isActive: r.is_active !== false,
    color: r.color || '#6366f1',
    icon: r.icon || 'Calendar',
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `credit_card_statements` row (`snake_case`) into a `CreditCardStatement`.
 */
export function mapCreditCardStatementFromRow(r: Record<string, any>): CreditCardStatement {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: r.user_id || undefined,
    accountId: String(r.account_id || ''),
    cycleKey: String(r.cycle_key || ''),
    periodStart: String(r.period_start || ''),
    periodEnd: String(r.period_end || ''),
    dueDate: String(r.due_date || ''),
    calculatedAmount: Number(r.calculated_amount || 0),
    manualAdjustment: Number(r.manual_adjustment ?? r.manualAdjustment ?? 0),
    totalDue: Number(r.total_due || 0),
    carriedForwardAmount: Number(r.carried_forward_amount || 0),
    paidAmount: Number(r.paid_amount || 0),
    remainingDue: Number(r.remaining_due || 0),
    status: (r.status || 'billed') as StatementStatus,
    paidAt: r.paid_at || null,
    notes: r.notes || undefined,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
    deletedAt: r.deleted_at || null,
  };
}

/**
 * Maps a Supabase `habits` row (`snake_case`) into a `Habit` suitable for streak/week calculations.
 */
export function mapHabitFromRow(r: Record<string, any>, fallbackDateIso?: string): Habit {
  const now = fallbackDateIso || fallbackIsoTimestamp();
  const targetDaysPerWeek = Number(r.target_days ?? 7);
  const frequencyType = (r.frequency_type ||
    (targetDaysPerWeek < 7 ? 'weekly_flexible' : 'daily')) as HabitFrequencyType;

  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    name: String(r.name || ''),
    category: (r.category || 'health') as Category,
    targetDaysPerWeek,
    frequencyType,
    scheduledDays: Array.isArray(r.scheduled_days) ? r.scheduled_days : undefined,
    intervalDays:
      r.interval_days !== null && r.interval_days !== undefined
        ? Number(r.interval_days)
        : undefined,
    allowBonusCompletions: r.allow_bonus_completions ?? undefined,
    autoTrackRule: r.auto_track_rule ?? undefined,
    polarity: (r.polarity || 'build') as HabitPolarity,
    anchorBlock: (r.anchor_block || undefined) as HabitAnchorBlock | undefined,
    isQuantitative: !!r.is_quantitative,
    targetValue:
      r.target_value !== null && r.target_value !== undefined
        ? Number(r.target_value)
        : undefined,
    unit: r.unit ?? undefined,
    metadata:
      r.metadata && typeof r.metadata === 'object' ? r.metadata : undefined,
    archived: !!r.is_archived,
    order: Number(r.order_index ?? 0),
    icon: r.icon || undefined,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * Maps a Supabase `completions` row (`snake_case`) into a `HabitCompletion`.
 */
export function mapHabitCompletionFromRow(
  r: Record<string, any>,
  fallbackUserId = ''
): HabitCompletion {
  return {
    id: String(r.id),
    userId: String(r.user_id || fallbackUserId),
    habitId: String(r.habit_id || ''),
    date: String(r.date || ''),
    completed: !!r.completed,
    skipped: r.skipped ?? undefined,
    status: (r.status || undefined) as CompletionStatus | undefined,
    restReason: r.rest_reason || undefined,
    note: r.notes || undefined,
    value: r.value !== null && r.value !== undefined ? Number(r.value) : undefined,
    createdAt: r.created_at || undefined,
    updatedAt: r.updated_at || undefined,
    generationCounter: Number(r.generation_counter || 1),
  };
}

/**
 * Maps a Supabase `mood_logs` row (`snake_case`) into a `MoodLog`.
 */
export function mapMoodLogFromRow(
  r: Record<string, any>,
  fallbackUserId = ''
): MoodLog {
  return {
    id: String(r.id),
    userId: String(r.user_id || fallbackUserId),
    date: String(r.date || '').slice(0, 10),
    mood: (r.mood || 'neutral') as MoodType,
    createdAt: r.created_at || undefined,
    updatedAt: r.updated_at || undefined,
    generationCounter: Number(r.generation_counter || 1),
  };
}

/**
 * 1. Maps a Supabase `fitness_profiles` row (`snake_case`) into a `FitnessProfile`.
 */
export function mapFitnessProfileFromRow(r: Record<string, any>): FitnessProfile {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    heightCm:
      r.height_cm !== null && r.height_cm !== undefined ? Number(r.height_cm) : null,
    currentWeightKg:
      r.current_weight_kg !== null && r.current_weight_kg !== undefined
        ? Number(r.current_weight_kg)
        : null,
    targetWeightKg:
      r.target_weight_kg !== null && r.target_weight_kg !== undefined
        ? Number(r.target_weight_kg)
        : null,
    startingWeightKg:
      r.starting_weight_kg !== null && r.starting_weight_kg !== undefined
        ? Number(r.starting_weight_kg)
        : null,
    targetWaistInches:
      r.target_waist_inches !== null && r.target_waist_inches !== undefined
        ? Number(r.target_waist_inches)
        : null,
    calorieTarget: Number(r.calorie_target ?? 2000),
    proteinTargetG: Number(r.protein_target_g ?? 130),
    carbsTargetG:
      r.carbs_target_g !== null && r.carbs_target_g !== undefined
        ? Number(r.carbs_target_g)
        : null,
    fatTargetG:
      r.fat_target_g !== null && r.fat_target_g !== undefined ? Number(r.fat_target_g) : null,
    waterTargetMl: Number(r.water_target_ml ?? 3000),
    stepsTarget: Number(r.steps_target ?? 8000),
    sleepTargetHours: Number(r.sleep_target_hours ?? 7.5),
    activityLevel: (r.activity_level || 'moderate') as FitnessActivityLevel,
    goalType: (r.goal_type || 'fat_loss') as FitnessGoalType,
    dietPreference: (r.diet_preference || 'non_veg') as DietPreference,
    gymScheduleDays: Array.isArray(r.gym_schedule_days)
      ? r.gym_schedule_days.map(Number)
      : [1, 2, 3, 4, 5, 6],
    lowEnergyCalorieCeiling:
      r.low_energy_calorie_ceiling !== null && r.low_energy_calorie_ceiling !== undefined
        ? Number(r.low_energy_calorie_ceiling)
        : null,
    lowEnergyStepsTarget:
      r.low_energy_steps_target !== null && r.low_energy_steps_target !== undefined
        ? Number(r.low_energy_steps_target)
        : 3500,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * 2. Maps a Supabase `fitness_daily_logs` row (`snake_case`) into a `FitnessDailyLog`.
 */
export function mapFitnessDailyLogFromRow(r: Record<string, any>): FitnessDailyLog {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    date: String(r.date || '').slice(0, 10),
    weightKg:
      r.weight_kg !== null && r.weight_kg !== undefined ? Number(r.weight_kg) : null,
    waistInches:
      r.waist_inches !== null && r.waist_inches !== undefined
        ? Number(r.waist_inches)
        : null,
    waterMl: Number(r.water_ml ?? 0),
    steps: Number(r.steps ?? 0),
    sleepHours:
      r.sleep_hours !== null && r.sleep_hours !== undefined ? Number(r.sleep_hours) : null,
    sleepQuality:
      r.sleep_quality !== null && r.sleep_quality !== undefined
        ? Number(r.sleep_quality)
        : null,
    energyLevel:
      r.energy_level !== null && r.energy_level !== undefined
        ? Number(r.energy_level)
        : null,
    sorenessLevel:
      r.soreness_level !== null && r.soreness_level !== undefined
        ? Number(r.soreness_level)
        : null,
    lowEnergyMode: !!r.low_energy_mode,
    junkFreeOverride: !!r.junk_free_override,
    restedHabitIds: Array.isArray(r.rested_habit_ids)
      ? r.rested_habit_ids.map(String)
      : [],
    notes: r.notes ?? null,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * 3. Maps a Supabase `meal_templates` row (`snake_case`) into a `MealTemplate`.
 */
export function mapMealTemplateFromRow(r: Record<string, any>): MealTemplate {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    name: String(r.name || ''),
    hindiAliases: Array.isArray(r.hindi_aliases) ? r.hindi_aliases.map(String) : [],
    calories: Number(r.calories ?? 0),
    proteinG: Number(r.protein_g ?? 0),
    carbsG: Number(r.carbs_g ?? 0),
    fatG: Number(r.fat_g ?? 0),
    fiberG: r.fiber_g !== null && r.fiber_g !== undefined ? Number(r.fiber_g) : null,
    servingLabel: String(r.serving_label || '1 serving'),
    mealType: (r.meal_type || null) as MealType | null,
    isJunk: !!r.is_junk,
    isPinned: r.is_pinned !== false,
    order: Number(r.order_index ?? 0),
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * 4. Maps a Supabase `meal_logs` row (`snake_case`) into a `MealLog`.
 */
export function mapMealLogFromRow(r: Record<string, any>): MealLog {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    date: String(r.date || '').slice(0, 10),
    mealType: (r.meal_type || 'snack') as MealType,
    name: String(r.name || ''),
    calories: Number(r.calories ?? 0),
    proteinG: Number(r.protein_g ?? 0),
    carbsG: Number(r.carbs_g ?? 0),
    fatG: Number(r.fat_g ?? 0),
    fiberG: r.fiber_g !== null && r.fiber_g !== undefined ? Number(r.fiber_g) : null,
    quantityMultiplier: Number(r.quantity_multiplier ?? 1),
    isJunk: !!r.is_junk,
    templateId: r.template_id ?? null,
    linkedTransactionId: r.linked_transaction_id ?? null,
    source: (r.source || 'manual') as MealLogSource,
    notes: r.notes ?? null,
    loggedAt: r.logged_at || r.created_at || now,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * 5. Maps a Supabase `workout_sessions` row (`snake_case`) into a `WorkoutSession`.
 */
export function mapWorkoutSessionFromRow(r: Record<string, any>): WorkoutSession {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    date: String(r.date || '').slice(0, 10),
    title: String(r.title || ''),
    workoutType: (r.workout_type || 'strength') as WorkoutType,
    durationMinutes: Number(r.duration_minutes ?? 0),
    estimatedCaloriesBurned:
      r.estimated_calories_burned !== null && r.estimated_calories_burned !== undefined
        ? Number(r.estimated_calories_burned)
        : null,
    exercises: Array.isArray(r.exercises) ? (r.exercises as WorkoutExercise[]) : [],
    rpe: r.rpe !== null && r.rpe !== undefined ? Number(r.rpe) : null,
    notes: r.notes ?? null,
    source: String(r.source || 'manual'),
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * 6. Maps a Supabase `supplement_inventory` row (`snake_case`) into a `SupplementInventory`.
 */
export function mapSupplementInventoryFromRow(r: Record<string, any>): SupplementInventory {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    name: String(r.name || ''),
    brand: r.brand ?? null,
    category: (r.category || 'other') as SupplementCategory,
    unitLabel: String(r.unit_label || 'scoop'),
    totalServings: Number(r.total_servings ?? 30),
    remainingServings: Number(r.remaining_servings ?? 30),
    dailyDosage: Number(r.daily_dosage ?? 1),
    costInr: Number(r.cost_inr ?? 0),
    proteinPerServingG:
      r.protein_per_serving_g !== null && r.protein_per_serving_g !== undefined
        ? Number(r.protein_per_serving_g)
        : null,
    manualAdjustment: Number(r.manual_adjustment ?? 0),
    anchorBlock: (r.anchor_block || null) as HabitAnchorBlock | null,
    lowStockThresholdDays: Number(r.low_stock_threshold_days ?? 7),
    linkedTransactionId: r.linked_transaction_id ?? null,
    lastRestockedAt: r.last_restocked_at ? String(r.last_restocked_at).slice(0, 10) : null,
    isActive: r.is_active !== false,
    notes: r.notes ?? null,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}

/**
 * 7. Maps a Supabase `supplement_logs` row (`snake_case`) into a `SupplementLog`.
 */
export function mapSupplementLogFromRow(r: Record<string, any>): SupplementLog {
  const now = fallbackIsoTimestamp();
  return {
    id: String(r.id),
    userId: String(r.user_id || ''),
    supplementId: String(r.supplement_id || ''),
    date: String(r.date || '').slice(0, 10),
    servingsTaken: Number(r.servings_taken ?? 1),
    takenAt: r.taken_at || r.created_at || now,
    notes: r.notes ?? null,
    deletedAt: r.deleted_at || null,
    generationCounter: Number(r.generation_counter || 1),
    createdAt: r.created_at || r.updated_at || now,
    updatedAt: r.updated_at || r.created_at || now,
  };
}
