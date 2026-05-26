'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  HelpCircle, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight,
  TrendingUp,
  Brain,
  ShieldCheck,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGoalStore } from '@/lib/stores/goal-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Goal } from '@/lib/types';

interface SMARTGoalAnalysisProps {
  goal: Goal;
}

interface SmartMetric {
  score: number;
  feedback: string;
}

interface SmartAnalysisData {
  specific: SmartMetric;
  measurable: SmartMetric;
  achievable: SmartMetric;
  relevant: SmartMetric;
  timebound: SmartMetric;
  overallScore: number;
  recommendations: string[];
}

export function SMARTGoalAnalysis({ goal }: SMARTGoalAnalysisProps) {
  const { editGoal } = useGoalStore();
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overall' | 'details' | 'recommendations'>('overall');

  // Retrieve existing analysis from metadata
  const analysisData: SmartAnalysisData | undefined = goal.metadata?.smartAnalysis;

  const handleRunAnalysis = async (force = false) => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze-goal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal,
          forceRefresh: force,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run SMART Analysis');
      }

      const data = await response.json();
      
      // Save data locally in goal metadata
      const currentMetadata = goal.metadata || {};
      await editGoal(goal.id, {
        metadata: {
          ...currentMetadata,
          smartAnalysis: data
        }
      });

      toast.success('SMART analysis completed successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to evaluate goal with AI');
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const metricsList = [
    { key: 'specific', label: 'Specific', desc: 'Is the goal clear, detailed, and unambiguous?' },
    { key: 'measurable', label: 'Measurable', desc: 'Are there concrete criteria for tracking progress?' },
    { key: 'achievable', label: 'Achievable', desc: 'Is the goal realistic and attainable?' },
    { key: 'relevant', label: 'Relevant', desc: 'Does it align with your general focus and values?' },
    { key: 'timebound', label: 'Time-bound', desc: 'Does it have a clearly defined timeframe?' }
  ] as const;

  return (
    <div className="bg-card border border-border/60 rounded-xl p-6 shadow-md relative overflow-hidden flex flex-col h-full">
      {/* Decorative ambient gradient */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-primary/5 to-transparent blur-2xl pointer-events-none" />

      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h4 className="font-bold text-foreground">SMART AI Evaluation</h4>
        </div>
        
        {analysisData && (
          <Button
            variant="ghost"
            size="sm"
            disabled={analyzing}
            onClick={() => handleRunAnalysis(true)}
            className="h-8 text-xs gap-1.5 hover:bg-muted/50"
          >
            <RefreshCw className={cn("h-3 w-3", analyzing && "animate-spin")} />
            Re-evaluate
          </Button>
        )}
      </div>

      {/* Main content body */}
      {!analysisData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="p-4 bg-muted/30 rounded-full border border-border/40">
            <Target className="h-10 w-10 text-muted-foreground animate-pulse" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h5 className="font-bold text-sm">SMART Goal Analysis</h5>
            <p className="text-xs text-muted-foreground">
              Let Gemini analyze your goal parameters (title, description, and timelines) to evaluate compliance with SMART guidelines.
            </p>
          </div>
          <Button
            onClick={() => handleRunAnalysis(false)}
            disabled={analyzing}
            className="w-full sm:w-auto gap-2"
          >
            {analyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing Goal...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze with Gemini
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-4">
          {/* Navigation tabs */}
          <div className="flex bg-muted/30 p-1 rounded-lg border border-border/30 text-xs">
            <button
              onClick={() => setActiveTab('overall')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-md font-medium transition-colors",
                activeTab === 'overall' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-md font-medium transition-colors",
                activeTab === 'details' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Metric Details
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-md font-medium transition-colors",
                activeTab === 'recommendations' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Recommendations
            </button>
          </div>

          {/* Tab Panels */}
          <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 space-y-3">
            <AnimatePresence mode="wait">
              {activeTab === 'overall' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4 pt-1"
                >
                  {/* Overall score radial/badge visualization */}
                  <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/30 rounded-xl">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Overall SMART Score</div>
                      <div className="text-2xl font-black text-foreground">{analysisData.overallScore}<span className="text-xs text-muted-foreground">/100</span></div>
                    </div>
                    <Badge className={cn("px-2.5 py-1 text-xs border font-bold", getScoreColor(analysisData.overallScore))}>
                      {analysisData.overallScore >= 80 ? 'Highly Optimised' : analysisData.overallScore >= 50 ? 'Needs Improvement' : 'Vague Definition'}
                    </Badge>
                  </div>

                  {/* Summary bars preview */}
                  <div className="space-y-2.5">
                    {metricsList.map(m => {
                      const score = analysisData[m.key].score;
                      return (
                        <div key={m.key} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">{m.label}</span>
                            <span className="font-bold">{score}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-500", getProgressColor(score))} style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {activeTab === 'details' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3.5 pt-1"
                >
                  {metricsList.map(m => {
                    const metric = analysisData[m.key];
                    return (
                      <div key={m.key} className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-foreground">{m.label}</span>
                          <Badge className={cn("px-1.5 py-0 text-[10px] border font-bold", getScoreColor(metric.score))}>
                            {metric.score}%
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{metric.feedback}</p>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {activeTab === 'recommendations' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3 pt-1"
                >
                  {analysisData.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start p-3 bg-muted/20 border border-border/30 rounded-lg">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
