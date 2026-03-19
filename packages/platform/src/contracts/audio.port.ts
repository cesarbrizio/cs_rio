export interface AudioPort {
  playSfx(key: string): Promise<void>;
  playMusic(key: string, options?: { loop?: boolean; volume?: number }): Promise<void>;
  stopMusic(): Promise<void>;
  setMusicVolume(volume: number): void;
  setSfxVolume(volume: number): void;
}
