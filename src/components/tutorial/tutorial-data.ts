import {
  BarChart3, CheckSquare, Dumbbell, Keyboard, LayoutDashboard, ListTodo, Settings, Sparkles, Target, Wallet, type LucideIcon,
} from 'lucide-react';

export interface HelpCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Overview & workspace', icon: LayoutDashboard, color: 'text-primary bg-primary/10' },
  { id: 'habits', title: 'Habits System', subtitle: 'Streaks & freeze protections', icon: CheckSquare, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'tasks', title: 'Task Manager', subtitle: 'Priorities & Eisenhower matrix', icon: ListTodo, color: 'text-sky-500 bg-sky-500/10' },
  { id: 'goals', title: 'Goals & Milestones', subtitle: '90-day targets & SMART AI', icon: Target, color: 'text-rose-500 bg-rose-500/10' },
  { id: 'fitness', title: 'Fitness Hub', subtitle: 'Workouts, macros & body trends', icon: Dumbbell, color: 'text-amber-500 bg-amber-500/10' },
  { id: 'finance', title: 'Finance Hub', subtitle: 'Burn pace, accounts & debt', icon: Wallet, color: 'text-emerald-600 bg-emerald-600/10' },
  { id: 'analytics', title: 'Analytics', subtitle: 'Consistency charts & trends', icon: BarChart3, color: 'text-teal-500 bg-teal-500/10' },
  { id: 'ai-features', title: 'AI Assistant', subtitle: 'Smart coach recommendations', icon: Sparkles, color: 'text-indigo-500 bg-indigo-500/10' },
  { id: 'settings', title: 'Settings', subtitle: 'Preferences & data backups', icon: Settings, color: 'text-slate-500 bg-slate-500/10' },
];

export const SHORTCUT_CATEGORY: HelpCategory = {
  id: 'shortcuts',
  title: 'Keyboard Shortcuts',
  subtitle: 'Speed workflows',
  icon: Keyboard,
  color: 'text-orange-500 bg-orange-500/10',
};

export const CORE_SHORTCUT_KEYS = [
  { label: 'Quick Add Task', keyLabel: 'N' },
  { label: 'Command Menu', keyLabel: 'Ctrl+K' },
  { label: 'Toggle Shortcuts Menu', keyLabel: '?' },
];

export const NAV_SHORTCUT_KEYS = [
  { label: 'Dashboard', keyLabel: '1' },
  { label: 'Tasks', keyLabel: '2' },
  { label: 'Habits', keyLabel: '3' },
  { label: 'Fitness', keyLabel: '4' },
  { label: 'Goals', keyLabel: '5' },
  { label: 'Finance', keyLabel: '6' },
  { label: 'Analytics', keyLabel: '7' },
];
