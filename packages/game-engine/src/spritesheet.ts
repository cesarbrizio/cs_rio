import { type TileFrameRect } from './types';

interface AsepriteFrame {
  duration?: number;
  filename?: string;
  frame?: {
    h?: number;
    w?: number;
    x?: number;
    y?: number;
  };
}

interface AsepriteFrameTag {
  direction?: 'forward' | 'pingpong' | 'reverse';
  from?: number;
  name?: string;
  to?: number;
}

interface AsepriteSheetData {
  frames?: AsepriteFrame[] | Record<string, AsepriteFrame>;
  meta?: {
    frameTags?: AsepriteFrameTag[];
  };
}

export interface SpriteFrame extends TileFrameRect {
  durationMs: number;
  id: string;
}

export interface SpriteAnimationClip {
  frameIds: string[];
  loop: boolean;
  name: string;
}

const DEFAULT_FRAME_DURATION = 120;
const sheetCache = new Map<string, SpriteSheet>();

export class SpriteSheet {
  public static clearCache(): void {
    sheetCache.clear();
  }

  public static fromAseprite(input: AsepriteSheetData, cacheKey?: string): SpriteSheet {
    if (cacheKey) {
      const cachedSheet = sheetCache.get(cacheKey);

      if (cachedSheet) {
        return cachedSheet;
      }
    }

    const frames = normalizeFrames(input.frames);
    const clips = normalizeClips(frames, input.meta?.frameTags);
    const sheet = new SpriteSheet(frames, clips);

    if (cacheKey) {
      sheetCache.set(cacheKey, sheet);
    }

    return sheet;
  }

  private readonly clips = new Map<string, SpriteAnimationClip>();
  private readonly frames = new Map<string, SpriteFrame>();

  public constructor(frames: SpriteFrame[], clips: SpriteAnimationClip[] = []) {
    for (const frame of frames) {
      this.frames.set(frame.id, frame);
    }

    for (const clip of clips) {
      this.clips.set(clip.name, clip);
    }
  }

  public getClip(name: string): SpriteAnimationClip | undefined {
    return this.clips.get(name);
  }

  public getClipNames(): string[] {
    return [...this.clips.keys()];
  }

  public getFrame(id: string): SpriteFrame | undefined {
    return this.frames.get(id);
  }

  public getFrameIds(): string[] {
    return [...this.frames.keys()];
  }

  public getFrames(frameIds: string[]): SpriteFrame[] {
    return frameIds.flatMap((frameId) => {
      const frame = this.frames.get(frameId);
      return frame ? [frame] : [];
    });
  }
}

function normalizeFrames(input: AsepriteSheetData['frames']): SpriteFrame[] {
  if (!input) {
    return [];
  }

  const frameEntries = Array.isArray(input)
    ? input.map((frame, index) => [frame.filename ?? `frame_${index}`, frame] as const)
    : Object.entries(input);

  return frameEntries.map(([frameId, frame]) => ({
    durationMs: Number(frame.duration ?? DEFAULT_FRAME_DURATION),
    id: frameId,
    width: Number(frame.frame?.w ?? 0),
    height: Number(frame.frame?.h ?? 0),
    x: Number(frame.frame?.x ?? 0),
    y: Number(frame.frame?.y ?? 0),
  }));
}

function normalizeClips(frames: SpriteFrame[], frameTags: AsepriteFrameTag[] | undefined): SpriteAnimationClip[] {
  if (Array.isArray(frameTags) && frameTags.length > 0) {
    return frameTags.flatMap((tag) => {
      const from = Number(tag.from ?? 0);
      const to = Number(tag.to ?? from);
      const rawFrames = frames.slice(from, to + 1).map((frame) => frame.id);

      if (!tag.name || rawFrames.length === 0) {
        return [];
      }

      const frameIds = tag.direction === 'reverse' ? [...rawFrames].reverse() : rawFrames;

      return [
        {
          frameIds,
          loop: true,
          name: tag.name,
        },
      ];
    });
  }

  const groupedFrames = new Map<string, string[]>();

  for (const frame of frames) {
    const clipName = frame.id.replace(/(?:[_/])\d+$/, '');
    const clipFrames = groupedFrames.get(clipName) ?? [];

    clipFrames.push(frame.id);
    groupedFrames.set(clipName, clipFrames);
  }

  return [...groupedFrames.entries()].map(([name, frameIds]) => ({
    frameIds,
    loop: true,
    name,
  }));
}
