import type { CoachBriefingOutput } from '../types';

export type CoachSpecialistId = 'cfo' | 'habit' | 'fitness' | 'goal';

export interface CoachActionProposal {
  id: string;
  specialist: CoachSpecialistId;
  label: string;
  description: string;
  kind: 'create_task' | 'navigate';
  payload: {
    title?: string;
    priority?: 'low' | 'medium' | 'high';
    target?: string;
  };
}

export interface CoachGuardrailMeta {
  handoffsUsed: number;
  maxHandoffs: number;
  tokenBudget: number;
  readOnlyEnforced: true;
}

export type CoachSwarmOutput = CoachBriefingOutput & {
  consultedSpecialists?: CoachSpecialistId[];
  actionProposals?: CoachActionProposal[];
  guardrail?: CoachGuardrailMeta;
};
