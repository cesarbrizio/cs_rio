const EDITOR_DRAFT_STORAGE_KEY = 'cs-rio-map-editor-draft-v1';

interface EditorDraftPayload {
  fileName: string;
  mapName: string;
  savedAt: string;
  serializedMap: Record<string, unknown>;
}

export function loadEditorDraft() {
  try {
    const rawValue = window.localStorage.getItem(EDITOR_DRAFT_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<EditorDraftPayload>;

    return parsed.fileName &&
      parsed.mapName &&
      parsed.savedAt &&
      parsed.serializedMap &&
      typeof parsed.fileName === 'string' &&
      typeof parsed.mapName === 'string' &&
      typeof parsed.savedAt === 'string'
      ? {
          fileName: parsed.fileName,
          mapName: parsed.mapName,
          savedAt: parsed.savedAt,
          serializedMap: parsed.serializedMap as Record<string, unknown>,
        }
      : null;
  } catch {
    return null;
  }
}

export function saveEditorDraft(input: {
  fileName: string;
  mapName: string;
  serializedMap: Record<string, unknown>;
}) {
  const payload: EditorDraftPayload = {
    fileName: input.fileName,
    mapName: input.mapName,
    savedAt: new Date().toISOString(),
    serializedMap: input.serializedMap,
  };

  window.localStorage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  return payload.savedAt;
}
