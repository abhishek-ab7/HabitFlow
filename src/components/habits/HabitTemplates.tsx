import { cn } from '@/lib/utils';
import type { Category } from '@/lib/types';
import { 
  Sparkles, 
  Flame, 
  BookOpen, 
  Heart, 
  Briefcase, 
  DollarSign, 
  Users 
} from 'lucide-react';

export interface TemplateHabit {
  name: string;
  icon: string;
  category: Category;
  targetDaysPerWeek: number;
  isQuantitative: boolean;
  targetValue: number;
  unit: string;
  description: string;
}

const TEMPLATES: Record<string, { label: string; icon: any; items: TemplateHabit[] }> = {
  morning: {
    label: 'Morning Routine',
    icon: Sparkles,
    items: [
      { name: 'Drink Water', icon: '💧', category: 'health', targetDaysPerWeek: 7, isQuantitative: true, targetValue: 8, unit: 'glasses', description: 'Stay hydrated from early morning' },
      { name: 'Make Bed', icon: '🛏️', category: 'personal', targetDaysPerWeek: 7, isQuantitative: false, targetValue: 1, unit: 'time', description: 'Start your day with a quick win' },
      { name: 'Morning Meditation', icon: '🧘', category: 'health', targetDaysPerWeek: 7, isQuantitative: true, targetValue: 10, unit: 'minutes', description: 'Center your mind before the day begins' },
      { name: 'Journal', icon: '✍️', category: 'personal', targetDaysPerWeek: 7, isQuantitative: false, targetValue: 1, unit: 'entry', description: 'Write down thoughts or morning pages' },
    ]
  },
  fitness: {
    label: 'Fitness & Health',
    icon: Heart,
    items: [
      { name: 'Daily Walk', icon: '🚶‍♂️', category: 'health', targetDaysPerWeek: 7, isQuantitative: true, targetValue: 10000, unit: 'steps', description: 'Maintain active physical movement' },
      { name: 'Push-ups', icon: '💪', category: 'health', targetDaysPerWeek: 5, isQuantitative: true, targetValue: 50, unit: 'reps', description: 'Build daily core strength' },
      { name: 'Workout / Gym', icon: '🏋️‍♂️', category: 'health', targetDaysPerWeek: 4, isQuantitative: false, targetValue: 1, unit: 'session', description: 'Strength training or cardio routine' },
      { name: 'Hydration Target', icon: '🥛', category: 'health', targetDaysPerWeek: 7, isQuantitative: true, targetValue: 3, unit: 'liters', description: 'Meet daily fluid intake target' },
    ]
  },
  learning: {
    label: 'Learning & Mind',
    icon: BookOpen,
    items: [
      { name: 'Read Book', icon: '📚', category: 'learning', targetDaysPerWeek: 7, isQuantitative: true, targetValue: 20, unit: 'pages', description: 'Make consistent reading progress' },
      { name: 'LeetCode / DSA', icon: '💻', category: 'learning', targetDaysPerWeek: 5, isQuantitative: true, targetValue: 2, unit: 'problems', description: 'Solve algorithms daily' },
      { name: 'Learn Language', icon: '🗣️', category: 'learning', targetDaysPerWeek: 7, isQuantitative: true, targetValue: 15, unit: 'minutes', description: 'Practice vocabulary or speaking' },
    ]
  },
  productivity: {
    label: 'Productivity & Work',
    icon: Briefcase,
    items: [
      { name: 'Deep Work Block', icon: '⏱️', category: 'work', targetDaysPerWeek: 5, isQuantitative: true, targetValue: 2, unit: 'hours', description: 'Focus without notifications' },
      { name: 'Inbox Zero', icon: '📥', category: 'work', targetDaysPerWeek: 5, isQuantitative: false, targetValue: 1, unit: 'time', description: 'Keep emails clean and organized' },
      { name: 'Plan Next Day', icon: '📅', category: 'work', targetDaysPerWeek: 7, isQuantitative: false, targetValue: 1, unit: 'time', description: 'Structure tomorrow\'s targets tonight' },
    ]
  },
  finance: {
    label: 'Finance',
    icon: DollarSign,
    items: [
      { name: 'Track Expenses', icon: '💰', category: 'finance', targetDaysPerWeek: 7, isQuantitative: false, targetValue: 1, unit: 'time', description: 'Log expenditures daily' },
      { name: 'Cook at Home', icon: '🍳', category: 'finance', targetDaysPerWeek: 5, isQuantitative: true, targetValue: 2, unit: 'meals', description: 'Save money and eat healthier' },
    ]
  },
  relations: {
    label: 'Relationships',
    icon: Users,
    items: [
      { name: 'Call Family / Friend', icon: '📞', category: 'relationships', targetDaysPerWeek: 3, isQuantitative: false, targetValue: 1, unit: 'call', description: 'Maintain personal connections' },
      { name: 'Express Gratitude', icon: '🙏', category: 'relationships', targetDaysPerWeek: 7, isQuantitative: true, targetValue: 3, unit: 'things', description: 'Share or write down appreciation' },
    ]
  }
};

interface HabitTemplatesProps {
  onSelect: (template: TemplateHabit) => void;
}

export function HabitTemplates({ onSelect }: HabitTemplatesProps) {
  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide py-2">
      {Object.entries(TEMPLATES).map(([key, group]) => {
        const GroupIcon = group.icon;
        return (
          <div key={key} className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground/80 tracking-wide uppercase text-xs">
              <GroupIcon className="h-4 w-4" />
              {group.label}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.items.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card text-left transition-all hover:bg-muted/50 hover:border-primary/30 group"
                >
                  <span className="text-2xl mt-0.5 group-hover:scale-110 transition-transform">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground/90 line-clamp-1 mt-0.5">{item.description}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-muted text-[10px] rounded-md font-medium uppercase tracking-wider text-muted-foreground">
                        {item.category}
                      </span>
                      {item.isQuantitative ? (
                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] rounded-md font-medium">
                          {item.targetValue} {item.unit}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] rounded-md font-medium">
                          Binary Check
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
