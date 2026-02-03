'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Quote, RefreshCw, ThumbsUp, ThumbsDown, Loader2, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { useHabitStore } from '@/lib/stores/habit-store';
import { useGoalStore } from '@/lib/stores/goal-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { PersonalizedQuote as QuoteType } from '@/lib/ai/types';

export function PersonalizedQuote() {
  const [quote, setQuote] = useState<QuoteType | null>(null);
  const [loading, setLoading] = useState(false);
  const [reaction, setReaction] = useState<'liked' | 'disliked' | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { completions } = useHabitStore();
  const { goals } = useGoalStore();
  const supabase = createClient();

  const fetchQuote = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayCompletions = completions.filter(c => c.date === today);
      
      const response = await fetch('/api/ai/personalize-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userContext: {
            userName: user.email?.split('@')[0] || 'Friend',
            currentMood: todayCompletions.length > 3 ? 'motivated' : todayCompletions.length === 0 ? 'struggling' : 'neutral',
            recentActivity: {
              completedHabitsToday: todayCompletions.length
            },
            goals: goals.filter(g => !g.archived).slice(0, 3).map(g => ({
              title: g.title,
              progress: 50 // Default progress value
            }))
          },
          context: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'general' : 'evening'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch quote');
      }
      
      const data = await response.json();
      const newQuote = data.primaryQuote;
      setQuote(newQuote);
      setReaction(null); // Reset reaction for new quote

      // Save quote to database
      try {
        const { data: savedQuote, error: saveError } = await (supabase
          .from('motivational_quotes') as any)
          .insert({
            user_id: user.id,
            quote_text: newQuote.quote,
            author: newQuote.author || null,
            context: newQuote.context,
            personalization_reason: newQuote.whyItMatters || null,
            actionable_insight: newQuote.actionableInsight || null,
            mood_alignment: todayCompletions.length > 3 ? 'motivated' : todayCompletions.length === 0 ? 'struggling' : 'neutral'
          })
          .select()
          .single();

        if (!saveError && savedQuote) {
          setQuoteId(savedQuote.id);
        }
      } catch (dbError) {
        console.error('Failed to save quote to database:', dbError);
        // Don't fail the whole operation if database save fails
      }
    } catch (error: any) {
      console.error('Quote error:', error);
      toast.error(error.message || 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchQuote();
    }
  }, [user]);

  const handleReaction = async (liked: boolean) => {
    if (!user || !quoteId) {
      setReaction(liked ? 'liked' : 'disliked');
      toast.success(liked ? '❤️ Glad you liked it!' : 'Thanks for the feedback');
      return;
    }

    setReaction(liked ? 'liked' : 'disliked');
    
    try {
      // Update the quote record with the reaction
      const { error } = await (supabase
        .from('motivational_quotes') as any)
        .update({ 
          user_reaction: liked ? 'liked' : 'disliked',
          reacted_at: new Date().toISOString()
        })
        .eq('id', quoteId);

      if (error) {
        console.error('Failed to save reaction:', error);
      }

      toast.success(liked ? '❤️ Glad you liked it!' : 'Thanks for the feedback');
    } catch (error) {
      console.error('Error saving reaction:', error);
      toast.success(liked ? '❤️ Glad you liked it!' : 'Thanks for the feedback');
    }
  };

  if (!user) return null;

  if (loading && !quote) {
    return (
      <Card className="border-indigo-500/20 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="ml-2 text-sm text-muted-foreground">Finding the perfect quote...</span>
        </CardContent>
      </Card>
    );
  }

  if (!quote) return null;

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 mb-6">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-start gap-3">
          <Quote className="h-5 w-5 text-indigo-500 shrink-0 mt-1" />
          <div className="flex-1 space-y-3">
            <p className="text-base font-medium leading-relaxed text-foreground">
              "{quote.quote}"
            </p>
            
            {quote.author && (
              <p className="text-sm text-muted-foreground italic">
                — {quote.author}
              </p>
            )}

            {quote.actionableInsight && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-100/50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/50">
                <Lightbulb className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <p className="text-sm text-purple-900 dark:text-purple-200">
                  {quote.actionableInsight}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                variant={reaction === 'liked' ? 'default' : 'ghost'}
                onClick={() => handleReaction(true)}
                className={cn(
                  "h-7 gap-1",
                  reaction === 'liked' && "bg-green-600 hover:bg-green-700"
                )}
              >
                <ThumbsUp className="h-3 w-3" />
                {reaction === 'liked' && 'Liked'}
              </Button>
              <Button
                size="sm"
                variant={reaction === 'disliked' ? 'default' : 'ghost'}
                onClick={() => handleReaction(false)}
                className={cn(
                  "h-7 gap-1",
                  reaction === 'disliked' && "bg-red-600 hover:bg-red-700"
                )}
              >
                <ThumbsDown className="h-3 w-3" />
                {reaction === 'disliked' && 'Not for me'}
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchQuote}
                disabled={loading}
                className="h-7 gap-1"
              >
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                New Quote
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
