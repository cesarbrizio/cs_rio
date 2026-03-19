import type { GridPoint, ParsedMapStructure, ParsedTilemap } from '@engine/types';

import type { SceneEntity } from './types';

const REMOTE_PALETTE = ['#ff7b54', '#6ed2ff', '#f7c766', '#8de0a6', '#ef8dff', '#74d0bc'];

export function buildDemoRemoteEntities(map: ParsedTilemap, playerSpawn: GridPoint): SceneEntity[] {
  const anchors = map.structures
    .slice(0, 10)
    .map((structure) => resolveWalkableStructureAnchor(map, structure))
    .filter((point): point is GridPoint => point !== null);

  if (anchors.length === 0) {
    return [
      {
        accent: REMOTE_PALETTE[0]!,
        id: 'remote-fallback-1',
        kind: 'remote',
        label: 'Equipe remota',
        position: {
          x: playerSpawn.x + 3,
          y: playerSpawn.y + 2,
        },
      },
    ];
  }

  return anchors.map((anchor, index) => ({
    accent: REMOTE_PALETTE[index % REMOTE_PALETTE.length]!,
    id: `remote-${index + 1}`,
    kind: 'remote',
    label: resolveRemoteLabel(map.structures[index], index),
    position: anchor,
  }));
}

export function resolveInitialPlayerSpawn(map: ParsedTilemap): GridPoint {
  const preferredSpawn = map.spawnPoints[1] ?? map.spawnPoints[0];

  if (preferredSpawn) {
    return {
      x: preferredSpawn.gridX,
      y: preferredSpawn.gridY,
    };
  }

  return {
    x: Math.floor(map.width / 2),
    y: Math.floor(map.height / 2),
  };
}

function resolveRemoteLabel(structure: ParsedMapStructure | undefined, index: number): string {
  if (!structure) {
    return `NPC ${index + 1}`;
  }

  return structure.label ?? structure.name ?? `NPC ${index + 1}`;
}

function resolveWalkableStructureAnchor(
  map: ParsedTilemap,
  structure: ParsedMapStructure,
): GridPoint | null {
  const candidates = [
    {
      x: structure.gridX + structure.footprint.w + 1,
      y: structure.gridY + Math.max(0, Math.floor(structure.footprint.h / 2)),
    },
    {
      x: structure.gridX - 1,
      y: structure.gridY + Math.max(0, Math.floor(structure.footprint.h / 2)),
    },
    {
      x: structure.gridX + Math.max(0, Math.floor(structure.footprint.w / 2)),
      y: structure.gridY + structure.footprint.h + 1,
    },
    {
      x: structure.gridX + Math.max(0, Math.floor(structure.footprint.w / 2)),
      y: structure.gridY - 1,
    },
  ];

  for (const candidate of candidates) {
    const walkableTile = findNearestWalkableTile(map, candidate);

    if (walkableTile) {
      return walkableTile;
    }
  }

  return null;
}

function findNearestWalkableTile(map: ParsedTilemap, origin: GridPoint, maxRadius = 5): GridPoint | null {
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
      for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
        const candidate = { x, y };

        if (!isWithinMap(map, candidate) || !isWalkable(map, candidate)) {
          continue;
        }

        return candidate;
      }
    }
  }

  return null;
}

function isWalkable(map: ParsedTilemap, tile: GridPoint): boolean {
  return !map.collisionSet.has(`${tile.x}:${tile.y}`);
}

function isWithinMap(map: ParsedTilemap, tile: GridPoint): boolean {
  return tile.x >= 0 && tile.y >= 0 && tile.x < map.width && tile.y < map.height;
}
