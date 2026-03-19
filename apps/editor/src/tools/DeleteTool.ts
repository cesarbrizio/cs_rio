import type { ParsedMapStructure } from '@engine/types';

export function deleteStructureAtObjectId(
  structures: ParsedMapStructure[],
  objectId: number,
) {
  return structures.filter((structure) => structure.objectId !== objectId);
}
