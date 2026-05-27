import type { AreaOfLife, Priority } from '@/lib/types';

export interface TemplateGoal {
  title: string;
  description: string;
  areaOfLife: AreaOfLife;
  priority: Priority;
  durationDays: number;
  milestones: string[];
}

export const GOAL_TEMPLATES: TemplateGoal[] = [
  // Health & Fitness
  {
    title: 'Run a 5K in 3 Months',
    description: 'Build cardiovascular endurance and run a full 5K distance continuously.',
    areaOfLife: 'health',
    priority: 'high',
    durationDays: 90,
    milestones: [
      'Run continuously for 10 minutes',
      'Run 3K without stopping',
      'Complete a full 5K run'
    ]
  },
  {
    title: 'Sleep 8 Hours Daily',
    description: 'Improve sleep hygiene and consistency for better daily recovery.',
    areaOfLife: 'health',
    priority: 'medium',
    durationDays: 30,
    milestones: [
      'Set consistent bedtime alarm for 7 days',
      'Maintain sleep schedule on weekend',
      'Log 8 hours of sleep for 20 days in a month'
    ]
  },
  {
    title: 'Drink 2L Water Daily',
    description: 'Ensure daily cellular hydration by maintaining a strict water intake routine.',
    areaOfLife: 'health',
    priority: 'low',
    durationDays: 30,
    milestones: [
      'Drink 1L of water before noon for 7 consecutive days',
      'Track daily intake using a bottle or app for 15 days',
      'Reach 2L goal daily for 25 days in a month'
    ]
  },
  // Career & Work
  {
    title: 'Build & Launch Side Project',
    description: 'Transform an idea into a functional deployed application.',
    areaOfLife: 'career',
    priority: 'high',
    durationDays: 60,
    milestones: [
      'Design project wireframes and schema',
      'Build MVP core features',
      'Deploy to production and launch'
    ]
  },
  {
    title: 'Update Professional Portfolio',
    description: 'Showcase recent achievements and projects to attract opportunities.',
    areaOfLife: 'career',
    priority: 'medium',
    durationDays: 30,
    milestones: [
      'Gather details & screenshots of 3 past projects',
      'Design portfolio layout',
      'Write case studies and publish portfolio website'
    ]
  },
  {
    title: 'Complete Professional Online Course',
    description: 'Upskill and learn a new technology or framework.',
    areaOfLife: 'career',
    priority: 'high',
    durationDays: 45,
    milestones: [
      'Complete first half of the course videos and quizzes',
      'Build the midterm project or assignments',
      'Finish final exam and claim certification'
    ]
  },
  // Personal Growth
  {
    title: 'Read 12 Books this Year',
    description: 'Cultivate a consistent reading habit across diverse subjects.',
    areaOfLife: 'personal_growth',
    priority: 'medium',
    durationDays: 365,
    milestones: [
      'Read 3 books',
      'Read 6 books',
      'Read 9 books',
      'Read 12 books'
    ]
  },
  {
    title: 'Learn a New Language',
    description: 'Acquire conversational skills and expand cultural understanding.',
    areaOfLife: 'personal_growth',
    priority: 'medium',
    durationDays: 180,
    milestones: [
      'Maintain a 30-day streak on language app',
      'Hold a 5-minute basic conversation',
      'Watch a movie in the target language'
    ]
  },
  {
    title: 'Daily Meditation Routine',
    description: 'Develop mindfulness, reduce stress, and improve mental focus.',
    areaOfLife: 'personal_growth',
    priority: 'low',
    durationDays: 30,
    milestones: [
      'Meditate for 5 minutes daily for 7 days',
      'Increase session time to 10 minutes for 10 days',
      'Complete a 15-minute mindfulness session'
    ]
  },
  // Relationships
  {
    title: 'Weekly Date Night',
    description: 'Dedicate quality one-on-one time to strengthen relationships.',
    areaOfLife: 'relationships',
    priority: 'high',
    durationDays: 90,
    milestones: [
      'Plan 4 weekly date nights',
      'Plan 8 weekly date nights',
      'Plan 12 weekly date nights'
    ]
  },
  {
    title: 'Connect with Old Friends',
    description: 'Rekindle relationships with friends who live far away.',
    areaOfLife: 'relationships',
    priority: 'low',
    durationDays: 60,
    milestones: [
      'List 5 long-distance friends to contact',
      'Call or video chat 3 old friends',
      'Send handwritten letters or small gifts'
    ]
  },
  // Finance
  {
    title: 'Save $1,000 Emergency Fund',
    description: 'Establish a safety net to cover unexpected expenses.',
    areaOfLife: 'finance',
    priority: 'high',
    durationDays: 120,
    milestones: [
      'Automate weekly savings transfers',
      'Save first $250',
      'Save first $500',
      'Reach full $1,000 goal'
    ]
  },
  {
    title: 'Create a Monthly Budget',
    description: 'Track spending and optimize savings goals.',
    areaOfLife: 'finance',
    priority: 'high',
    durationDays: 30,
    milestones: [
      'Track all expenses for 2 weeks',
      'Categorize and set budget limits',
      'Stay under budget for 1 full month'
    ]
  },
  {
    title: 'Pay Off Credit Card Debt',
    description: 'Pay down outstanding balances and improve credit health.',
    areaOfLife: 'finance',
    priority: 'high',
    durationDays: 90,
    milestones: [
      'List all card balances, interest rates, and minimums',
      'Allocate surplus funds and pay off first small balance',
      'Reduce total outstanding debt by 50%'
    ]
  },
  // Fun & Recreation
  {
    title: 'Plan a Summer Road Trip',
    description: 'Explore new places and take time off for adventure.',
    areaOfLife: 'fun',
    priority: 'medium',
    durationDays: 90,
    milestones: [
      'Choose route, dates, and budget',
      'Book accommodation and activities',
      'Pack bags and depart'
    ]
  },
  {
    title: 'Try 5 New Hobbies',
    description: 'Explore new interests and expand creative boundaries.',
    areaOfLife: 'fun',
    priority: 'low',
    durationDays: 180,
    milestones: [
      'List 5 hobbies to try out',
      'Attend 2 trial classes or purchase beginner gear',
      'Practice 2 new hobbies for at least 5 hours each'
    ]
  }
];
