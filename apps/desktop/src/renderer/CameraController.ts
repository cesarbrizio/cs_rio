import { screenToTile } from '@engine/coordinates';
import type { Camera } from '@engine/camera';
import type { CameraState, GridPoint, ScreenPoint, TileSize } from '@engine/types';

interface CameraControllerInput {
  camera: Camera;
  mapHeight: number;
  mapWidth: number;
  onCameraChange: (cameraState: CameraState) => void;
  onHoverTileChange: (hoveredTile: GridPoint | null) => void;
  onRecenter: () => void;
  onTileActivate: (tile: GridPoint) => void;
  tileSize: TileSize;
}

const KEYBOARD_PAN_SPEED = 860;
const CLICK_DRAG_THRESHOLD = 8;

function isPanGesture(event: PointerEvent) {
  return event.button === 1 || (event.button === 0 && event.shiftKey);
}

export class CameraController {
  private canvas: HTMLCanvasElement | null = null;
  private draggingPointerId: number | null = null;
  private keyState = new Set<string>();
  private lastPointerPoint: ScreenPoint | null = null;
  private pointerDownTile: GridPoint | null = null;
  private pointerDownPoint: ScreenPoint | null = null;

  public constructor(private readonly input: CameraControllerInput) {}

  public attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
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
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('keydown', this.handleWindowKeyDown);
    window.removeEventListener('keyup', this.handleWindowKeyUp);
    this.canvas = null;
    this.draggingPointerId = null;
    this.keyState.clear();
    this.lastPointerPoint = null;
    this.pointerDownPoint = null;
    this.pointerDownTile = null;
  }

  public update(deltaMs: number) {
    if (deltaMs <= 0) {
      return;
    }

    const direction = this.getKeyboardDirection();

    if (direction.x === 0 && direction.y === 0) {
      return;
    }

    const magnitude = Math.hypot(direction.x, direction.y) || 1;
    const speedMultiplier = this.keyState.has('ShiftLeft') || this.keyState.has('ShiftRight') ? 1.45 : 1;
    const cameraZoom = Math.max(this.input.camera.getState().zoom, 0.001);
    const worldUnitsPerFrame = (KEYBOARD_PAN_SPEED * speedMultiplier * deltaMs) / 1000 / cameraZoom;
    const nextCameraState = this.input.camera.panBy({
      x: (direction.x / magnitude) * worldUnitsPerFrame,
      y: (direction.y / magnitude) * worldUnitsPerFrame,
    });

    this.input.onCameraChange(nextCameraState);
  }

  private readonly handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

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

    this.pointerDownPoint = pointerPoint;
    this.pointerDownTile = this.resolveTile(pointerPoint);
    this.syncHover(pointerPoint);

    if (!isPanGesture(event) || !this.canvas) {
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
    const pointerPoint = this.toLocalPoint(event.clientX, event.clientY);

    if (
      event.button === 0 &&
      this.pointerDownPoint &&
      this.pointerDownTile &&
      pointerPoint &&
      this.draggingPointerId !== event.pointerId
    ) {
      const dragDistance = Math.hypot(
        pointerPoint.x - this.pointerDownPoint.x,
        pointerPoint.y - this.pointerDownPoint.y,
      );

      if (dragDistance <= CLICK_DRAG_THRESHOLD) {
        this.input.onTileActivate(this.pointerDownTile);
      }
    }

    if (this.draggingPointerId === event.pointerId) {
      this.draggingPointerId = null;
      this.lastPointerPoint = null;
    }

    this.pointerDownPoint = null;
    this.pointerDownTile = null;

    if (this.canvas && this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private readonly handlePointerLeave = () => {
    if (this.draggingPointerId !== null) {
      return;
    }

    this.input.onHoverTileChange(null);
  };

  private readonly handleWindowKeyDown = (event: KeyboardEvent) => {
    this.keyState.add(event.code);

    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      this.input.onRecenter();
    }
  };

  private readonly handleWindowKeyUp = (event: KeyboardEvent) => {
    this.keyState.delete(event.code);
  };

  private getKeyboardDirection(): ScreenPoint {
    let x = 0;
    let y = 0;

    if (this.keyState.has('KeyA') || this.keyState.has('ArrowLeft')) {
      x -= 1;
    }

    if (this.keyState.has('KeyD') || this.keyState.has('ArrowRight')) {
      x += 1;
    }

    if (this.keyState.has('KeyW') || this.keyState.has('ArrowUp')) {
      y -= 1;
    }

    if (this.keyState.has('KeyS') || this.keyState.has('ArrowDown')) {
      y += 1;
    }

    return { x, y };
  }

  private syncHover(point: ScreenPoint) {
    this.input.onHoverTileChange(this.resolveTile(point));
  }

  private resolveTile(point: ScreenPoint): GridPoint | null {
    const tile = screenToTile(point, this.input.camera.getState(), this.input.tileSize);

    if (!this.isWithinMap(tile)) {
      return null;
    }

    return tile;
  }

  private isWithinMap(tile: GridPoint) {
    return tile.x >= 0 && tile.y >= 0 && tile.x < this.input.mapWidth && tile.y < this.input.mapHeight;
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
