import { create } from 'zustand';

import { type TutorialStepId } from '../features/tutorial';

export interface TutorialState {
  completedStepIds: TutorialStepId[];
  dismissed: boolean;
  playerId: string | null;
  startedAt: string | null;
}

interface TutorialStoreState {
  tutorial: TutorialState;
  bootstrapTutorial: (playerId: string) => void;
  completeTutorialStep: (stepId: TutorialStepId) => void;
  dismissTutorial: () => void;
  resetTutorial: () => void;
}

export const DEFAULT_TUTORIAL_STATE: TutorialState = {
  completedStepIds: [],
  dismissed: false,
  playerId: null,
  startedAt: null,
};

export const useTutorialStore = create<TutorialStoreState>((set) => ({
  tutorial: {
    ...DEFAULT_TUTORIAL_STATE,
  },
  bootstrapTutorial: (playerId) =>
    set((state) => {
      if (state.tutorial.playerId === playerId && state.tutorial.startedAt) {
        return state;
      }

      return {
        tutorial: {
          completedStepIds: [],
          dismissed: false,
          playerId,
          startedAt: new Date().toISOString(),
        },
      };
    }),
  completeTutorialStep: (stepId) =>
    set((state) => {
      if (state.tutorial.completedStepIds.includes(stepId)) {
        return state;
      }

      return {
        tutorial: {
          ...state.tutorial,
          completedStepIds: [...state.tutorial.completedStepIds, stepId],
          dismissed: false,
        },
      };
    }),
  dismissTutorial: () =>
    set((state) => ({
      tutorial: {
        ...state.tutorial,
        dismissed: true,
      },
    })),
  resetTutorial: () =>
    set({
      tutorial: {
        ...DEFAULT_TUTORIAL_STATE,
      },
    }),
}));
