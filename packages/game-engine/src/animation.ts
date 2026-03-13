import { type SpriteFrame, type SpriteSheet } from './spritesheet';

export interface AnimationState {
  clipName: string | null;
  currentFrameId: string | null;
  isPlaying: boolean;
  loop: boolean;
  speed: number;
}

interface PlayOptions {
  loop?: boolean;
  reset?: boolean;
  speed?: number;
}

export class AnimationController {
  private clipName: string | null = null;
  private currentFrameIndex = 0;
  private elapsedFrameMs = 0;
  private isPlaying = false;
  private loop = true;
  private speed = 1;

  public constructor(private readonly spriteSheet: SpriteSheet, initialClipName?: string) {
    if (initialClipName) {
      this.play(initialClipName);
    }
  }

  public getCurrentFrame(): SpriteFrame | undefined {
    const frameId = this.getCurrentFrameId();
    return frameId ? this.spriteSheet.getFrame(frameId) : undefined;
  }

  public getCurrentFrameId(): string | null {
    if (!this.clipName) {
      return null;
    }

    const clip = this.spriteSheet.getClip(this.clipName);
    return clip?.frameIds[this.currentFrameIndex] ?? null;
  }

  public getState(): AnimationState {
    return {
      clipName: this.clipName,
      currentFrameId: this.getCurrentFrameId(),
      isPlaying: this.isPlaying,
      loop: this.loop,
      speed: this.speed,
    };
  }

  public pause(): void {
    this.isPlaying = false;
  }

  public play(clipName: string, options: PlayOptions = {}): string | null {
    const clip = this.spriteSheet.getClip(clipName);

    if (!clip) {
      return null;
    }

    const shouldReset = options.reset ?? clipName !== this.clipName;

    this.clipName = clipName;
    this.loop = options.loop ?? clip.loop;
    this.speed = Math.max(0.1, options.speed ?? this.speed);
    this.isPlaying = true;

    if (shouldReset) {
      this.currentFrameIndex = 0;
      this.elapsedFrameMs = 0;
    }

    return this.getCurrentFrameId();
  }

  public resume(): void {
    if (this.clipName) {
      this.isPlaying = true;
    }
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.1, speed);
  }

  public stop(): void {
    this.clipName = null;
    this.currentFrameIndex = 0;
    this.elapsedFrameMs = 0;
    this.isPlaying = false;
  }

  public update(deltaMs: number): string | null {
    if (!this.isPlaying || !this.clipName || deltaMs <= 0) {
      return this.getCurrentFrameId();
    }

    const clip = this.spriteSheet.getClip(this.clipName);

    if (!clip || clip.frameIds.length === 0) {
      return null;
    }

    this.elapsedFrameMs += deltaMs * this.speed;

    while (this.elapsedFrameMs >= this.getCurrentFrameDuration(clip.frameIds[this.currentFrameIndex])) {
      const currentDuration = this.getCurrentFrameDuration(clip.frameIds[this.currentFrameIndex]);
      this.elapsedFrameMs -= currentDuration;

      if (this.currentFrameIndex < clip.frameIds.length - 1) {
        this.currentFrameIndex += 1;
        continue;
      }

      if (this.loop) {
        this.currentFrameIndex = 0;
        continue;
      }

      this.currentFrameIndex = clip.frameIds.length - 1;
      this.isPlaying = false;
      break;
    }

    return this.getCurrentFrameId();
  }

  private getCurrentFrameDuration(frameId: string | undefined): number {
    if (!frameId) {
      return 1;
    }

    return this.spriteSheet.getFrame(frameId)?.durationMs ?? 1;
  }
}
