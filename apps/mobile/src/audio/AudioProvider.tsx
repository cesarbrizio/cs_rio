import type { RegionId } from '@cs-rio/shared';
import { Audio } from 'expo-av';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import {
  AUDIO_MUSIC_SOURCES,
  AUDIO_SFX_SOURCES,
  REGION_MUSIC_TRACKS,
  type AudioMusicTrackKey,
  type AudioSfxKey,
} from './audioCatalog';
import { useAppStore } from '../stores/appStore';

interface AudioContextValue {
  isReady: boolean;
  playMusic: (track: AudioMusicTrackKey | null) => Promise<void>;
  playSfx: (key: AudioSfxKey) => Promise<void>;
  stopMusic: () => Promise<void>;
  syncRegionMusic: (regionId: RegionId | null | undefined) => Promise<void>;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: PropsWithChildren): JSX.Element {
  const musicEnabled = useAppStore((state) => state.audioSettings.musicEnabled);
  const musicVolume = useAppStore((state) => state.audioSettings.musicVolume);
  const sfxEnabled = useAppStore((state) => state.audioSettings.sfxEnabled);
  const sfxVolume = useAppStore((state) => state.audioSettings.sfxVolume);
  const initialSfxVolumeRef = useRef(sfxVolume);
  const [isReady, setIsReady] = useState(false);
  const sfxPlayersRef = useRef<Partial<Record<AudioSfxKey, Audio.Sound>>>({});
  const desiredMusicTrackRef = useRef<AudioMusicTrackKey | null>(null);
  const musicPlayerRef = useRef<{
    sound: Audio.Sound;
    track: AudioMusicTrackKey;
  } | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrapAudio = async (): Promise<void> => {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const loadedEntries = await Promise.all(
        Object.entries(AUDIO_SFX_SOURCES).map(async ([key, source]) => {
          const player = new Audio.Sound();
          await player.loadAsync(source, {
            isLooping: false,
            shouldPlay: false,
            volume: initialSfxVolumeRef.current / 100,
          });

          return [key, player] as const;
        }),
      );

      if (!active) {
        await Promise.all(loadedEntries.map(([, player]) => player.unloadAsync()));
        return;
      }

      sfxPlayersRef.current = Object.fromEntries(loadedEntries) as Partial<
        Record<AudioSfxKey, Audio.Sound>
      >;
      setIsReady(true);
    };

    void bootstrapAudio();

    return () => {
      active = false;
      setIsReady(false);

      const currentMusic = musicPlayerRef.current;
      musicPlayerRef.current = null;

      const sounds = Object.values(sfxPlayersRef.current);
      sfxPlayersRef.current = {};

      void Promise.all([
        ...sounds.map((sound) => sound?.unloadAsync() ?? Promise.resolve()),
        currentMusic?.sound.unloadAsync() ?? Promise.resolve(),
      ]);
    };
  }, []);

  useEffect(() => {
    for (const player of Object.values(sfxPlayersRef.current)) {
      if (!player) {
        continue;
      }

      void player.setVolumeAsync(sfxEnabled ? sfxVolume / 100 : 0);
    }
  }, [sfxEnabled, sfxVolume]);

  const stopMusic = useCallback(async (): Promise<void> => {
    const currentMusic = musicPlayerRef.current;

    if (!currentMusic) {
      return;
    }

    musicPlayerRef.current = null;
    await currentMusic.sound.stopAsync();
    await currentMusic.sound.unloadAsync();
  }, []);

  const playMusic = useCallback(
    async (track: AudioMusicTrackKey | null): Promise<void> => {
      desiredMusicTrackRef.current = track;

      if (!track || !musicEnabled) {
        await stopMusic();
        return;
      }

      const source = AUDIO_MUSIC_SOURCES[track];

      if (!source) {
        await stopMusic();
        return;
      }

      const currentMusic = musicPlayerRef.current;

      if (currentMusic?.track === track) {
        await currentMusic.sound.setVolumeAsync(musicVolume / 100);
        await currentMusic.sound.playAsync();
        return;
      }

      await stopMusic();

      const sound = new Audio.Sound();
      await sound.loadAsync(source, {
        isLooping: true,
        shouldPlay: true,
        volume: musicVolume / 100,
      });

      musicPlayerRef.current = {
        sound,
        track,
      };
    },
    [musicEnabled, musicVolume, stopMusic],
  );

  const playSfx = useCallback(
    async (key: AudioSfxKey): Promise<void> => {
      if (!sfxEnabled) {
        return;
      }

      const player = sfxPlayersRef.current[key];

      if (!player) {
        return;
      }

      try {
        await player.setPositionAsync(0);
        await player.replayAsync();
      } catch {
        // Ignore playback hiccups in the pre-alpha placeholder system.
      }
    },
    [sfxEnabled],
  );

  useEffect(() => {
    if (!musicEnabled) {
      if (musicPlayerRef.current) {
        void musicPlayerRef.current.sound.pauseAsync();
      }

      return;
    }

    if (!musicPlayerRef.current && desiredMusicTrackRef.current) {
      void playMusic(desiredMusicTrackRef.current);
      return;
    }

    if (!musicPlayerRef.current) {
      return;
    }

    void musicPlayerRef.current.sound.setVolumeAsync(musicVolume / 100);
    void musicPlayerRef.current.sound.playAsync();
  }, [musicEnabled, musicVolume, playMusic]);

  const syncRegionMusic = useCallback(
    async (regionId: RegionId | null | undefined): Promise<void> => {
      if (!regionId) {
        await playMusic(null);
        return;
      }

      await playMusic(REGION_MUSIC_TRACKS[regionId] ?? null);
    },
    [playMusic],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      isReady,
      playMusic,
      playSfx,
      stopMusic,
      syncRegionMusic,
    }),
    [isReady, playMusic, playSfx, stopMusic, syncRegionMusic],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext);

  if (!context) {
    throw new Error('useAudio precisa ser usado dentro de <AudioProvider>.');
  }

  return context;
}
