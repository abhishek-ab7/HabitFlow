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

async function persistHabitDescriptionMetadata(
  supabase: ReturnType<typeof createClient>,
  habitId: string,
  data: HabitDescriptionOutput
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: saveError } = await (supabase.from('habit_descriptions') as any).insert({
      habit_id: habitId,
      user_id: user.id,
      ai_description: data.description,
      benefits: data.benefits,
      tips: data.tips,
      common_pitfalls: data.commonPitfalls || [],
      difficulty_assessment: data.difficultyAssessment,
      estimated_time_minutes: data.estimatedTimeMinutes,
      scientific_backing: data.scientificBacking || null,
    });
    if (saveError) console.error('Failed to save description metadata:', saveError);
  } catch (dbError) {
    console.error('Database save error:', dbError);
  }
}

function CollapsibleBulletSection({
  title,
  items,
  bulletColorClass,
  isOpen,
  onToggle,
}: {
  title: string;
  items: string[];
  bulletColorClass: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full text-sm font-medium mb-2 hover:text-primary transition"
      >
        <span className="flex items-center gap-2">
          {title} ({items.length})
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={cn('mt-0.5 shrink-0', bulletColorClass)}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
      
      if (habitId) {
        await persistHabitDescriptionMetadata(supabase, habitId, data);
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
          className="gap-1.5 bg-invest/10 border-invest/25 hover:border-invest/50 hover:bg-invest/15 text-invest"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-invest" />}
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
          <CollapsibleBulletSection
            title="✅ Benefits"
            items={aiData.benefits}
            bulletColorClass="text-green-500"
            isOpen={showBenefits}
            onToggle={() => setShowBenefits(!showBenefits)}
          />
          <CollapsibleBulletSection
            title="💡 Tips for Success"
            items={aiData.tips}
            bulletColorClass="text-blue-500"
            isOpen={showTips}
            onToggle={() => setShowTips(!showTips)}
          />
          {aiData.commonPitfalls && aiData.commonPitfalls.length > 0 && (
            <CollapsibleBulletSection
              title="⚠️ Common Pitfalls"
              items={aiData.commonPitfalls}
              bulletColorClass="text-amber-500"
              isOpen={showPitfalls}
              onToggle={() => setShowPitfalls(!showPitfalls)}
            />
          )}

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
