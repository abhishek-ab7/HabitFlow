// JSON Response Schemas for Gemini Native JSON Mode

export const coachBriefingSchema = {
  type: 'object' as const,
  properties: {
    greeting: { type: 'string' as const },
    focus: { type: 'string' as const },
    quote: { type: 'string' as const },
    energyForecast: { 
      type: 'string' as const, 
      enum: ['low', 'medium', 'high'] 
    },
    streaksAtRisk: { 
      type: 'array' as const, 
      items: { type: 'string' as const } 
    },
    quickWins: { 
      type: 'array' as const, 
      items: { type: 'string' as const } 
    },
    goalsDeadline: { type: 'string' as const },
    weekMomentum: { 
      type: 'string' as const, 
      enum: ['up', 'down', 'stable'] 
    }
  },
  required: ['greeting', 'focus', 'quote']
};

export const taskPrioritySchema = {
  type: 'object' as const,
  properties: {
    taskId: { type: 'string' as const },
    suggestedPriority: { 
      type: 'string' as const, 
      enum: ['low', 'medium', 'high'] 
    },
    reasoning: { type: 'string' as const },
    estimatedDuration: { type: 'string' as const },
    bestTimeSlot: { type: 'string' as const },
    dependencies: { 
      type: 'array' as const, 
      items: { type: 'string' as const } 
    },
    urgencyScore: { 
      type: 'number' as const, 
      minimum: 0, 
      maximum: 100 
    }
  },
  required: ['taskId', 'suggestedPriority', 'reasoning', 'urgencyScore']
};

export const habitRecommendationSchema = {
  type: 'object' as const,
  properties: {
    recommendations: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          habitName: { type: 'string' as const },
          category: { type: 'string' as const },
          reasoning: { type: 'string' as const },
          targetDaysPerWeek: { 
            type: 'number' as const, 
            minimum: 1, 
            maximum: 7 
          },
          stackWith: { type: 'string' as const },
          difficulty: { 
            type: 'string' as const, 
            enum: ['easy', 'medium', 'hard'] 
          },
          expectedImpact: { 
            type: 'string' as const, 
            enum: ['low', 'medium', 'high'] 
          },
          relatedGoals: { 
            type: 'array' as const, 
            items: { type: 'string' as const } 
          }
        },
        required: ['habitName', 'category', 'reasoning', 'targetDaysPerWeek', 'difficulty', 'expectedImpact']
      },
      maxItems: 5
    }
  },
  required: ['recommendations']
};

export const burnoutCheckSchema = {
  type: 'object' as const,
  properties: {
    burnoutRisk: { 
      type: 'string' as const, 
      enum: ['low', 'medium', 'high'] 
    },
    score: { 
      type: 'number' as const, 
      minimum: 0, 
      maximum: 100 
    },
    indicators: { 
      type: 'array' as const, 
      items: { type: 'string' as const } 
    },
    recommendations: { 
      type: 'array' as const, 
      items: { type: 'string' as const } 
    },
    recoveryPlan: { type: 'string' as const }
  },
  required: ['burnoutRisk', 'score', 'indicators', 'recommendations']
};

export const subtaskGenerationSchema = {
  type: 'object' as const,
  properties: {
    subtasks: {
      type: 'array' as const,
      items: { type: 'string' as const },
      minItems: 3,
      maxItems: 5
    }
  },
  required: ['subtasks']
};

export const weeklyPlanSchema = {
  type: 'object' as const,
  properties: {
    weekPlan: {
      type: 'object' as const,
      properties: {
        monday: { type: 'object' as const },
        tuesday: { type: 'object' as const },
        wednesday: { type: 'object' as const },
        thursday: { type: 'object' as const },
        friday: { type: 'object' as const },
        saturday: { type: 'object' as const },
        sunday: { type: 'object' as const }
      }
    },
    insights: {
      type: 'array' as const,
      items: { type: 'string' as const }
    }
  },
  required: ['weekPlan', 'insights']
};

// ========== Goal Milestone Generator Schema ==========
export const milestoneGenerationSchema = {
  type: 'object' as const,
  properties: {
    goalId: { type: 'string' as const },
    milestones: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' as const },
          description: { type: 'string' as const },
          suggestedDeadline: { type: 'string' as const },
          difficulty: { type: 'string' as const, enum: ['easy', 'medium', 'hard'] },
          reasoning: { type: 'string' as const },
          orderIndex: { type: 'number' as const },
          estimatedTimeWeeks: { type: 'number' as const }
        },
        required: ['title', 'description', 'difficulty', 'orderIndex']
      },
      minItems: 3,
      maxItems: 7
    },
    totalEstimatedWeeks: { type: 'number' as const },
    confidenceScore: { type: 'number' as const, minimum: 0, maximum: 100 },
    alternativeApproaches: { 
      type: 'array' as const, 
      items: { type: 'string' as const } 
    }
  },
  required: ['goalId', 'milestones', 'totalEstimatedWeeks', 'confidenceScore']
};

// ========== Smart Habit Stacking Schema ==========
export const habitStackingSchema = {
  type: 'object' as const,
  properties: {
    stacks: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          description: { type: 'string' as const },
          triggerHabitId: { type: 'string' as const },
          stackedHabitIds: { type: 'array' as const, items: { type: 'string' as const } },
          suggestedOrder: { type: 'array' as const, items: { type: 'string' as const } },
          reasoning: { type: 'string' as const },
          difficulty: { type: 'string' as const, enum: ['easy', 'medium', 'hard'] },
          estimatedTimeMinutes: { type: 'number' as const },
          expectedSuccessRate: { type: 'number' as const, minimum: 0, maximum: 100 }
        },
        required: ['name', 'triggerHabitId', 'stackedHabitIds', 'reasoning']
      },
      minItems: 1,
      maxItems: 4
    },
    topRecommendation: { type: 'string' as const },
    tips: { type: 'array' as const, items: { type: 'string' as const } }
  },
  required: ['stacks', 'tips']
};

// ========== Motivational Quote Personalizer Schema ==========
export const quotePersonalizationSchema = {
  type: 'object' as const,
  properties: {
    primaryQuote: {
      type: 'object' as const,
      properties: {
        quote: { type: 'string' as const },
        author: { type: 'string' as const },
        relevanceScore: { type: 'number' as const, minimum: 1, maximum: 10 },
        context: { type: 'string' as const },
        reasoning: { type: 'string' as const },
        actionableInsight: { type: 'string' as const }
      },
      required: ['quote', 'relevanceScore', 'context', 'reasoning']
    },
    alternativeQuotes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          quote: { type: 'string' as const },
          author: { type: 'string' as const },
          relevanceScore: { type: 'number' as const }
        }
      },
      maxItems: 2
    }
  },
  required: ['primaryQuote']
};

// ========== Smart Habit Descriptions Schema ==========
export const habitDescriptionSchema = {
  type: 'object' as const,
  properties: {
    description: { type: 'string' as const },
    benefits: { type: 'array' as const, items: { type: 'string' as const }, minItems: 3, maxItems: 5 },
    tips: { type: 'array' as const, items: { type: 'string' as const }, minItems: 3, maxItems: 5 },
    difficultyAssessment: { 
      type: 'string' as const, 
      enum: ['beginner', 'intermediate', 'advanced'] 
    },
    estimatedTimeMinutes: { type: 'number' as const },
    scientificBacking: { type: 'string' as const },
    commonPitfalls: { type: 'array' as const, items: { type: 'string' as const }, maxItems: 3 }
  },
  required: ['description', 'benefits', 'tips', 'difficultyAssessment', 'estimatedTimeMinutes']
};
