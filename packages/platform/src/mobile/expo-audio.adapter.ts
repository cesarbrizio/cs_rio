import { Audio } from 'expo-av';

import type { AudioPort } from '../contracts/audio.port';

type AudioSourceMap = Record<string, number>;

interface ExpoAudioPortOptions {
  musicSources: AudioSourceMap;
  sfxSources: AudioSourceMap;
}

export function createExpoAudioPort(options: ExpoAudioPortOptions): AudioPort {
  let currentMusicKey: string | null = null;
  let currentMusicPlayer: Audio.Sound | null = null;
  let musicVolume = 1;
  let sfxVolume = 1;
  const sfxPlayers = new Map<string, Audio.Sound>();

  async function stopMusic(): Promise<void> {
    if (!currentMusicPlayer) {
      currentMusicKey = null;
      return;
    }

    const player = currentMusicPlayer;

    currentMusicKey = null;
    currentMusicPlayer = null;

    await player.stopAsync();
    await player.unloadAsync();
  }

  async function getSfxPlayer(key: string): Promise<Audio.Sound | null> {
    const cachedPlayer = sfxPlayers.get(key);

    if (cachedPlayer) {
      return cachedPlayer;
    }

    const source = options.sfxSources[key];

    if (!source) {
      return null;
    }

    const player = new Audio.Sound();

    await player.loadAsync(source, {
      isLooping: false,
      shouldPlay: false,
      volume: sfxVolume,
    });
    sfxPlayers.set(key, player);

    return player;
  }

  return {
    async playMusic(key, playOptions) {
      const source = options.musicSources[key];

      if (!source) {
        await stopMusic();
        return;
      }

      if (currentMusicKey === key && currentMusicPlayer) {
        await currentMusicPlayer.setVolumeAsync(playOptions?.volume ?? musicVolume);
        await currentMusicPlayer.playAsync();
        return;
      }

      if (currentMusicPlayer) {
        await currentMusicPlayer.stopAsync();
        await currentMusicPlayer.unloadAsync();
      }

      const player = new Audio.Sound();

      await player.loadAsync(source, {
        isLooping: playOptions?.loop ?? true,
        shouldPlay: true,
        volume: playOptions?.volume ?? musicVolume,
      });

      currentMusicKey = key;
      currentMusicPlayer = player;
    },
    async playSfx(key) {
      const player = await getSfxPlayer(key);

      if (!player) {
        return;
      }

      await player.setVolumeAsync(sfxVolume);
      await player.setPositionAsync(0);
      await player.replayAsync();
    },
    setMusicVolume(volume) {
      musicVolume = Math.max(0, Math.min(1, volume));

      if (currentMusicPlayer) {
        void currentMusicPlayer.setVolumeAsync(musicVolume);
      }
    },
    setSfxVolume(volume) {
      sfxVolume = Math.max(0, Math.min(1, volume));

      for (const player of sfxPlayers.values()) {
        void player.setVolumeAsync(sfxVolume);
      }
    },
    stopMusic,
  };
}
