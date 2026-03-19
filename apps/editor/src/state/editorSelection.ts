export type EditorObjectLayerName =
  | 'region_markers'
  | 'spawn_points'
  | 'structures';

export type EditorSelectionKind =
  | 'region_marker'
  | 'spawn_point'
  | 'structure';

export interface EditorSelection {
  kind: EditorSelectionKind;
  layerName: EditorObjectLayerName;
  objectId: number;
}

export function isEditorObjectLayerName(
  layerName: string,
): layerName is EditorObjectLayerName {
  return (
    layerName === 'structures' ||
    layerName === 'spawn_points' ||
    layerName === 'region_markers'
  );
}

export function getSelectionKindForLayer(
  layerName: EditorObjectLayerName,
): EditorSelectionKind {
  if (layerName === 'structures') {
    return 'structure';
  }

  if (layerName === 'spawn_points') {
    return 'spawn_point';
  }

  return 'region_marker';
}
