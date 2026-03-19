import {
  createEditorMapDocument,
  serializeEditorMapDocument,
} from '../state/editorMapDocument';

export function buildMapDisplayName(fileName: string) {
  return fileName
    .replace(/\.json$/i, '')
    .split(/[_-]+/g)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function buildNormalizedSnapshot(rawMap: Record<string, unknown>) {
  const document = createEditorMapDocument(rawMap);
  return serializeEditorMapDocument(document);
}

export function readSnapshotDimension(
  snapshot: Record<string, unknown>,
  dimension: 'width' | 'height',
  fallback: number,
) {
  const value = snapshot[dimension];
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function formatDraftLabel(savedAt: string | null) {
  if (!savedAt) {
    return null;
  }

  const parsedDate = new Date(savedAt);

  return Number.isNaN(parsedDate.getTime())
    ? 'Auto-save local ativo'
    : `Auto-save local: ${parsedDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`;
}
