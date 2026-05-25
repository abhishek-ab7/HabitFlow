'use client';

import { motion } from 'framer-motion';
import { 
  Trophy, 
  AlertTriangle, 
  Lightbulb, 
  Info,
  TrendingUp,
  Flame,
  Target,
  Calendar,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StaggerContainer, StaggerItem } from '@/components/motion';
import type { Insight } from '@/lib/types';

interface InsightsCardsProps {
  insights: Insight[];
}

const TYPE_STYLES: Record<Insight['type'], { 
  icon: typeof Trophy; 
  bg: string; 
  border: string;
  iconColor: string;
}> = {
  achievement: { 
    icon: Trophy, 
    bg: 'bg-success/10', 
    border: 'border-success/30',
    iconColor: 'text-success',
  },
  warning: { 
    icon: AlertTriangle, 
    bg: 'bg-warning/10', 
    border: 'border-warning/30',
    iconColor: 'text-warning',
  },
  suggestion: { 
    icon: Lightbulb, 
    bg: 'bg-primary/10', 
    border: 'border-primary/30',
    iconColor: 'text-primary',
  },
  info: { 
    icon: Info, 
    bg: 'bg-muted', 
    border: 'border-muted',
    iconColor: 'text-muted-foreground',
  },
};

// Icon mapping for insights
const INSIGHT_ICONS: Record<string, typeof Trophy> = {
  trophy: Trophy,
  trending: TrendingUp,
  flame: Flame,
  target: Target,
  calendar: Calendar,
  star: Star,
  alert: AlertTriangle,
  lightbulb: Lightbulb,
  info: Info,
};

export function InsightsCards({ insights }: InsightsCardsProps) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            Keep tracking your habits to unlock insights!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Insights & Suggestions
        </CardTitle>
        <CardDescription>
          Personalized insights based on your habit data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StaggerContainer className="space-y-3">
          {insights.map((insight, index) => {
            const style = TYPE_STYLES[insight.type];
            const IconComponent = INSIGHT_ICONS[insight.icon] || style.icon;

            return (
              <StaggerItem key={insight.id}>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className={cn(
                    "flex gap-3 p-3 rounded-lg border transition-colors",
                    style.bg,
                    style.border
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    style.bg
                  )}>
                    <IconComponent className={cn("h-4 w-4", style.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {insight.description}
                    </p>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={cn("flex-shrink-0 self-start capitalize", style.bg)}
                  >
                    {insight.type}
                  </Badge>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </CardContent>
    </Card>
  );
}
