import type { SupplementInventory } from '@/lib/types';
import type {
  UniversalCaptureAction,
  UniversalExpenseAction,
  UniversalMealAction,
} from '@/lib/quick-capture/universal-parser';

export type {
  UniversalCaptureAction,
  UniversalExpenseAction,
  UniversalMealAction,
};
export type { SupplementInventory };

export type UniversalWorkoutAction = Extract<UniversalCaptureAction, { kind: 'workout' }>;
export type UniversalBioAction = Extract<UniversalCaptureAction, { kind: 'bio' }>;
export type UniversalSupplementAction = Extract<UniversalCaptureAction, { kind: 'supplement' }>;
export type UniversalTaskAction = Extract<UniversalCaptureAction, { kind: 'task' }>;

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
