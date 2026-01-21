// Design tokens for the Habit Tracker application
// These provide type-safe access to design system values

export const colors = {
  // Category colors for habits
  categories: {
    health: {
      bg: 'bg-category-health',
      text: 'text-category-health',
      border: 'border-category-health',
      hex: '#4ade80', // Reference for charts
    },
    work: {
      bg: 'bg-category-work',
      text: 'text-category-work',
      border: 'border-category-work',
      hex: '#818cf8',
    },
    learning: {
      bg: 'bg-category-learning',
      text: 'text-category-learning',
      border: 'border-category-learning',
      hex: '#fbbf24',
    },
    personal: {
      bg: 'bg-category-personal',
      text: 'text-category-personal',
      border: 'border-category-personal',
      hex: '#f472b6',
    },
    finance: {
      bg: 'bg-category-finance',
      text: 'text-category-finance',
      border: 'border-category-finance',
      hex: '#38bdf8',
    },
    relationships: {
      bg: 'bg-category-relationships',
      text: 'text-category-relationships',
      border: 'border-category-relationships',
      hex: '#fb923c',
    },
  },
  
  // Status colors for goals
  status: {
    not_started: {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      label: 'Not Started',
    },
    in_progress: {
      bg: 'bg-warning/20',
      text: 'text-warning',
      label: 'In Progress',
    },
    completed: {
      bg: 'bg-success/20',
      text: 'text-success',
      label: 'Completed',
    },
    on_hold: {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      label: 'On Hold',
    },
  },
  
  // Priority colors
  priority: {
    high: {
      bg: 'bg-destructive/20',
      text: 'text-destructive',
      icon: 'text-destructive',
    },
    medium: {
      bg: 'bg-warning/20',
      text: 'text-warning',
      icon: 'text-warning',
    },
    low: {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      icon: 'text-muted-foreground',
    },
  },
  
  // Completion rate color scale
  completionScale: {
    excellent: { min: 80, color: 'text-success', bg: 'bg-success/20' },
    good: { min: 60, color: 'text-chart-2', bg: 'bg-chart-2/20' },
    fair: { min: 40, color: 'text-warning', bg: 'bg-warning/20' },
    poor: { min: 0, color: 'text-destructive', bg: 'bg-destructive/20' },
  },
} as const;

export const spacing = {
  page: {
    padding: 'px-4 md:px-6 lg:px-8',
    maxWidth: 'max-w-7xl',
  },
  section: {
    gap: 'gap-6 md:gap-8',
    marginBottom: 'mb-8 md:mb-12',
  },
  card: {
    padding: 'p-4 md:p-6',
    gap: 'gap-4',
  },
} as const;

export const typography = {
  display: 'text-4xl md:text-5xl font-bold tracking-tight',
  h1: 'text-3xl md:text-4xl font-bold tracking-tight',
  h2: 'text-2xl md:text-3xl font-semibold',
  h3: 'text-xl md:text-2xl font-semibold',
  h4: 'text-lg font-semibold',
  body: 'text-base',
  small: 'text-sm',
  caption: 'text-xs text-muted-foreground',
  metric: 'text-3xl md:text-4xl font-bold tabular-nums',
  metricLarge: 'text-5xl md:text-6xl font-bold tabular-nums',
} as const;

export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  glow: {
    primary: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]',
    success: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
    warning: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',
  },
} as const;

export const borderRadius = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
} as const;

export const transitions = {
  fast: 'duration-150 ease-out',
  normal: 'duration-300 ease-out',
  slow: 'duration-500 ease-out',
  spring: 'duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
} as const;

// Animation presets for Framer Motion
export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 25,
  },
  springBouncy: {
    type: 'spring',
    stiffness: 500,
    damping: 15,
  },
  easeOut: {
    duration: 0.3,
    ease: [0.16, 1, 0.3, 1],
  },
} as const;

// Stagger configuration for list animations
export const stagger = {
  fast: 0.03,
  normal: 0.05,
  slow: 0.1,
} as const;

// Chart configuration
export const chartConfig = {
  colors: [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ],
  categoryColors: {
    health: '#4ade80',
    work: '#818cf8',
    learning: '#fbbf24',
    personal: '#f472b6',
    finance: '#38bdf8',
    relationships: '#fb923c',
  },
} as const;

// Helper function to get completion color based on percentage
export function getCompletionColor(percentage: number): {
  color: string;
  bg: string;
} {
  const { completionScale } = colors;
  if (percentage >= completionScale.excellent.min) {
    return { color: completionScale.excellent.color, bg: completionScale.excellent.bg };
  }
  if (percentage >= completionScale.good.min) {
    return { color: completionScale.good.color, bg: completionScale.good.bg };
  }
  if (percentage >= completionScale.fair.min) {
    return { color: completionScale.fair.color, bg: completionScale.fair.bg };
  }
  return { color: completionScale.poor.color, bg: completionScale.poor.bg };
}

// Time-based greeting
export function getTimeGreeting(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: 'Good Morning', emoji: '🌅' };
  if (hour < 17) return { greeting: 'Good Afternoon', emoji: '☀️' };
  if (hour < 21) return { greeting: 'Good Evening', emoji: '🌆' };
  return { greeting: 'Good Night', emoji: '🌙' };
}

// Time-based gradient for hero section
export function getTimeGradient(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'from-slate-900 via-indigo-950 to-slate-900'; // Night
  if (hour < 12) return 'from-amber-50 via-orange-50 to-rose-50'; // Morning
  if (hour < 17) return 'from-sky-50 via-blue-50 to-indigo-50'; // Afternoon
  if (hour < 21) return 'from-orange-50 via-rose-50 to-purple-50'; // Evening
  return 'from-slate-900 via-indigo-950 to-slate-900'; // Night
}
