import { type CameraBounds, type CameraFollowOptions, type CameraMode, type CameraState, type ScreenPoint, type Size } from './types';

const DEFAULT_ZOOM_LIMITS = {
  min: 0.72,
  max: 2.7,
};

const DEFAULT_FOLLOW_OPTIONS: Required<Omit<CameraFollowOptions, 'lerp'>> = {
  deadZoneWidth: 180,
  deadZoneHeight: 120,
};

export class Camera {
  private state: CameraState;
  private bounds?: CameraBounds;

  public constructor(initialState: CameraState, bounds?: CameraBounds) {
    this.state = initialState;
    this.bounds = bounds;
  }

  public getState(): CameraState {
    return { ...this.state };
  }

  public setBounds(bounds?: CameraBounds): CameraState {
    this.bounds = bounds;
    this.state = this.clampState({ ...this.state });
    return this.getState();
  }

  public setViewport(size: Size): CameraState {
    this.state = this.clampState({ ...this.state, viewportWidth: size.width, viewportHeight: size.height });
    return this.getState();
  }

  public setMode(mode: CameraMode): CameraState {
    this.state = { ...this.state, mode };
    return this.getState();
  }

  public panTo(target: ScreenPoint): CameraState {
    this.state = this.clampState({ ...this.state, x: target.x, y: target.y });
    return this.getState();
  }

  public panBy(delta: ScreenPoint): CameraState {
    return this.panTo({
      x: this.state.x + delta.x,
      y: this.state.y + delta.y,
    });
  }

  public zoomTo(zoom: number, anchor?: ScreenPoint): CameraState {
    const worldBeforeZoom = anchor ? this.screenToWorld(anchor) : undefined;
    const boundedZoom = Math.min(DEFAULT_ZOOM_LIMITS.max, Math.max(DEFAULT_ZOOM_LIMITS.min, zoom));
    this.state = { ...this.state, zoom: boundedZoom };

    if (anchor && worldBeforeZoom) {
      const worldAfterZoom = this.screenToWorld(anchor);
      this.state = {
        ...this.state,
        x: this.state.x + (worldBeforeZoom.x - worldAfterZoom.x),
        y: this.state.y + (worldBeforeZoom.y - worldAfterZoom.y),
      };
    }

    this.state = this.clampState(this.state);
    return this.getState();
  }

  public zoomBy(multiplier: number, anchor?: ScreenPoint): CameraState {
    return this.zoomTo(this.state.zoom * multiplier, anchor);
  }

  public focusOn(target: ScreenPoint, lerp = 1): CameraState {
    const safeLerp = Math.min(1, Math.max(0, lerp));

    this.state = this.clampState({
      ...this.state,
      x: this.state.x + (target.x - this.state.x) * safeLerp,
      y: this.state.y + (target.y - this.state.y) * safeLerp,
    });

    return this.getState();
  }

  public applyInertia(velocity: ScreenPoint, deltaMs: number, dampingPerFrame = 0.9): ScreenPoint {
    if (deltaMs <= 0) {
      return velocity;
    }

    const frameFactor = deltaMs / (1000 / 60);
    const damping = Math.pow(dampingPerFrame, frameFactor);
    const nextVelocity = {
      x: velocity.x * damping,
      y: velocity.y * damping,
    };

    if (Math.abs(nextVelocity.x) < 2 && Math.abs(nextVelocity.y) < 2) {
      return {
        x: 0,
        y: 0,
      };
    }

    this.panBy({
      x: (-nextVelocity.x * deltaMs) / 1000 / this.state.zoom,
      y: (-nextVelocity.y * deltaMs) / 1000 / this.state.zoom,
    });

    return nextVelocity;
  }

  public updateFollowTarget(target: ScreenPoint, options: CameraFollowOptions = {}): CameraState {
    if (this.state.mode !== 'follow') {
      return this.getState();
    }

    const deadZoneWidth = options.deadZoneWidth ?? this.state.deadZoneWidth ?? DEFAULT_FOLLOW_OPTIONS.deadZoneWidth;
    const deadZoneHeight = options.deadZoneHeight ?? this.state.deadZoneHeight ?? DEFAULT_FOLLOW_OPTIONS.deadZoneHeight;
    const lerp = options.lerp ?? 0.2;
    const targetScreenPoint = this.worldToScreen(target);
    const viewportCenterX = this.state.viewportWidth / 2;
    const viewportCenterY = this.state.viewportHeight / 2;
    const halfDeadZoneWidth = deadZoneWidth / 2;
    const halfDeadZoneHeight = deadZoneHeight / 2;
    let desiredX = this.state.x;
    let desiredY = this.state.y;

    if (targetScreenPoint.x < viewportCenterX - halfDeadZoneWidth) {
      desiredX -= (viewportCenterX - halfDeadZoneWidth - targetScreenPoint.x) / this.state.zoom;
    } else if (targetScreenPoint.x > viewportCenterX + halfDeadZoneWidth) {
      desiredX += (targetScreenPoint.x - (viewportCenterX + halfDeadZoneWidth)) / this.state.zoom;
    }

    if (targetScreenPoint.y < viewportCenterY - halfDeadZoneHeight) {
      desiredY -= (viewportCenterY - halfDeadZoneHeight - targetScreenPoint.y) / this.state.zoom;
    } else if (targetScreenPoint.y > viewportCenterY + halfDeadZoneHeight) {
      desiredY += (targetScreenPoint.y - (viewportCenterY + halfDeadZoneHeight)) / this.state.zoom;
    }

    return this.focusOn({ x: desiredX, y: desiredY }, lerp);
  }

  public screenToWorld(point: ScreenPoint): ScreenPoint {
    return {
      x: this.state.x + (point.x - this.state.viewportWidth / 2) / this.state.zoom,
      y: this.state.y + (point.y - this.state.viewportHeight / 2) / this.state.zoom,
    };
  }

  public worldToScreen(point: ScreenPoint): ScreenPoint {
    return {
      x: (point.x - this.state.x) * this.state.zoom + this.state.viewportWidth / 2,
      y: (point.y - this.state.y) * this.state.zoom + this.state.viewportHeight / 2,
    };
  }

  private clampState(nextState: CameraState): CameraState {
    if (!this.bounds) {
      return nextState;
    }

    const halfViewportWidth = nextState.viewportWidth / Math.max(nextState.zoom, 0.001) / 2;
    const halfViewportHeight = nextState.viewportHeight / Math.max(nextState.zoom, 0.001) / 2;
    const minX = this.bounds.minX + halfViewportWidth;
    const maxX = this.bounds.maxX - halfViewportWidth;
    const minY = this.bounds.minY + halfViewportHeight;
    const maxY = this.bounds.maxY - halfViewportHeight;

    return {
      ...nextState,
      x: clampAxis(nextState.x, minX, maxX),
      y: clampAxis(nextState.y, minY, maxY),
    };
  }
}

function clampAxis(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(max, Math.max(min, value));
}
