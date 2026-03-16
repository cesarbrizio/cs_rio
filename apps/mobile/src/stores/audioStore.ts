import { create } from 'zustand';

export interface AudioSettingsState {
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
}

interface AudioStoreState {
  audioSettings: AudioSettingsState;
  resetAudioSettings: () => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setSfxVolume: (volume: number) => void;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsState = {
  musicEnabled: true,
  musicVolume: 70,
  sfxEnabled: true,
  sfxVolume: 80,
};

export const useAudioStore = create<AudioStoreState>((set) => ({
  audioSettings: {
    ...DEFAULT_AUDIO_SETTINGS,
  },
  resetAudioSettings: () =>
    set({
      audioSettings: {
        ...DEFAULT_AUDIO_SETTINGS,
      },
    }),
  setMusicEnabled: (enabled) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        musicEnabled: enabled,
      },
    })),
  setMusicVolume: (volume) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        musicVolume: clampAudioVolume(volume),
      },
    })),
  setSfxEnabled: (enabled) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        sfxEnabled: enabled,
      },
    })),
  setSfxVolume: (volume) =>
    set((state) => ({
      audioSettings: {
        ...state.audioSettings,
        sfxVolume: clampAudioVolume(volume),
      },
    })),
}));

function clampAudioVolume(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
