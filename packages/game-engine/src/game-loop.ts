export type GameLoopCallback = (deltaMs: number, fps: number) => void;

export interface GameLoopScheduler {
  cancelFrame: (handle: number) => void;
  now: () => number;
  requestFrame: (callback: (timestamp: number) => void) => number;
}

export class GameLoop {
  private frameHandle: number | null = null;
  private lastTick = 0;
  private running = false;
  private fps = 0;
  private readonly scheduler: GameLoopScheduler;

  public constructor(scheduler?: GameLoopScheduler) {
    this.scheduler = scheduler ?? createDefaultScheduler();
  }

  public start(callback: GameLoopCallback): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTick = 0;

    const tick = (timestamp: number) => {
      if (!this.running) {
        return;
      }

      const deltaMs = this.lastTick === 0 ? 0 : timestamp - this.lastTick;
      this.lastTick = timestamp;
      this.fps = deltaMs > 0 ? 1000 / deltaMs : 0;
      callback(deltaMs, this.fps);
      this.frameHandle = this.scheduler.requestFrame(tick);
    };

    this.frameHandle = this.scheduler.requestFrame(tick);
  }

  public stop(): void {
    if (this.frameHandle !== null) {
      this.scheduler.cancelFrame(this.frameHandle);
    }

    this.running = false;
    this.frameHandle = null;
  }

  public tick(now: number, callback: GameLoopCallback): void {
    const deltaMs = this.lastTick === 0 ? 0 : now - this.lastTick;
    this.lastTick = now;
    this.fps = deltaMs > 0 ? 1000 / deltaMs : 0;
    callback(deltaMs, this.fps);
  }

  public getFps(): number {
    return this.fps;
  }
}

function createDefaultScheduler(): GameLoopScheduler {
  return {
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    now: () => performance.now(),
  };
}
