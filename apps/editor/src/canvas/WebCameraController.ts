import { screenToTile } from '@engine/coordinates';
import type { Camera } from '@engine/camera';
import type { CameraState, GridPoint, ScreenPoint, TileSize } from '@engine/types';

interface WebCameraControllerInput {
  camera: Camera;
  mapHeight: number;
  mapWidth: number;
  onCameraChange: (cameraState: CameraState) => void;
  onHoverTileChange: (hoveredTile: GridPoint | null) => void;
  tileSize: TileSize;
}

function isPanGesture(event: PointerEvent, spacePressed: boolean) {
  return event.button === 1 || (event.button === 0 && (event.shiftKey || spacePressed));
}

export class WebCameraController {
  private canvas: HTMLCanvasElement | null = null;
  private draggingPointerId: number | null = null;
  private lastPointerPoint: ScreenPoint | null = null;
  private spacePressed = false;

  public constructor(private readonly input: WebCameraControllerInput) {}

  public attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    window.addEventListener('keydown', this.handleWindowKeyDown);
    window.addEventListener('keyup', this.handleWindowKeyUp);
  }

  public detach() {
    if (!this.canvas) {
      return;
    }

    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('keydown', this.handleWindowKeyDown);
    window.removeEventListener('keyup', this.handleWindowKeyUp);
    this.canvas = null;
    this.draggingPointerId = null;
    this.lastPointerPoint = null;
    this.spacePressed = false;
  }

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const anchor = this.toLocalPoint(event.clientX, event.clientY);

    if (!anchor) {
      return;
    }

    const cameraState = this.input.camera.zoomBy(event.deltaY < 0 ? 1.12 : 0.88, anchor);
    this.input.onCameraChange(cameraState);
    this.syncHover(anchor);
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    const pointerPoint = this.toLocalPoint(event.clientX, event.clientY);

    if (!pointerPoint) {
      return;
    }

    this.syncHover(pointerPoint);

    if (!isPanGesture(event, this.spacePressed) || !this.canvas) {
      return;
    }

    event.preventDefault();
    this.draggingPointerId = event.pointerId;
    this.lastPointerPoint = pointerPoint;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    const pointerPoint = this.toLocalPoint(event.clientX, event.clientY);

    if (!pointerPoint) {
      return;
    }

    if (this.draggingPointerId === event.pointerId && this.lastPointerPoint) {
      event.preventDefault();
      const deltaX = pointerPoint.x - this.lastPointerPoint.x;
      const deltaY = pointerPoint.y - this.lastPointerPoint.y;
      const currentZoom = Math.max(this.input.camera.getState().zoom, 0.001);
      const cameraState = this.input.camera.panBy({
        x: -deltaX / currentZoom,
        y: -deltaY / currentZoom,
      });

      this.lastPointerPoint = pointerPoint;
      this.input.onCameraChange(cameraState);
    }

    this.syncHover(pointerPoint);
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (this.draggingPointerId !== event.pointerId) {
      return;
    }

    this.draggingPointerId = null;
    this.lastPointerPoint = null;
  };

  private readonly handlePointerLeave = () => {
    if (this.draggingPointerId !== null) {
      return;
    }

    this.input.onHoverTileChange(null);
  };

  private readonly handleWindowKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Space') {
      this.spacePressed = true;
    }
  };

  private readonly handleWindowKeyUp = (event: KeyboardEvent) => {
    if (event.code === 'Space') {
      this.spacePressed = false;
    }
  };

  private syncHover(point: ScreenPoint) {
    const tile = screenToTile(point, this.input.camera.getState(), this.input.tileSize);
    this.input.onHoverTileChange(this.isWithinMap(tile) ? tile : null);
  }

  private isWithinMap(tile: GridPoint) {
    return (
      tile.x >= 0 &&
      tile.y >= 0 &&
      tile.x < this.input.mapWidth &&
      tile.y < this.input.mapHeight
    );
  }

  private toLocalPoint(clientX: number, clientY: number): ScreenPoint | null {
    if (!this.canvas) {
      return null;
    }

    const bounds = this.canvas.getBoundingClientRect();

    return {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  }
}
