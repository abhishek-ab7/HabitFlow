# 🎨 UI Integration Guide - HabitFlow AI Features

Quick reference for adding AI features to your React components.

## 📋 Table of Contents
1. [Coach Widget (Dashboard)](#1-coach-widget-dashboard)
2. [Task Priority Badge (TaskCard)](#2-task-priority-badge-taskcard)
3. [Habit Suggestions Panel (Habits Page)](#3-habit-suggestions-panel-habits-page)
4. [Burnout Alert Banner (Dashboard)](#4-burnout-alert-banner-dashboard)
5. [Common Patterns](#common-patterns)

---

## 1. Coach Widget (Dashboard)

### Location
`src/components/dashboard/AICoachWidget.tsx` (create new)

### Component Code
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, Zap } from 'lucide-react';
import { useUserStore } from '@/lib/stores';
import { useTaskStore } from '@/lib/stores';
import { useHabitStore } from '@/lib/stores';

interface CoachBriefing {
  greeting: string;
  focus: string;
  quote: string;
  energyForecast?: 'low' | 'medium' | 'high';
  streaksAtRisk?: string[];
  quickWins?: string[];
}

export function AICoachWidget() {
  const [briefing, setBriefing] = useState<CoachBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useUserStore(state => state.user);
  const tasks = useTaskStore(state => state.tasks);
  const habits = useHabitStore(state => state.habits);
  const completions = useHabitStore(state => state.completions);

  useEffect(() => {
    async function fetchBriefing() {
      try {
        setLoading(true);
        
        const today = new Date().toISOString().split('T')[0];
        const todayCompletions = completions.filter(c => c.date === today);
        const unfinishedTasks = tasks.filter(t => t.status !== 'done').length;

        const response = await fetch('/api/ai/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userData: {
              userId: user?.id || 'anonymous',
              userName: user?.userName || 'Friend',
              level: user?.level || 1,
              xp: user?.xp || 0
            },
            context: {
              unfinishedTasks,
              todaysHabits: todayCompletions.length > 0 
                ? todayCompletions.map(c => habits.find(h => h.id === c.habitId)?.name).join(', ')
                : 'None yet',
              mode: 'briefing'
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load AI coach');
        }

        const data = await response.json();
        setBriefing(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBriefing();
  }, [user, tasks.length, completions.length]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Coach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Coach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI coach unavailable. {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!briefing) return null;

  const energyIcon = {
    low: '🔋',
    medium: '⚡',
    high: '🔥'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Coach
          {briefing.energyForecast && (
            <span className="ml-auto text-sm">
              {energyIcon[briefing.energyForecast]}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Greeting */}
        <div>
          <p className="text-lg font-medium">{briefing.greeting}</p>
        </div>

        {/* Focus Recommendation */}
        <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600 mt-1 flex-shrink-0" />
            <p className="text-sm">{briefing.focus}</p>
          </div>
        </div>

        {/* Streaks at Risk */}
        {briefing.streaksAtRisk && briefing.streaksAtRisk.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
            <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
              ⚠️ Streaks at Risk
            </p>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
              {briefing.streaksAtRisk.map((streak, i) => (
                <li key={i}>• {streak}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Wins */}
        {briefing.quickWins && briefing.quickWins.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Quick Wins
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {briefing.quickWins.map((win, i) => (
                <li key={i}>✓ {win}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Quote */}
        <div className="border-l-2 border-purple-500 pl-3">
          <p className="text-sm italic text-muted-foreground">
            "{briefing.quote}"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Integration
```typescript
// In src/app/page.tsx (Dashboard)
import { AICoachWidget } from '@/components/dashboard/AICoachWidget';

export default function Dashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <AICoachWidget /> {/* Add this */}
      {/* Other widgets... */}
    </div>
  );
}
```

---

## 2. Task Priority Badge (TaskCard)

### Location
`src/components/tasks/TaskCard.tsx` (modify existing)

### Add State & Fetch
```typescript
const [aiPriority, setAIPriority] = useState<{
  suggestedPriority: string;
  reasoning: string;
  urgencyScore: number;
} | null>(null);
const [loadingPriority, setLoadingPriority] = useState(false);

async function getAIPriority() {
  setLoadingPriority(true);
  try {
    const response = await fetch('/api/ai/prioritize-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          due_date: task.due_date,
          priority: task.priority,
          tags: task.tags
        },
        userContext: {
          activeGoals: goals, // Pass from props or store
          currentTime: new Date().toLocaleString()
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      setAIPriority(data);
      toast.success('AI priority calculated!');
    }
  } catch (error) {
    toast.error('Failed to get AI priority');
  } finally {
    setLoadingPriority(false);
  }
}
```

### Add UI Elements
```typescript
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// In the task card render:
<div className="flex items-center gap-2">
  {/* Existing priority badge */}
  <Badge variant={task.priority}>{task.priority}</Badge>

  {/* AI Priority Badge (if calculated) */}
  {aiPriority && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge 
            variant="outline" 
            className="flex items-center gap-1 border-purple-500"
          >
            <Sparkles className="h-3 w-3" />
            AI: {aiPriority.suggestedPriority}
            <span className="text-xs ml-1">({aiPriority.urgencyScore})</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{aiPriority.reasoning}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}

  {/* Get AI Priority Button */}
  {!aiPriority && (
    <Button
      size="sm"
      variant="ghost"
      onClick={getAIPriority}
      disabled={loadingPriority}
      className="h-6 px-2"
    >
      <Sparkles className="h-3 w-3 mr-1" />
      {loadingPriority ? 'Analyzing...' : 'Get AI Priority'}
    </Button>
  )}
</div>
```

---

## 3. Habit Suggestions Panel (Habits Page)

### Location
`src/components/habits/HabitSuggestions.tsx` (create new)

### Component Code
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus } from 'lucide-react';
import { useGoalStore, useHabitStore } from '@/lib/stores';

interface HabitRecommendation {
  habitName: string;
  category: string;
  reasoning: string;
  targetDaysPerWeek: number;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedImpact: 'low' | 'medium' | 'high';
}

export function HabitSuggestions() {
  const [recommendations, setRecommendations] = useState<HabitRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const goals = useGoalStore(state => state.goals.filter(g => !g.archived));
  const habits = useHabitStore(state => state.habits);

  async function fetchRecommendations() {
    if (goals.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/ai/recommend-habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals: goals.map(g => ({
            id: g.id,
            title: g.title,
            description: g.description,
            areaOfLife: g.areaOfLife
          })),
          currentHabits: habits.map(h => ({
            id: h.id,
            name: h.name,
            category: h.category
          })),
          userLevel: 8 // Get from user store
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecommendations();
  }, [goals.length, habits.length]);

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Create a goal to get AI habit suggestions!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          AI Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No new suggestions at this time.
          </p>
        ) : (
          recommendations.map((rec, index) => (
            <div 
              key={index}
              className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{rec.habitName}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rec.reasoning}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {rec.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {rec.targetDaysPerWeek}x/week
                </Badge>
                <Badge 
                  variant={rec.difficulty === 'easy' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {rec.difficulty}
                </Badge>
                <Badge
                  variant={rec.expectedImpact === 'high' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  Impact: {rec.expectedImpact}
                </Badge>
              </div>
            </div>
          ))
        )}

        {recommendations.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={fetchRecommendations}
            disabled={loading}
          >
            Refresh Suggestions
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Integration
```typescript
// In src/app/habits/page.tsx
import { HabitSuggestions } from '@/components/habits/HabitSuggestions';

export default function HabitsPage() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        {/* Existing habit list */}
      </div>
      <div>
        <HabitSuggestions /> {/* Add this */}
      </div>
    </div>
  );
}
```

---

## 4. Burnout Alert Banner (Dashboard)

### Location
`src/components/dashboard/BurnoutAlert.tsx` (create new)

### Component Code
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { useHabitStore, useTaskStore } from '@/lib/stores';

interface BurnoutCheck {
  burnoutRisk: 'low' | 'medium' | 'high';
  score: number;
  indicators: string[];
  recommendations: string[];
}

export function BurnoutAlert() {
  const [burnout, setBurnout] = useState<BurnoutCheck | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const habits = useHabitStore(state => state.habits);
  const completions = useHabitStore(state => state.completions);
  const tasks = useTaskStore(state => state.tasks);

  useEffect(() => {
    async function checkBurnout() {
      try {
        // Calculate completion rates (simplified - adjust to your calculation logic)
        const now = new Date();
        const last7Days = completions.filter(c => {
          const date = new Date(c.date);
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 7;
        });

        const last30Days = completions.filter(c => {
          const date = new Date(c.date);
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 30;
        });

        const response = await fetch('/api/ai/burnout-check', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': 'user-id' // Get from auth
          },
          body: JSON.stringify({
            completionRates: {
              last7Days: (last7Days.length / (habits.length * 7)) * 100,
              last30Days: (last30Days.length / (habits.length * 30)) * 100,
              previous7Days: 75 // Calculate actual previous week
            },
            streakData: habits.map(h => ({
              habitName: h.name,
              currentStreak: 5, // Calculate from completions
              consecutiveSkips: 0 // Calculate from completions
            })),
            taskVelocity: {
              current: tasks.filter(t => t.status === 'done').length,
              baseline: 15
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.burnoutRisk !== 'low') {
            setBurnout(data);
          }
        }
      } catch (error) {
        console.error('Failed to check burnout:', error);
      } finally {
        setLoading(false);
      }
    }

    checkBurnout();
  }, [habits.length, completions.length, tasks.length]);

  if (loading || !burnout || dismissed || burnout.burnoutRisk === 'low') {
    return null;
  }

  const alertVariant = burnout.burnoutRisk === 'high' ? 'destructive' : 'default';

  return (
    <Alert variant={alertVariant} className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>
          {burnout.burnoutRisk === 'high' ? '🔥 High Burnout Risk' : '⚠️ Burnout Warning'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <div>
          <p className="font-medium text-sm">Warning Signs:</p>
          <ul className="text-sm list-disc pl-5 space-y-1 mt-1">
            {burnout.indicators.map((indicator, i) => (
              <li key={i}>{indicator}</li>
            ))}
          </ul>
        </div>
        
        <div>
          <p className="font-medium text-sm">Recommendations:</p>
          <ul className="text-sm list-disc pl-5 space-y-1 mt-1">
            {burnout.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>

        <Button 
          size="sm" 
          variant={burnout.burnoutRisk === 'high' ? 'secondary' : 'outline'}
          className="mt-2"
        >
          Enter Recovery Mode
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

### Integration
```typescript
// In src/app/page.tsx (Dashboard)
import { BurnoutAlert } from '@/components/dashboard/BurnoutAlert';

export default function Dashboard() {
  return (
    <div>
      <BurnoutAlert /> {/* Add this at the top */}
      
      <div className="grid gap-6">
        {/* Rest of dashboard */}
      </div>
    </div>
  );
}
```

---

## Common Patterns

### Error Handling
```typescript
try {
  const response = await fetch('/api/ai/...', { ... });
  
  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      toast.error('AI quota exceeded. Try again in a few minutes.');
    } else {
      toast.error(error.error || 'AI request failed');
    }
    return;
  }
  
  const data = await response.json();
  // Handle success
} catch (error) {
  toast.error('Network error. Please check your connection.');
}
```

### Loading States
```typescript
const [loading, setLoading] = useState(false);

// In UI:
{loading ? (
  <div className="animate-pulse">
    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-muted rounded w-full"></div>
  </div>
) : (
  // Actual content
)}
```

### Cache Invalidation
```typescript
// After user completes a task or habit:
// The cache will auto-invalidate based on user actions
// No manual invalidation needed - handled server-side
```

---

## 🎯 Quick Start Checklist

- [ ] Add AICoachWidget to dashboard
- [ ] Add AI Priority button to TaskCard
- [ ] Add HabitSuggestions panel to Habits page
- [ ] Add BurnoutAlert banner to dashboard
- [ ] Test with new API key
- [ ] Monitor cache performance in logs
- [ ] Adjust cache TTL based on usage patterns

---

**Need help?** Check the main docs in `AI_IMPLEMENTATION_SUMMARY.md`
