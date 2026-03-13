import { screenToTile } from './coordinates';
import { type CameraState, type GridPoint, type ScreenPoint, type TileSize } from './types';

export interface InputRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface InputHandlerCallbacks {
  onLongPress?: (point: GridPoint, screenPoint: ScreenPoint) => void;
  onPan?: (delta: ScreenPoint, origin: ScreenPoint) => void;
  onPinch?: (scale: number, anchor: ScreenPoint) => void;
  onTap?: (point: GridPoint, screenPoint: ScreenPoint) => void;
  onUiPress?: (screenPoint: ScreenPoint) => void;
}

interface InputHandlerOptions {
  cameraProvider: () => CameraState;
  callbacks?: InputHandlerCallbacks;
  tileSize: TileSize;
  uiRects?: InputRect[];
}

export class InputHandler {
  private callbacks: InputHandlerCallbacks;
  private readonly cameraProvider: () => CameraState;
  private tileSize: TileSize;
  private uiRects: InputRect[];

  public constructor(options: InputHandlerOptions) {
    this.callbacks = options.callbacks ?? {};
    this.cameraProvider = options.cameraProvider;
    this.tileSize = options.tileSize;
    this.uiRects = options.uiRects ?? [];
  }

  public handleLongPress(screenPoint: ScreenPoint): boolean {
    if (this.isInsideUi(screenPoint)) {
      this.callbacks.onUiPress?.(screenPoint);
      return false;
    }

    this.callbacks.onLongPress?.(this.resolveTile(screenPoint), screenPoint);
    return true;
  }

  public handlePan(origin: ScreenPoint, delta: ScreenPoint): boolean {
    if (this.isInsideUi(origin)) {
      this.callbacks.onUiPress?.(origin);
      return false;
    }

    this.callbacks.onPan?.(delta, origin);
    return true;
  }

  public handlePinch(scale: number, anchor: ScreenPoint): boolean {
    if (this.isInsideUi(anchor)) {
      this.callbacks.onUiPress?.(anchor);
      return false;
    }

    this.callbacks.onPinch?.(scale, anchor);
    return true;
  }

  public handleTap(screenPoint: ScreenPoint): boolean {
    if (this.isInsideUi(screenPoint)) {
      this.callbacks.onUiPress?.(screenPoint);
      return false;
    }

    this.callbacks.onTap?.(this.resolveTile(screenPoint), screenPoint);
    return true;
  }

  public resolveTile(screenPoint: ScreenPoint): GridPoint {
    return screenToTile(screenPoint, this.cameraProvider(), this.tileSize);
  }

  public setCallbacks(callbacks: InputHandlerCallbacks): void {
    this.callbacks = callbacks;
  }

  public setTileSize(tileSize: TileSize): void {
    this.tileSize = tileSize;
  }

  public setUiRects(uiRects: InputRect[]): void {
    this.uiRects = uiRects;
  }

  private isInsideUi(screenPoint: ScreenPoint): boolean {
    return this.uiRects.some((rect) => {
      return (
        screenPoint.x >= rect.x &&
        screenPoint.x <= rect.x + rect.width &&
        screenPoint.y >= rect.y &&
        screenPoint.y <= rect.y + rect.height
      );
    });
  }
}
