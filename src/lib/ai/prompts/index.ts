// Prompt Templates for AI Features

import { getIstIsoDate } from '@/lib/mcp/config';
import type {
  CoachBriefingInput,
  TaskPriorityInput,
  HabitRecommendationInput,
  BurnoutCheckInput,
  SubtaskGenerationInput,
  MilestoneGenerationInput,
  HabitStackingInput,
  QuotePersonalizationInput,
  HabitDescriptionInput,
  ExpenseParseInput,
  ExpenseParseOutput,
} from '../types';

function getIstHour(): number {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  const parsed = parseInt(hourStr, 10);
  return Number.isNaN(parsed) ? 9 : parsed;
}

function formatCoachLists(context?: CoachBriefingInput['context']) {
  const habitsText = Array.isArray(context?.todaysHabits)
    ? context.todaysHabits.length > 0
      ? context.todaysHabits.join(', ')
      : 'No habits tracked yet'
    : context?.todaysHabits || 'No habits tracked yet';

  const tasksText = Array.isArray(context?.unfinishedTasks)
    ? context.unfinishedTasks.length > 0
      ? `${context.unfinishedTasks.length} pending (${context.unfinishedTasks.slice(0, 5).join(', ')})`
      : '0 pending'
    : String(context?.unfinishedTasks ?? 0);

  return { habitsText, tasksText };
}

function formatFitnessTelemetryBlock(ft?: NonNullable<CoachBriefingInput['context']>['fitnessTelemetry']): string {
  if (!ft) return '';
  const fmt = (v: number | null | undefined, suffix: string) =>
    v !== null && v !== undefined ? `${v}${suffix}` : 'n/a';
  const weightDelta =
    ft.rollingWeightDeltaKg !== null && ft.rollingWeightDeltaKg !== undefined
      ? ` (${ft.rollingWeightDeltaKg >= 0 ? '+' : ''}${ft.rollingWeightDeltaKg} kg 7d delta)`
      : '';
  const proteinTarget = ft.proteinTargetG ? ` / ${ft.proteinTargetG}g target` : '';
  const drag = ft.fatLossDragKg14d ? `, ~${ft.fatLossDragKg14d} kg fat-loss drag` : '';

  return `\n14-Day Fitness, Sleep & Junk Telemetry:
- Avg Sleep (14d): ${fmt(ft.avgSleepHours14d, ' hrs')} | Avg Energy: ${fmt(ft.avgEnergy14d, '/5')}
- Workouts (14d): ${ft.workouts14dCount ?? 0} | Avg Steps (14d): ${ft.avgSteps14d ?? 'n/a'}
- Rolling Weight: ${fmt(ft.rollingWeightKg, ' kg')}${weightDelta}
- Avg Protein (14d): ${fmt(ft.avgProtein14dG, 'g')}${proteinTarget}
- 14d Junk Spend & Empty Calories: ₹${ft.junkSpend14dInr ?? 0} (${ft.junkEmptyKcal14d ?? 0} kcal${drag})`;
}

function formatCrossDomainBlock(cd?: NonNullable<CoachBriefingInput['context']>['crossDomainInsights']): string {
  if (!cd) return '';
  const lines: string[] = [];
  if (cd.gymCostPerWorkoutInr) lines.push(`- Gym Cost/Workout (30d): ₹${cd.gymCostPerWorkoutInr}`);
  if (cd.primaryProteinCostPer25gInr) lines.push(`- Protein Cost/25g: ₹${cd.primaryProteinCostPer25gInr}`);
  if (cd.triggerMultiplier) {
    lines.push(`- Trigger Pattern: Junk/'idk' spend is ${cd.triggerMultiplier}x higher on ${cd.topTriggerLabel || 'low-recovery'} days`);
  }
  (cd.alerts || []).slice(0, 3).forEach((a) => lines.push(`- [${a.metricBadge || 'Alert'}] ${a.title}: ${a.description}`));
  return lines.length > 0 ? `\nCross-Domain Life OS Insights:\n${lines.join('\n')}` : '';
}

function buildCoachSuggestionPrompt(category?: string): string {
  return `You are an expert Habit Coach. The user wants to improve in the area of "${category || 'general productivity'}".
Suggest 3 small, atomic habits they could start today. 

Return a JSON object with:
- greeting: A motivational greeting
- focus: The main suggestion with the 3 habits explained
- quote: A relevant motivational quote

Be specific, actionable, and encouraging.`;
}

function getIstTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const istHour = getIstHour();
  if (istHour < 12) return 'morning';
  return istHour < 18 ? 'afternoon' : 'evening';
}

export function buildCoachPrompt(input: CoachBriefingInput): string {
  const { userData, context } = input;
  if (context?.mode === 'suggestion') return buildCoachSuggestionPrompt(context.category);

  const todayIst = context?.todayIso || getIstIsoDate();
  const timeOfDay = getIstTimeOfDay();
  const { habitsText, tasksText } = formatCoachLists(context);
  const deadlines = context?.upcomingDeadlines?.length
    ? `- Upcoming Deadlines: ${context.upcomingDeadlines.map((d) => `${d.title} (${d.daysLeft} days)`).join(', ')}`
    : '';

  return `You are an expert HabitFlow Life OS Coach for a user named "${userData?.userName || 'Friend'}". 
Your goal is to provide a concise, high-signal, motivating, and actionable daily briefing combining Habits, Tasks, Finance, and Fitness/Bio telemetry (currency INR ₹).

Current Context:
- Date (IST) & Time: ${todayIst} (${timeOfDay})
- Unfinished Tasks: ${tasksText}
- Today's Habits: ${habitsText}
${context?.burnoutRisk ? `- Burnout Risk: ${context.burnoutRisk}/100` : ''}
${context?.topPriorityTask ? `- Top Priority: ${context.topPriorityTask}` : ''}
${deadlines}${formatFitnessTelemetryBlock(context?.fitnessTelemetry)}${formatCrossDomainBlock(context?.crossDomainInsights)}

Instructions:
1. Start with a personalized greeting that acknowledges their momentum and time of day (${timeOfDay})
2. Give 1-2 ultra-specific, actionable Life OS moves referencing their actual numbers (sleep, protein/workouts, MIT tasks, or junk spend triggers if flagged)
3. End with a sharp motivational quote (not generic - tie it to their situation)
4. Set energyForecast ('low'/'medium'/'high'), streaksAtRisk (array), and quickWins (array) grounded in the context.

Be encouraging, grounded in telemetry, and honest.`;
}

export function buildPrioritizePrompt(input: TaskPriorityInput): string {
  const { task, userContext } = input;
  
  const daysUntilDue = task.due_date 
    ? Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return `You are a task prioritization expert. Analyze this task and recommend the optimal priority level.

Task Details:
- Title: ${task.title}
- Description: ${task.description || 'No description'}
- Current Priority: ${task.priority || 'not set'}
- Due Date: ${task.due_date || 'not set'}${daysUntilDue !== null ? ` (${daysUntilDue} days from now)` : ''}
- Tags: ${task.tags?.join(', ') || 'none'}

User Context:
- Current Time: ${userContext?.currentTime || new Date().toLocaleString()}
${userContext?.activeGoals?.length ? `- Active Goals: ${userContext.activeGoals.map(g => g.title).join(', ')}` : ''}
${userContext?.weekdayStats ? `- This weekday typically has ${userContext.weekdayStats}% completion rate` : ''}

Instructions:
Provide a priority recommendation with:
1. suggestedPriority: 'low', 'medium', or 'high'
2. reasoning: 2-3 sentences explaining why (consider urgency, importance, goal alignment)
3. urgencyScore: 0-100 (based on deadline proximity, dependencies, impact)
4. estimatedDuration: realistic time estimate (e.g., "30 minutes", "2 hours")
5. bestTimeSlot: when to do this (e.g., "Morning (high focus needed)", "Afternoon break")

Be practical and consider work-life balance. Don't over-prioritize everything.`;
}

export function buildHabitRecommendationPrompt(input: HabitRecommendationInput): string {
  const { goals, currentHabits, categoryPerformance } = input;

  return `You are a habit formation expert. Based on the user's goals and current habits, recommend 3-5 new atomic habits that will help them succeed.

User's Active Goals:
${goals.map(g => `- ${g.title} (${g.areaOfLife}): ${g.description || 'No description'}`).join('\n')}

Current Habits (${currentHabits.length} total):
${currentHabits.map(h => `- ${h.name} (${h.category})`).join('\n') || 'No habits yet'}

${categoryPerformance ? `Category Performance:\n${Object.entries(categoryPerformance).map(([cat, rate]) => `- ${cat}: ${rate}% completion rate`).join('\n')}` : ''}

Instructions:
Recommend 3-5 small, atomic habits that:
1. Directly support their goals
2. Fill gaps in their current routine
3. Are appropriate for their experience level (start small for beginners)
4. Can be realistically maintained

For each recommendation, provide:
- habitName: Clear, actionable name (e.g., "5-minute morning meditation")
- category: health, work, learning, personal, finance, or relationships
- reasoning: Why this habit will help (tie to specific goals)
- targetDaysPerWeek: 1-7 (be conservative - 3-5 is better than 7)
- difficulty: easy, medium, hard
- expectedImpact: low, medium, high
- stackWith: (optional) existing habit to pair with
- relatedGoals: array of goal IDs this supports

Prioritize keystone habits that create positive ripple effects.`;
}

export function buildBurnoutCheckPrompt(input: BurnoutCheckInput): string {
  const { completionRates, streakData, taskVelocity, xpGainRate } = input;

  const trendDirection = completionRates.last7Days > completionRates.previous7Days ? 'improving' : 'declining';
  const velocityChange = ((taskVelocity.current - taskVelocity.baseline) / taskVelocity.baseline * 100).toFixed(0);

  return `You are a burnout prevention expert for productivity app users. Analyze the user's recent patterns and assess their burnout risk.

Recent Performance Data:
- Last 7 days completion rate: ${completionRates.last7Days.toFixed(1)}%
- Previous 7 days completion rate: ${completionRates.previous7Days.toFixed(1)}%
- Last 30 days completion rate: ${completionRates.last30Days.toFixed(1)}%
- Trend: ${trendDirection}

Task Velocity:
- Current: ${taskVelocity.current} tasks/week
- Baseline average: ${taskVelocity.baseline} tasks/week
- Change: ${velocityChange}%

${xpGainRate ? `XP Gain Rate:\n- Current: ${xpGainRate.current} XP/day\n- Baseline: ${xpGainRate.baseline} XP/day\n- Change: ${((xpGainRate.current - xpGainRate.baseline) / xpGainRate.baseline * 100).toFixed(0)}%` : ''}

Streak Data:
${streakData.map(s => `- ${s.habitName}: ${s.currentStreak} day streak${s.consecutiveSkips > 0 ? `, ${s.consecutiveSkips} recent skips` : ''}`).join('\n')}

Instructions:
Assess burnout risk and provide:
1. burnoutRisk: 'low', 'medium', or 'high'
2. score: 0-100 (0 = no risk, 100 = severe burnout)
3. indicators: array of 2-5 specific warning signs you observed
4. recommendations: array of 3-5 actionable recovery steps
5. recoveryPlan: (optional) brief description of a 3-7 day recovery strategy

Scoring guidelines:
- Low (0-35): Normal fluctuations, sustainable pace
- Medium (36-65): Warning signs present, intervention recommended
- High (66-100): Clear burnout pattern, immediate rest needed

Be compassionate but direct. Burnout is serious - don't downplay it.`;
}

export function buildSubtaskPrompt(input: SubtaskGenerationInput): string {
  const { title, description } = input;

  return `Break down the following task into 3-5 actionable subtasks.

Task Title: ${title}
Task Description: ${description || 'No additional context provided'}

Instructions:
- Create 3-5 small, concrete subtasks
- Each subtask should be completable in one sitting
- Start each with an action verb (Research, Create, Review, etc.)
- Order them logically (what needs to happen first?)
- Be specific (not "Work on X" but "Draft X", "Review Y")

Return ONLY a JSON object with a "subtasks" array of strings.

Example good subtasks for "Build a website":
- "Research website builders and choose platform"
- "Create site structure and navigation plan"
- "Design homepage layout mockup"
- "Write homepage copy and content"
- "Set up hosting and deploy site"

Now generate subtasks for the given task.`;
}

// ========== Goal Milestone Generator ==========
export function buildMilestoneGenerationPrompt(input: MilestoneGenerationInput): string {
  const { goal, userContext } = input;
  const timelineMap = {
    aggressive: 'fast-paced with tight deadlines',
    balanced: 'moderate pace with realistic deadlines',
    relaxed: 'comfortable pace with flexible deadlines'
  };
  
  return `You are an expert Goal Planning AI. Break down the following goal into 4-7 actionable milestones.

**Goal Information:**
- Title: "${goal.title}"
- Description: ${goal.description || 'Not provided'}
- Deadline: ${goal.deadline}
- Area of Life: ${goal.areaOfLife}

**User Context:**
- Timeline Preference: ${timelineMap[userContext?.timelinePreference || 'balanced']}
- Existing Milestones: ${userContext?.currentMilestones || 0}

**Instructions:**
1. Create 4-7 specific, measurable milestones that lead to goal completion
2. Order them logically (milestone 1 should be the first step)
3. Assign realistic deadlines based on the goal deadline and timeline preference
4. Mark difficulty (easy = can complete in 1 week, medium = 2-3 weeks, hard = 4+ weeks)
5. Provide clear reasoning for each milestone
6. Ensure milestones follow SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)

**Example Milestone:**
{
  "title": "Research and document requirements",
  "description": "Spend 3-5 hours researching industry standards, competitor analysis, and create a requirements document",
  "difficulty": "easy",
  "orderIndex": 1,
  "estimatedTimeWeeks": 1,
  "suggestedDeadline": "2026-02-10",
  "reasoning": "Starting with research ensures we build on a solid foundation"
}

Return milestones in ascending order (1, 2, 3...). Set goalId to "${goal.id}".`;
}

// ========== Smart Habit Stacking ==========
export function buildHabitStackingPrompt(input: HabitStackingInput): string {
  const { existingHabits, userContext } = input;
  
  const habitList = existingHabits.map(h => 
    `- ${h.name} (${h.category}, ${h.completionRate}% success rate, ${h.currentStreak} day streak)`
  ).join('\n');
  
  return `You are a Behavioral Science expert specializing in habit formation and habit stacking.

**User's Current Habits:**
${habitList}

**User Context:**
- Available time slots: ${userContext?.availableTimeSlots?.join(', ') || 'Not specified'}
- Struggling with: ${userContext?.strugglingCategories?.join(', ') || 'None reported'}
- Top performing habits: ${userContext?.topPerformingHabits?.join(', ') || 'None yet'}

**Task:**
Suggest 2-4 "habit stacks" where the user can chain habits together for better success. Use the concept of "implementation intentions" and "habit stacking" from behavioral science.

**Habit Stacking Formula:**
After [EXISTING HABIT], I will [NEW HABIT SEQUENCE].

**Criteria:**
1. Choose a strong "trigger habit" (high completion rate, established streak)
2. Stack 2-3 related habits that naturally follow
3. Keep total time under 30 minutes per stack
4. Consider natural transitions (e.g., Morning routine: Wake up → Drink water → Meditate → Journal)
5. Suggest difficulty level and expected success rate
6. Provide actionable tips for implementation

**Example Stack:**
{
  "name": "Morning Wellness Stack",
  "description": "Build on your consistent water drinking habit to create a powerful morning routine",
  "triggerHabitId": "habit-123",
  "stackedHabitIds": ["habit-123", "habit-456", "habit-789"],
  "suggestedOrder": ["Drink water", "10-minute meditation", "5-minute journaling"],
  "reasoning": "Water drinking has 95% completion rate, making it ideal trigger. Meditation and journaling naturally follow when mind is fresh.",
  "difficulty": "easy",
  "estimatedTimeMinutes": 20,
  "expectedSuccessRate": 85
}

Return 2-4 stacks. Mark the topRecommendation with the stack name that has highest expected success.`;
}

// ========== Motivational Quote Personalizer ==========
export function buildQuotePersonalizationPrompt(input: QuotePersonalizationInput): string {
  const { userContext, context } = input;
  
  const moodContext = {
    struggling: "feeling overwhelmed or behind on goals",
    motivated: "riding a wave of momentum",
    accomplished: "celebrating a recent win",
    neutral: "maintaining steady progress"
  };
  
  return `You are a Motivational Psychology expert. Generate a deeply personalized, relevant motivational quote.

**User Context:**
- Name: ${userContext.userName}
- Current State: ${moodContext[userContext.currentMood || 'neutral']}
- Completed Habits Today: ${userContext.recentActivity?.completedHabitsToday || 0}
${userContext.recentActivity?.missedStreak ? '- Just broke a streak (needs encouragement)' : ''}
${userContext.recentActivity?.upcomingDeadline ? `- Approaching deadline: ${userContext.recentActivity.upcomingDeadline}` : ''}
${userContext.recentActivity?.recentWin ? `- Recent win: ${userContext.recentActivity.recentWin}` : ''}

**Active Goals:**
${userContext.goals?.map(g => `- ${g.title} (${g.progress}% complete)`).join('\n') || 'None set'}

**Context:** ${context || 'general'}

**Instructions:**
1. Generate a quote that speaks DIRECTLY to their current situation
2. Avoid generic platitudes - make it specific and relevant
3. If they're struggling, be empathetic but empowering
4. If they're winning, celebrate but challenge them to go further
5. Include attribution if it's a real quote, or mark as "Original"
6. Add a brief "actionable insight" - one small thing they can do right now
7. Rate relevance 1-10 (only give 8+ scores for truly personalized quotes)

**Examples of Good Personalization:**
- Struggling with streak: "The master has failed more times than the beginner has even tried. - Stephen McCranie. Your 47-day streak taught you discipline; today teaches you resilience."
- Approaching deadline: "Deadlines aren't walls, they're trampolines. You've got 3 days - that's enough to make meaningful progress on your MVP."

Return ONE primary quote with reasoning, plus 0-2 alternatives.`;
}

// ========== Smart Habit Descriptions ==========
export function buildHabitDescriptionPrompt(input: HabitDescriptionInput): string {
  const { habit, userGoals, generateTips } = input;
  
  return `You are a Health & Productivity expert. Write a compelling, scientifically-backed description for this habit.

**Habit Information:**
- Name: "${habit.name}"
- Category: ${habit.category}

**User's Active Goals:**
${userGoals?.map(g => `- ${g.title} (${g.areaOfLife})`).join('\n') || 'None provided'}

**Task:**
Create an inspiring yet informative habit description that:

1. **Description (2-3 sentences):**
   - Explain what the habit is and why it matters
   - Connect to user's goals if relevant
   - Make it personal and actionable

2. **Benefits (3-5 bullet points):**
   - List specific, evidence-based benefits
   - Mix short-term wins with long-term gains
   - Be concrete (e.g., "Reduces cortisol by 20%" not "Reduces stress")

3. **Tips for Success (3-5 bullet points):**
   - Practical, immediately actionable advice
   - Address common obstacles
   - Include "if-then" planning tips

4. **Assessment:**
   - Difficulty: beginner/intermediate/advanced
   - Time: realistic daily time commitment in minutes
   - Scientific backing: 1-sentence citation or principle

5. **Common Pitfalls (2-3 items):**
   - What typically goes wrong
   - How to avoid it

**Example Output:**
{
  "description": "A 10-minute morning meditation practice trains your attention and emotional regulation. Research shows it reduces anxiety by 30% and improves focus for 4+ hours. Since you're working toward 'Launch MVP,' this habit will help you make clearer decisions under pressure.",
  "benefits": [
    "Reduces anxiety and cortisol levels by 20-30% (Harvard Medical School)",
    "Improves focus and concentration for 4-6 hours post-practice",
    "Enhances emotional regulation and stress resilience",
    "Better sleep quality (reported by 65% of practitioners)"
  ],
  "tips": [
    "Start with just 2 minutes - consistency beats duration",
    "Use a guided app like Headspace for the first 2 weeks",
    "If thoughts intrude, label them 'thinking' and return to breath - this IS the practice",
    "Meditate right after your morning coffee (habit stacking)",
    "Track mood before/after to see personal benefits"
  ],
  "difficultyAssessment": "beginner",
  "estimatedTimeMinutes": 10,
  "scientificBacking": "Meta-analysis of 47 RCTs shows 8 weeks of meditation reduces anxiety by 30% (JAMA Internal Medicine, 2014)",
  "commonPitfalls": [
    "Expecting immediate results - benefits compound over weeks",
    "Judging yourself for 'bad' sessions - all practice counts",
    "Skipping when stressed - that's when you need it most"
  ]
}

  Make it inspiring, evidence-based, and actionable!`;
}

export function buildGoalAnalysisPrompt(goal: any): string {
  return `You are a SMART Goal Analysis expert. Evaluate the following goal against the SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound).

Goal details:
- Title: "${goal.title}"
- Description: "${goal.description || 'Not provided'}"
- Area of Life: "${goal.areaOfLife}"
- Priority: "${goal.priority}"
- Start Date: "${goal.startDate}"
- Deadline: "${goal.deadline}"

Instructions:
1. Specific: Evaluate if the goal is clear, well-defined, and unambiguous. Give a score (0-100) and actionable feedback.
2. Measurable: Evaluate if the goal has concrete criteria for measuring progress and completion. Give a score (0-100) and actionable feedback.
3. Achievable: Evaluate if the goal is realistic and attainable given ordinary human capacity. Give a score (0-100) and actionable feedback.
4. Relevant: Evaluate if the goal aligns with the area of life ("${goal.areaOfLife}"). Give a score (0-100) and actionable feedback.
5. Time-bound: Evaluate if the goal has a clear, well-defined timeframe and target completion date. Give a score (0-100) and actionable feedback.
6. Calculate an overall SMART Score (average of the 5 criteria).
7. Provide 3 concrete, specific recommendations to improve this goal definition and make it more SMART.

Return a JSON object matching the smartGoalAnalysisSchema.`;
}

// ========== FlowFinance Smart Expense Parser & Deterministic Fallback ==========
export function buildExpenseParsePrompt(input: ExpenseParseInput): string {
  const categoriesList =
    input.categories
      ?.map((c) => `- ${c.name} (slug: "${c.slug}", subcategories: ${c.subcategories.join(', ')})`)
      .join('\n') || 'Standard categories';

  const commitmentsList =
    input.commitments
      ?.map((c) => `- ID: "${c.id}", Recipient: "${c.recipientName}", Title: "${c.title}"`)
      .join('\n') || 'None';

  const debtsList =
    input.debts
      ?.map((d) => `- ID: "${d.id}", Person: "${d.personName}", Direction: ${d.direction}`)
      .join('\n') || 'None';

  return `You are an expert Personal Finance & Ledger AI for FlowFinance. Parse the following natural-language expense/income statement into a structured transaction object.

User Input: "${input.rawText}"

Available Categories:
${categoriesList}

Active Monthly Commitments (e.g. Mother's monthly allowance):
${commitmentsList}

Active Friend Lend/Borrow Records:
${debtsList}

Instructions:
1. Extract the exact numeric amount (in INR).
2. Create a clean, descriptive title.
3. Match the best categorySlug, categoryName, and subcategory.
4. Detect if this expense was bought/paid on behalf of a Monthly Commitment recipient (e.g., "for Mother", "for Mom", "deduct from mother"). If so, set matchedCommitmentId, matchedCommitmentRecipient, and commitmentContributionType ('offset_expense' for items/bills bought for them, or 'direct_payment' if transferring allowance directly).
5. Detect if this is a partial repayment or loan payment to/from a friend in Active Friend Lend/Borrow Records (e.g., "paid Rahul 500", "towards 2000 borrowed"). If so, set matchedDebtId and matchedDebtPerson.
6. Detect paymentMethodType ('upi', 'bank', 'cash', 'credit_card', 'wallet').
7. Return JSON matching expenseParseSchema.`;
}

const PAYMENT_METHOD_RULES: Array<[RegExp, ExpenseParseOutput['paymentMethodType']]> = [
  [/\bcash\b/, 'cash'],
  [/\b(credit card|card|cc|icici|amex)\b/, 'credit_card'],
  [/\b(neft|imps|rtgs|bank transfer|salary account)\b/, 'bank'],
  [/\b(paytm wallet|wallet)\b/, 'wallet'],
];

const CATEGORY_MATCH_RULES: Array<{
  pattern: RegExp;
  slug: string;
  name: string;
  getSubcategory: (lower: string, type: ExpenseParseOutput['type']) => string;
}> = [
  {
    pattern: /\b(whey|protein|creatine|vitamin|supplement|pharmacy|medicine|doctor|hospital|medical)\b/,
    slug: 'medical-supplements',
    name: 'Medical & Supplements',
    getSubcategory: (l) =>
      /\b(whey|protein)\b/.test(l) ? 'Whey / Protein' : /\b(vitamin|creatine)\b/.test(l) ? 'Vitamins & Creatine' : 'Pharmacy',
  },
  {
    pattern: /\b(electricity|water|wifi|wi-fi|broadband|recharge|bill|gas|utility)\b/,
    slug: 'utilities-bills',
    name: 'Utilities & Bills',
    getSubcategory: (l) =>
      /\belectricity\b/.test(l) ? 'Electricity Bill' : /\b(wifi|wi-fi|broadband)\b/.test(l) ? 'Wi-Fi / Broadband' : 'Mobile Recharge',
  },
  {
    pattern: /\b(lipstick|cosmetic|makeup|skincare|shirt|dress|clothing|shoes|nykaa|myntra|amazon)\b/,
    slug: 'shopping-personal-care',
    name: 'Shopping & Personal Care',
    getSubcategory: (l) => (/\b(lipstick|cosmetic|makeup|nykaa)\b/.test(l) ? 'Cosmetics / Lipstick' : 'Clothing'),
  },
  {
    pattern: /\b(grocery|groceries|vegetable|milk|dairy|fruit|supermarket|blinkit|zepto|instamart)\b/,
    slug: 'groceries-household',
    name: 'Groceries & Household',
    getSubcategory: () => 'Vegetables & Dairy',
  },
  {
    pattern: /\b(food|dinner|lunch|breakfast|coffee|cafe|restaurant|swiggy|zomato|pizza|burger)\b/,
    slug: 'food-dining',
    name: 'Food & Dining',
    getSubcategory: () => 'Restaurants',
  },
  {
    pattern: /\b(uber|ola|auto|cab|petrol|fuel|metro|train|bus|flight)\b/,
    slug: 'transport-fuel',
    name: 'Transport & Fuel',
    getSubcategory: () => 'Uber / Ola / Auto',
  },
  {
    pattern: /\b(emi|loan|borrowed|repay|repaid|installment|debt)\b/,
    slug: 'emis-debt-repayment',
    name: 'EMIs & Debt Repayment',
    getSubcategory: (l) => (/\b(emi|loan)\b/.test(l) ? 'Loan EMI' : 'Friend Debt Repayment'),
  },
  {
    pattern: /\b(allowance|mother|mom|parents|family|gift)\b/,
    slug: 'family-commitments',
    name: 'Family & Commitments',
    getSubcategory: () => 'Parental Allowance',
  },
  {
    pattern: /\b(netflix|spotify|gym|movie|ott|subscription)\b/,
    slug: 'entertainment-subscriptions',
    name: 'Entertainment & Subscriptions',
    getSubcategory: () => 'OTT & Streaming',
  },
  {
    pattern: /\b(sip|mutual fund|gold|investment|salary)\b/,
    slug: 'investments-savings',
    name: 'Investments & Savings',
    getSubcategory: (_l, t) => (t === 'income' ? 'Salary / Income' : 'SIP / Mutual Funds'),
  },
];

function matchesCommitmentName(lower: string, recipientName: string): boolean {
  const recLower = recipientName.toLowerCase();
  if (lower.includes(recLower)) return true;
  return recLower === 'mother' && /\b(mother|mom|mummy|maa|ammi)\b/.test(lower);
}

function isDirectCommitmentPayment(lower: string, categorySlug: string): boolean {
  if (categorySlug !== 'family-commitments') return false;
  if (lower.includes('deduct') || lower.includes('offset')) return false;
  return /\b(allowance|transfer|settle|direct|monthly support)\b/.test(lower);
}

function detectDeterministicCommitment(
  lower: string,
  categorySlug: string,
  commitments: NonNullable<ExpenseParseInput['commitments']>
) {
  const match = commitments.find((c) => matchesCommitmentName(lower, c.recipientName));
  if (!match) {
    return { matchedCommitmentId: null, matchedCommitmentRecipient: null, commitmentContributionType: null };
  }
  const isDirect = isDirectCommitmentPayment(lower, categorySlug);
  return {
    matchedCommitmentId: match.id,
    matchedCommitmentRecipient: match.recipientName,
    commitmentContributionType: (isDirect ? 'direct_payment' : 'offset_expense') as ExpenseParseOutput['commitmentContributionType'],
  };
}

function detectDeterministicDebt(
  lower: string,
  categorySlug: string,
  debts: NonNullable<ExpenseParseInput['debts']>
) {
  for (const debt of debts) {
    const firstName = debt.personName.split(' ')[0].toLowerCase();
    if (!firstName || !lower.includes(firstName)) continue;
    const isDebtRepay = categorySlug === 'shopping-personal-care' && /\b(paid|repay|installment|borrowed|lent|owe)\b/.test(lower);
    return { matchedDebtId: debt.id, matchedDebtPerson: debt.personName, overrideToDebtCategory: isDebtRepay };
  }
  return { matchedDebtId: null, matchedDebtPerson: null, overrideToDebtCategory: false };
}

function formatDeterministicExpenseTitle(text: string, fallbackCategoryName: string): string {
  const cleanTitle = text
    .replace(/^(paid|spent|bought|ordered|logged|sent|gave)\s+/i, '')
    .replace(/\b(via|by|using)\s+(upi|gpay|phonepe|cash|card|credit card|bank)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleanTitle.length > 0 ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : `${fallbackCategoryName} Expense`;
}

function buildDeterministicExpenseTags(
  categorySlug: string,
  comm: ReturnType<typeof detectDeterministicCommitment>,
  debt: ReturnType<typeof detectDeterministicDebt>
): string[] {
  const tags: string[] = [categorySlug.split('-')[0]];
  if (comm.matchedCommitmentRecipient) tags.push(comm.matchedCommitmentRecipient.toLowerCase(), 'offset');
  if (debt.matchedDebtPerson) tags.push(debt.matchedDebtPerson.split(' ')[0].toLowerCase(), 'debt');
  return tags;
}

export function parseExpenseDeterministically(input: ExpenseParseInput): ExpenseParseOutput {
  const text = (input.rawText || '').trim();
  const lower = text.toLowerCase();

  const amountMatches = text.match(/(?:₹|rs\.?|inr\s*)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/gi);
  const amount = amountMatches?.[0] ? parseInt(amountMatches[0].replace(/[₹,a-zA-Z.\s]/g, ''), 10) || 0 : 0;

  const paymentMethodType = PAYMENT_METHOD_RULES.find(([re]) => re.test(lower))?.[1] ?? 'upi';
  const type: ExpenseParseOutput['type'] = /\b(salary|received|credited|income|freelance|refund)\b/.test(lower) ? 'income' : 'expense';

  const catRule = CATEGORY_MATCH_RULES.find((r) => r.pattern.test(lower));
  let categorySlug = catRule?.slug ?? 'shopping-personal-care';
  let categoryName = catRule?.name ?? 'Shopping & Personal Care';
  let subcategory: string | undefined = catRule?.getSubcategory(lower, type);

  const comm = detectDeterministicCommitment(lower, categorySlug, input.commitments || []);
  const debt = detectDeterministicDebt(lower, categorySlug, input.debts || []);
  if (debt.overrideToDebtCategory) {
    categorySlug = 'emis-debt-repayment';
    categoryName = 'EMIs & Debt Repayment';
    subcategory = 'Friend Debt Repayment';
  }

  return {
    title: formatDeterministicExpenseTitle(text, categoryName),
    amount,
    type,
    categorySlug,
    categoryName,
    subcategory,
    paymentMethodType,
    ...comm,
    matchedDebtPerson: debt.matchedDebtPerson,
    matchedDebtId: debt.matchedDebtId,
    notes: text,
    tags: buildDeterministicExpenseTags(categorySlug, comm, debt),
    confidence: amount > 0 ? 94 : 60,
  };
}

