import { type GridPoint, type PathNode } from './types';

const DEFAULT_MAX_EXPANDED_NODES = 100;

interface FrontierNode extends GridPoint {
  cost: number;
  priority: number;
}

function nodeKey(node: GridPoint): string {
  return `${node.x}:${node.y}`;
}

function heuristic(a: GridPoint, b: GridPoint): number {
  const deltaX = Math.abs(a.x - b.x);
  const deltaY = Math.abs(a.y - b.y);
  const diagonal = Math.min(deltaX, deltaY);
  const straight = Math.abs(deltaX - deltaY);

  return diagonal * 1.41 + straight;
}

function getNeighbors(node: GridPoint): Array<GridPoint & { stepCost: number }> {
  return [
    { x: node.x + 1, y: node.y, stepCost: 1 },
    { x: node.x - 1, y: node.y, stepCost: 1 },
    { x: node.x, y: node.y + 1, stepCost: 1 },
    { x: node.x, y: node.y - 1, stepCost: 1 },
    { x: node.x + 1, y: node.y + 1, stepCost: 1.41 },
    { x: node.x - 1, y: node.y - 1, stepCost: 1.41 },
    { x: node.x + 1, y: node.y - 1, stepCost: 1.41 },
    { x: node.x - 1, y: node.y + 1, stepCost: 1.41 },
  ];
}

function normalizeBlockedNodes(blocked: PathNode[]): Map<string, PathNode> {
  return blocked.reduce<Map<string, PathNode>>((carry, node) => {
    carry.set(nodeKey(node), node);
    return carry;
  }, new Map<string, PathNode>());
}

function isDiagonalMove(from: GridPoint, to: GridPoint): boolean {
  return from.x !== to.x && from.y !== to.y;
}

export function findPath(
  start: GridPoint,
  goal: GridPoint,
  blocked: PathNode[] = [],
  maxExpandedNodes = DEFAULT_MAX_EXPANDED_NODES,
): GridPoint[] {
  if (start.x === goal.x && start.y === goal.y) {
    return [start];
  }

  const blockedNodes = normalizeBlockedNodes(blocked);
  const frontier: FrontierNode[] = [
    {
      ...start,
      cost: 0,
      priority: heuristic(start, goal),
    },
  ];
  const cameFrom = new Map<string, GridPoint | null>([[nodeKey(start), null]]);
  const costSoFar = new Map<string, number>([[nodeKey(start), 0]]);
  let expandedNodes = 0;

  while (frontier.length > 0 && expandedNodes < maxExpandedNodes) {
    frontier.sort((left, right) => left.priority - right.priority || left.cost - right.cost);

    const current = frontier.shift();

    if (!current) {
      break;
    }

    expandedNodes += 1;

    if (current.x === goal.x && current.y === goal.y) {
      return buildPath(current, cameFrom);
    }

    for (const neighbor of getNeighbors(current)) {
      const blockedNode = blockedNodes.get(nodeKey(neighbor));

      if (blockedNode?.walkable === false) {
        continue;
      }

      if (isDiagonalMove(current, neighbor)) {
        const sideA = blockedNodes.get(nodeKey({ x: neighbor.x, y: current.y }));
        const sideB = blockedNodes.get(nodeKey({ x: current.x, y: neighbor.y }));

        if (sideA?.walkable === false || sideB?.walkable === false) {
          continue;
        }
      }

      const neighborWeight = blockedNode?.weight ?? 1;
      const newCost = (costSoFar.get(nodeKey(current)) ?? 0) + neighbor.stepCost * neighborWeight;
      const previousCost = costSoFar.get(nodeKey(neighbor));

      if (previousCost === undefined || newCost < previousCost) {
        costSoFar.set(nodeKey(neighbor), newCost);
        cameFrom.set(nodeKey(neighbor), { x: current.x, y: current.y });

        frontier.push({
          x: neighbor.x,
          y: neighbor.y,
          cost: newCost,
          priority: newCost + heuristic(neighbor, goal),
        });
      }
    }
  }

  return [];
}

function buildPath(current: GridPoint, cameFrom: Map<string, GridPoint | null>): GridPoint[] {
  const path: GridPoint[] = [];
  let cursor: GridPoint | null = current;

  while (cursor) {
    path.unshift(cursor);
    cursor = cameFrom.get(nodeKey(cursor)) ?? null;
  }

  return path;
}
