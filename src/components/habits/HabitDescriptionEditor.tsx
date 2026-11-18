'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { HabitDescriptionOutput } from '@/lib/ai/types';

interface HabitDescriptionEditorProps {
  habitName: string;
  habitCategory: string;
  habitId?: string; // Optional - only provided when editing existing habit
  currentDescription?: string;
  onDescriptionChange: (description: string) => void;
}

export function HabitDescriptionEditor({ 
  habitName, 
  habitCategory,
  habitId,
  currentDescription,
  onDescriptionChange 
}: HabitDescriptionEditorProps) {
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState<HabitDescriptionOutput | null>(null);
  const [showBenefits, setShowBenefits] = useState(true);
  const [showTips, setShowTips] = useState(false);
  const [showPitfalls, setShowPitfalls] = useState(false);
  const supabase = createClient();

  const generateDescription = async () => {
    if (!habitName) {
      toast.error('Please enter a habit name first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate-habit-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habit: {
            name: habitName,
            category: habitCategory
          },
          generateTips: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate description');
      }
      
      const data: HabitDescriptionOutput = await response.json();
      setAiData(data);
      onDescriptionChange(data.description);
      
      // Save to database if we have a habitId (editing existing habit)
      if (habitId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: saveError } = await (supabase
              .from('habit_descriptions') as any)
              .insert({
                habit_id: habitId,
                user_id: user.id,
                ai_description: data.description,
                benefits: data.benefits,
                tips: data.tips,
                common_pitfalls: data.commonPitfalls || [],
                difficulty_assessment: data.difficultyAssessment,
                estimated_time_minutes: data.estimatedTimeMinutes,
                scientific_backing: data.scientificBacking || null
              });

            if (saveError) {
              console.error('Failed to save description metadata:', saveError);
              // Don't fail the operation if saving metadata fails
            }
          }
        } catch (dbError) {
          console.error('Database save error:', dbError);
          // Don't fail the main operation
        }
      }

      toast.success('AI description generated!');
    } catch (error: any) {
      console.error('Description generation error:', error);
      toast.error(error.message || 'Failed to generate description');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Description</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generateDescription}
          disabled={loading || !habitName}
          className="gap-1 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-300 dark:border-purple-700"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-500" />}
          Generate Smart Description
        </Button>
      </div>

      <Textarea
        value={currentDescription}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Describe your habit..."
        className="min-h-[80px]"
      />

      {aiData && (
        <div className="space-y-3 border-t pt-4">
          {/* Benefits */}
          <div>
            <button
              type="button"
              onClick={() => setShowBenefits(!showBenefits)}
              className="flex items-center justify-between w-full text-sm font-medium mb-2 hover:text-primary transition"
            >
              <span className="flex items-center gap-2">
                ✅ Benefits ({aiData.benefits.length})
              </span>
              {showBenefits ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showBenefits && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {aiData.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 shrink-0">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tips */}
          <div>
            <button
              type="button"
              onClick={() => setShowTips(!showTips)}
              className="flex items-center justify-between w-full text-sm font-medium mb-2 hover:text-primary transition"
            >
              <span className="flex items-center gap-2">
                💡 Tips for Success ({aiData.tips.length})
              </span>
              {showTips ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showTips && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {aiData.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Common Pitfalls */}
          {aiData.commonPitfalls && aiData.commonPitfalls.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowPitfalls(!showPitfalls)}
                className="flex items-center justify-between w-full text-sm font-medium mb-2 hover:text-primary transition"
              >
                <span className="flex items-center gap-2">
                  ⚠️ Common Pitfalls ({aiData.commonPitfalls.length})
                </span>
                {showPitfalls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showPitfalls && (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {aiData.commonPitfalls.map((pitfall, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                      <span>{pitfall}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Meta Info */}
          <div className="flex gap-2 flex-wrap pt-2">
            <Badge variant="secondary" className="text-xs">
              {aiData.difficultyAssessment}
            </Badge>
            <Badge variant="outline" className="text-xs">
              ⏱️ {aiData.estimatedTimeMinutes} min/day
            </Badge>
          </div>

          {aiData.scientificBacking && (
            <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
              📚 {aiData.scientificBacking}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
