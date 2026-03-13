import { type DepthSortable } from './types';

export function getDepthSortKey(entity: DepthSortable): number {
  const footprintX = entity.x + (entity.widthInTiles ?? 1) - 1;
  const footprintY = entity.y + (entity.heightInTiles ?? 1) - 1;

  return footprintX + footprintY + (entity.sortBias ?? 0);
}

export function depthSort<T extends DepthSortable>(entities: T[]): T[] {
  return [...entities]
    .map((entity, index) => ({
      entity,
      index,
      sortKey: getDepthSortKey(entity),
    }))
    .sort((left, right) => left.sortKey - right.sortKey || left.index - right.index)
    .map((item) => item.entity);
}
