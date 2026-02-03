'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, Loader2, RefreshCw } from 'lucide-react';
import { useGoalStore } from '@/lib/stores/goal-store';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Category } from '@/lib/types';

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
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const { goals } = useGoalStore();
  const { habits, addHabit } = useHabitStore();
  const { level } = useGamificationStore();

  const activeGoals = goals.filter(g => !g.archived);

  async function fetchRecommendations() {
    if (activeGoals.length === 0 || !user) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai/recommend-habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals: activeGoals.map(g => ({
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
          userLevel: level
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch recommendations');
      }

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      console.error('Failed to fetch recommendations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecommendations();
  }, [activeGoals.length, habits.length]);

  const handleAddHabit = async (rec: HabitRecommendation) => {
    try {
      await addHabit({
        name: rec.habitName,
        category: rec.category.toLowerCase() as Category,
        targetDaysPerWeek: rec.targetDaysPerWeek
      });
      
      toast.success(`Added "${rec.habitName}" to your habits!`);
      
      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(r => r.habitName !== rec.habitName));
    } catch (error) {
      toast.error('Failed to add habit');
    }
  };

  if (activeGoals.length === 0) {
    return (
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Lightbulb className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Create a goal to get personalized habit suggestions!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <Lightbulb className="h-5 w-5 fill-current" />
          AI Suggestions
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchRecommendations()}
          disabled={loading}
          className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
        >
          <RefreshCw className={cn(
            'h-4 w-4 transition-transform',
            loading && 'animate-spin'
          )} />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {loading && recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">Analyzing your goals...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
              Unable to load suggestions
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRecommendations()}
              disabled={loading}
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No new suggestions right now. Keep crushing your current habits!
          </p>
        ) : (
          <>
            {recommendations.map((rec, index) => (
              <div 
                key={index}
                className="border rounded-lg p-3 space-y-2 bg-white/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{rec.habitName}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {rec.reasoning}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0 flex-shrink-0 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600"
                    onClick={() => handleAddHabit(rec)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {rec.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {rec.targetDaysPerWeek}x/week
                  </Badge>
                  <Badge 
                    variant={rec.difficulty === 'easy' ? 'default' : 'outline'}
                    className={cn(
                      'text-xs',
                      rec.difficulty === 'easy' && 'bg-green-500',
                      rec.difficulty === 'medium' && 'bg-amber-500',
                      rec.difficulty === 'hard' && 'bg-red-500'
                    )}
                  >
                    {rec.difficulty}
                  </Badge>
                  <Badge
                    variant={rec.expectedImpact === 'high' ? 'default' : 'outline'}
                    className={cn(
                      'text-xs',
                      rec.expectedImpact === 'high' && 'bg-purple-500',
                      rec.expectedImpact === 'medium' && 'bg-blue-500'
                    )}
                  >
                    {rec.expectedImpact} impact
                  </Badge>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
