import { type GridPoint, type MovementDirection, type MovementState } from './types';

const DEFAULT_MOVEMENT_SPEED = 3;

export class MovementController {
  private state: MovementState;

  public constructor(initialPosition: GridPoint, speedTilesPerSecond = DEFAULT_MOVEMENT_SPEED) {
    this.state = {
      position: { ...initialPosition },
      path: [],
      isMoving: false,
      direction: 'idle',
      speedTilesPerSecond,
    };
  }

  public getState(): MovementState {
    return {
      ...this.state,
      position: { ...this.state.position },
      path: this.state.path.map((point) => ({ ...point })),
    };
  }

  public setPosition(position: GridPoint): MovementState {
    this.state = {
      ...this.state,
      position: { ...position },
    };

    return this.getState();
  }

  public setPath(path: GridPoint[]): MovementState {
    this.state = {
      ...this.state,
      path: path.slice(1).map((point) => ({ ...point })),
      isMoving: path.length > 1,
      direction: path.length > 1 ? resolveDirection(path[0] ?? this.state.position, path[1] ?? this.state.position) : 'idle',
    };

    return this.getState();
  }

  public cancelPath(): MovementState {
    this.state = {
      ...this.state,
      path: [],
      isMoving: false,
      direction: 'idle',
    };

    return this.getState();
  }

  public update(deltaMs: number): MovementState {
    if (!this.state.isMoving || this.state.path.length === 0 || deltaMs <= 0) {
      return this.getState();
    }

    const stepBudget = (deltaMs / 1000) * this.state.speedTilesPerSecond;
    let remainingBudget = stepBudget;
    let nextPosition = { ...this.state.position };
    const nextPath = [...this.state.path];
    let nextDirection: MovementDirection = this.state.direction;

    while (remainingBudget > 0 && nextPath.length > 0) {
      const target = nextPath[0];

      if (!target) {
        break;
      }

      const deltaX = target.x - nextPosition.x;
      const deltaY = target.y - nextPosition.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance <= remainingBudget) {
        nextPosition = { ...target };
        nextPath.shift();
        remainingBudget -= distance;
        nextDirection = nextPath.length > 0 && nextPath[0] ? resolveDirection(nextPosition, nextPath[0]) : 'idle';
        continue;
      }

      const ratio = distance === 0 ? 0 : remainingBudget / distance;
      nextPosition = {
        x: nextPosition.x + deltaX * ratio,
        y: nextPosition.y + deltaY * ratio,
      };
      nextDirection = resolveDirection(nextPosition, target);
      remainingBudget = 0;
    }

    this.state = {
      ...this.state,
      position: nextPosition,
      path: nextPath,
      isMoving: nextPath.length > 0,
      direction: nextPath.length > 0 ? nextDirection : 'idle',
    };

    return this.getState();
  }
}

export function stepTowards(current: GridPoint, next: GridPoint): GridPoint {
  return {
    x: current.x + Math.sign(next.x - current.x),
    y: current.y + Math.sign(next.y - current.y),
  };
}

export function resolveDirection(from: GridPoint, to: GridPoint): MovementDirection {
  const deltaX = Math.sign(to.x - from.x);
  const deltaY = Math.sign(to.y - from.y);

  if (deltaX === 0 && deltaY === 0) {
    return 'idle';
  }

  if (deltaX === 0 && deltaY < 0) {
    return 'n';
  }

  if (deltaX > 0 && deltaY < 0) {
    return 'ne';
  }

  if (deltaX > 0 && deltaY === 0) {
    return 'e';
  }

  if (deltaX > 0 && deltaY > 0) {
    return 'se';
  }

  if (deltaX === 0 && deltaY > 0) {
    return 's';
  }

  if (deltaX < 0 && deltaY > 0) {
    return 'sw';
  }

  if (deltaX < 0 && deltaY === 0) {
    return 'w';
  }

  return 'nw';
}
