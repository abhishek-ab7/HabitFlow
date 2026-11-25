export interface TourStep {
  target: string;
  title: string;
  content: string;
  benefit: string;
  placement?: 'top' | 'bottom' | 'center';
}

export interface PageTourConfig {
  tourKey: string;
  pageTitle: string;
  welcomeTitle: string;
  welcomeDescription: string;
  welcomeBenefit: string;
  steps: TourStep[];
}

export const PAGE_TOURS: Record<string, PageTourConfig> = {
  dashboard: {
    tourKey: 'dashboard',
    pageTitle: 'Dashboard',
    welcomeTitle: 'Welcome to HabitFlow! 🚀',
    welcomeDescription: 'HabitFlow is your calm personal Life OS for habits, tasks, goals, fitness, and finances. Let\'s take a short interactive walkthrough of your command center.',
    welcomeBenefit: 'Learn daily routines, momentum velocity, and quick action shortcuts in 30 seconds.',
    steps: [
      {
        target: 'body',
        title: 'Welcome to HabitFlow! 🚀',
        content: 'HabitFlow is your calm personal Life OS for habits, tasks, goals, fitness, and finances. Let\'s take a short interactive walkthrough of your workspace.',
        benefit: 'Complete this quick tour to learn streak protection, shortcut keys, and tabs.',
        placement: 'center',
      },
      {
        target: '.tour-hero-section',
        title: 'Dashboard Workspace 🏠',
        content: 'Your daily command center. View today\'s momentum score, active routines, financial burn rate, and habit checklists.',
        benefit: 'Consolidates all high-level life inputs into a single calm viewport.',
        placement: 'bottom',
      },
      {
        target: '.tour-momentum-card',
        title: 'Daily Progress & Streaks ⚡',
        content: 'Your Momentum Score updates live as you complete scheduled habits and tasks. Maintain consistency to power your weekly review.',
        benefit: 'Build lasting streaks while flexible rest days protect your recovery.',
        placement: 'bottom',
      },
      {
        target: '.tour-tasks-widget, .tour-today-focus',
        title: 'Today\'s Focus & Tasks 📋',
        content: 'Check off high-priority tasks scheduled for today or quickly capture one-off checklist items without navigating away.',
        benefit: 'Minimizes context switching and keeps focus locked on what matters most today.',
        placement: 'bottom',
      },
      {
        target: '.tour-habits-widget',
        title: 'Habit Routines & Streaks 🗓️',
        content: 'Log your daily habits right here on the dashboard. Click checkboxes to record completion or right-click to freeze.',
        benefit: 'One-click daily check-ins keep your consistency streak alive.',
        placement: 'bottom',
      },
      {
        target: '.tour-ai-coach-widget',
        title: 'AI Companion Coach 🧠',
        content: 'Dynamic, contextual insights and encouragement powered by local intelligence, analyzing your consistency patterns.',
        benefit: 'Receives tailored nudges to tackle friction before streaks break.',
        placement: 'bottom',
      },
      {
        target: '.tour-nav-shortcuts',
        title: 'Keyboard Shortcuts ⌨️',
        content: 'Press ? anytime to open the keyboard shortcut guide. Use N for new tasks, S for command menu, and 1-7 to switch tabs.',
        benefit: 'Navigate and log in lightning speed without lifting your hands from the keyboard.',
        placement: 'bottom',
      },
    ],
  },

  habits: {
    tourKey: 'habits',
    pageTitle: 'Habits',
    welcomeTitle: 'Master Your Habits 🗓️',
    welcomeDescription: 'Consistency over perfection. Track binary or numeric habits, protect streaks with shields, and reflect in daily notes.',
    welcomeBenefit: 'Discover how Streak Shields and cell notes protect your consistency.',
    steps: [
      {
        target: 'body',
        title: 'Habits Consistency Engine 🗓️',
        content: 'Welcome to your Habits matrix. Track daily practices, protect hard-earned streaks, and build sustainable atomic routines.',
        benefit: 'Sustainable habits are built through flexible consistency and streak protection.',
        placement: 'center',
      },
      {
        target: '.tour-habits-header',
        title: 'Habit Controls & Month Navigation 📅',
        content: 'Navigate between months to inspect historical consistency, filter by life category (Health, Work, Learning, etc.), or trigger AI habit suggestions.',
        benefit: 'Review long-term trends and focus on specific areas of life.',
        placement: 'bottom',
      },
      {
        target: '.tour-habits-grid',
        title: 'Daily Consistency Grid 🟩',
        content: 'Each row is a habit and each column is a day. Click any cell to toggle completion. For numeric habits, enter your exact metrics.',
        benefit: 'Visual heatmaps make your daily consistency instantly apparent.',
        placement: 'bottom',
      },
      {
        target: '.tour-habits-grid',
        title: 'Streak Freeze & Streak Shields ❄️',
        content: 'Right-click a cell (or tap dropdown on mobile) to freeze a habit when you are ill or traveling. You get 1 free freeze per week; extra freezes consume Streak Shields.',
        benefit: 'Streak Shields prevent guilt and maintain motivation without resetting your streak to 0.',
        placement: 'bottom',
      },
      {
        target: '.tour-habits-grid',
        title: 'Qualitative Notes & Reflections 📝',
        content: 'Hover over any cell and click the pencil icon to log qualitative notes, thoughts, or journal entries. Saved notes appear as subtle cell badges.',
        benefit: 'Capture context behind your habits to understand what drives your best days.',
        placement: 'bottom',
      },
      {
        target: '.tour-add-habit-btn',
        title: 'Create & Stack Habits ➕',
        content: 'Add binary or measurable habits, configure target days per week, and use AI scaffolding or anchor blocks for habit stacking.',
        benefit: 'Anchor new habits to existing triggers for effortless adoption.',
        placement: 'bottom',
      },
    ],
  },

  tasks: {
    tourKey: 'tasks',
    pageTitle: 'Tasks',
    welcomeTitle: 'Prioritize & Execute 📋',
    welcomeDescription: 'Clear your mental RAM. Manage deadlines, organize with Eisenhower quadrants, and parse dates with natural language.',
    welcomeBenefit: 'Master the Eisenhower matrix and natural language capture in 30 seconds.',
    steps: [
      {
        target: 'body',
        title: 'Tasks & Eisenhower Matrix 📋',
        content: 'Welcome to your task workspace! From quick capture to high-leverage prioritization, streamline everything on your plate.',
        benefit: 'Eliminate overwhelm with structured priority sorting.',
        placement: 'center',
      },
      {
        target: '.tour-task-input',
        title: 'Smart Natural Language Capture ⚡',
        content: 'Type tasks naturally, including dates and priorities: "Submit tax report tomorrow 5pm !high" or "Review PR Friday". The parser does the rest!',
        benefit: 'Zero friction capture lets you record tasks as quickly as you think of them.',
        placement: 'bottom',
      },
      {
        target: '.tour-task-views',
        title: 'List vs Eisenhower Matrix View 🔲',
        content: 'Toggle between standard list view and the 4-quadrant Eisenhower Matrix (Do, Schedule, Delegate, Delete) to focus on high-impact work.',
        benefit: 'Differentiates urgent noise from truly important life priorities.',
        placement: 'bottom',
      },
      {
        target: '.tour-task-list',
        title: 'Priority Filtering & Checklists ✅',
        content: 'Filter by priority (High, Medium, Low), view due date countdowns, and check off completed items with satisfying sensory haptics.',
        benefit: 'High-priority items automatically surface on your dashboard Today\'s Focus.',
        placement: 'bottom',
      },
    ],
  },

  goals: {
    tourKey: 'goals',
    pageTitle: 'Goals',
    welcomeTitle: '90-Day Vision & Milestones 🎯',
    welcomeDescription: 'Turn vague dreams into concrete reality. Set 90-day targets, break them into milestones, and audit them with SMART AI.',
    welcomeBenefit: 'Learn how to scaffold milestones and measure goal completion velocity.',
    steps: [
      {
        target: 'body',
        title: 'Goals & 90-Day Horizons 🎯',
        content: 'Welcome to Goals! 90-day execution sprints bridge the gap between daily routines and multi-year aspirations.',
        benefit: 'Focused 90-day quarters keep motivation high and targets achievable.',
        placement: 'center',
      },
      {
        target: '.tour-goals-header',
        title: 'Goal Horizons & Categories 🏆',
        content: 'Organize goals across life domains: Career, Health, Finance, Learning, or Personal. Track active vs completed targets.',
        benefit: 'Maintains balanced progress across all areas of your life.',
        placement: 'bottom',
      },
      {
        target: '.tour-goals-grid',
        title: 'Progress Bars & Milestone Checklists 📌',
        content: 'Every goal breaks down into 3-5 concrete milestones. As milestones are checked off, progress bars advance dynamically.',
        benefit: 'Visual milestone tracking prevents feeling overwhelmed by large targets.',
        placement: 'bottom',
      },
      {
        target: '.tour-add-goal-btn',
        title: 'SMART AI Goal Generator 🤖',
        content: 'Click New Goal to use the Gemini AI SMART generator. It scores specificity, measurability, and timelines to guarantee high-probability success.',
        benefit: 'Eliminates ambiguous goals that stall out before completion.',
        placement: 'bottom',
      },
    ],
  },

  finance: {
    tourKey: 'finance',
    pageTitle: 'Finance Hub',
    welcomeTitle: 'Master Your Personal Wealth 💰',
    welcomeDescription: 'Take total control of your money. Monitor Safe-to-Spend burn pace, reconcile credit cards, track recurring commitments, and split friend ledgers.',
    welcomeBenefit: 'Discover Safe-to-Spend burn rate, credit card cycles, and auto-capture.',
    steps: [
      {
        target: 'body',
        title: 'Personal Finance Hub 💰',
        content: 'Welcome to your private financial command center! Gain clarity on your real-time net worth, cash flow, and daily spending safe zones.',
        benefit: 'Calm, private financial management with zero third-party account linking required.',
        placement: 'center',
      },
      {
        target: '.tour-finance-tabs',
        title: 'Finance Modules Navigation 📑',
        content: 'Switch seamlessly between Overview (burn pace & net worth), Activity (transactions), Trackers (bills, EMIs, SIPs, debts), and Accounts (banks & cards).',
        benefit: 'Everything you need to master your money in one cohesive dashboard.',
        placement: 'bottom',
      },
      {
        target: '.tour-safe-to-spend',
        title: 'Safe-to-Spend & Daily Pace 📊',
        content: 'See your real daily discretionary allowance! The pace curve graphs your cumulative spending against an ideal budget burn curve.',
        benefit: 'Never be blindsided by month-end cash shortages again.',
        placement: 'bottom',
      },
      {
        target: '.tour-finance-trackers',
        title: 'Automated Trackers: Bills, EMIs & SIPs 💳',
        content: 'Manage recurring subscriptions with audit flags, monitor EMI loan payoffs, track monthly SIP investments, and keep a clean Friend Debt ledger.',
        benefit: 'Avoid missed due dates and stop paying for zombie subscriptions.',
        placement: 'bottom',
      },
      {
        target: '.tour-finance-sms',
        title: 'Privacy-First SMS Import & AI Query 💬',
        content: 'Import transaction SMS messages locally with zero cloud leakage, or ask questions in plain English via the Ask Finances AI Drawer.',
        benefit: 'Rapid bulk capture and instant natural language financial insights.',
        placement: 'bottom',
      },
    ],
  },

  fitness: {
    tourKey: 'fitness',
    pageTitle: 'Fitness Hub',
    welcomeTitle: 'Fuel Your Body & Performance 🏋️',
    welcomeDescription: 'Your personal athletic log. Track gym workouts, sets, reps & PRs, log fuel and macros, monitor body composition trends, and optimize supplements.',
    welcomeBenefit: 'Learn gym workout volume, macro tracking, and body composition analytics.',
    steps: [
      {
        target: 'body',
        title: 'Fitness & Physical OS 🏋️',
        content: 'Welcome to your physical command center! Build strength, dial in your nutrition, and track health markers with progressive overload principles.',
        benefit: 'Connect physical training with your daily habits and productivity.',
        placement: 'center',
      },
      {
        target: '.tour-fitness-tabs',
        title: 'Athletic Modules 🏃',
        content: 'Explore dedicated tabs: Workouts (gym logs & PRs), Fuel (nutrition & macros), Body (weight & fat trends), Supplements (daily stack & ROI), and Routines.',
        benefit: 'Comprehensive health monitoring without juggling 4 separate apps.',
        placement: 'bottom',
      },
      {
        target: '.tour-fitness-workouts, .tour-fitness-gym',
        title: 'Gym Logging & Personal Records 🏆',
        content: 'Record sets, reps, and weights for each exercise. The system calculates total workout volume and automatically celebrates Personal Records (PRs).',
        benefit: 'Enforces progressive overload to guarantee ongoing strength gains.',
        placement: 'bottom',
      },
      {
        target: '.tour-fitness-fuel',
        title: 'Fuel, Macros & Caloric Targets 🥗',
        content: 'Track calories, protein, carbs, and fats against your dynamic BMR/TDEE targets to ensure your nutrition aligns with your goals.',
        benefit: 'Dial in protein and energy balance for muscle gain or fat loss.',
        placement: 'bottom',
      },
      {
        target: '.tour-fitness-body',
        title: 'Body Composition & Trends 📈',
        content: 'Track weight, body fat %, and muscle mass over 7-day, 30-day, and 90-day moving averages to smooth out daily water weight fluctuations.',
        benefit: 'Focus on true long-term body trend lines rather than day-to-day noise.',
        placement: 'bottom',
      },
      {
        target: '.tour-fitness-supplements',
        title: 'Supplements Stack & Anti-Habits 💊',
        content: 'Manage your daily supplement dosages and timing, analyze cost/ROI, and track anti-habit triggers (like junk food or sleep leaks).',
        benefit: 'Streamlines your health stack and eliminates negative relapse triggers.',
        placement: 'bottom',
      },
    ],
  },
};
