import { create } from 'zustand';

export interface MapReturnCue {
  accent?: string;
  message: string;
}

interface UIStoreState {
  bootstrapStatus: string;
  mapReturnCue: MapReturnCue | null;
  consumeMapReturnCue: () => MapReturnCue | null;
  queueMapReturnCue: (cue: MapReturnCue) => void;
  resetUIState: () => void;
  setBootstrapStatus: (status: string) => void;
}

export const DEFAULT_BOOTSTRAP_STATUS =
  'Você entrou no mapa. Toque no chão para andar ou abra Ações rápidas para escolher o próximo passo.';

export const useUIStore = create<UIStoreState>((set) => ({
  bootstrapStatus: DEFAULT_BOOTSTRAP_STATUS,
  consumeMapReturnCue: () => {
    let nextCue: MapReturnCue | null = null;

    set((state) => {
      nextCue = state.mapReturnCue;
      return {
        mapReturnCue: null,
      };
    });

    return nextCue;
  },
  mapReturnCue: null,
  queueMapReturnCue: (cue) => set({ mapReturnCue: cue }),
  resetUIState: () =>
    set({
      bootstrapStatus: DEFAULT_BOOTSTRAP_STATUS,
      mapReturnCue: null,
    }),
  setBootstrapStatus: (bootstrapStatus) => set({ bootstrapStatus }),
}));
