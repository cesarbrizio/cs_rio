import { Howl } from 'howler';

import type { AudioPort } from '../contracts/audio.port';

type AudioSourceMap = Record<string, string | string[]>;

interface HowlerAudioPortOptions {
  musicSources: AudioSourceMap;
  sfxSources: AudioSourceMap;
}

export function createHowlerAudioPort(options: HowlerAudioPortOptions): AudioPort {
  let currentMusicKey: string | null = null;
  let currentMusicPlayer: Howl | null = null;
  let musicVolume = 1;
  let sfxVolume = 1;
  const sfxPlayers = new Map<string, Howl>();

  async function stopMusic(): Promise<void> {
    if (!currentMusicPlayer) {
      currentMusicKey = null;
      return;
    }

    currentMusicPlayer.stop();
    currentMusicPlayer.unload();
    currentMusicPlayer = null;
    currentMusicKey = null;
  }

  function getSfxPlayer(key: string): Howl | null {
    const cachedPlayer = sfxPlayers.get(key);

    if (cachedPlayer) {
      return cachedPlayer;
    }

    const source = options.sfxSources[key];

    if (!source) {
      return null;
    }

    const player = new Howl({
      src: Array.isArray(source) ? source : [source],
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
        currentMusicPlayer.volume(playOptions?.volume ?? musicVolume);
        currentMusicPlayer.play();
        return;
      }

      if (currentMusicPlayer) {
        currentMusicPlayer.stop();
        currentMusicPlayer.unload();
      }

      currentMusicKey = key;
      currentMusicPlayer = new Howl({
        loop: playOptions?.loop ?? true,
        src: Array.isArray(source) ? source : [source],
        volume: playOptions?.volume ?? musicVolume,
      });
      currentMusicPlayer.play();
    },
    async playSfx(key) {
      const player = getSfxPlayer(key);

      if (!player) {
        return;
      }

      player.volume(sfxVolume);
      player.stop();
      player.play();
    },
    setMusicVolume(volume) {
      musicVolume = Math.max(0, Math.min(1, volume));

      if (currentMusicPlayer) {
        currentMusicPlayer.volume(musicVolume);
      }
    },
    setSfxVolume(volume) {
      sfxVolume = Math.max(0, Math.min(1, volume));

      for (const player of sfxPlayers.values()) {
        player.volume(sfxVolume);
      }
    },
    stopMusic,
  };
}
