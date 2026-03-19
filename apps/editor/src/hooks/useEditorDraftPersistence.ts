import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { BrowserWritableFileHandle } from '../io/browserFiles';
import { ensureJsonFileName } from '../io/browserFiles';
import {
  formatDraftLabel,
  readSnapshotDimension,
} from '../io/editorDocumentSnapshot';
import { loadEditorDraft, saveEditorDraft } from '../io/editorDrafts';

interface UseEditorDraftPersistenceInput {
  currentFileName: string;
  documentSignature: string;
  loadedSnapshotRef: MutableRefObject<Record<string, unknown> | null>;
  loadMapFromRaw: (
    rawMap: Record<string, unknown>,
    options?: { mapName?: string },
  ) => void;
  mapHeight: number;
  mapName: string;
  mapWidth: number;
  serializedMap: Record<string, unknown>;
  setCurrentFileHandle: Dispatch<SetStateAction<BrowserWritableFileHandle | null>>;
  setCurrentFileName: Dispatch<SetStateAction<string>>;
  setLoadedSignature: Dispatch<SetStateAction<string>>;
  setNewMapHeight: Dispatch<SetStateAction<string>>;
  setNewMapWidth: Dispatch<SetStateAction<string>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
}

export function useEditorDraftPersistence(input: UseEditorDraftPersistenceInput) {
  const {
    currentFileName,
    documentSignature,
    loadedSnapshotRef,
    loadMapFromRaw,
    mapHeight,
    mapName,
    mapWidth,
    serializedMap,
    setCurrentFileHandle,
    setCurrentFileName,
    setLoadedSignature,
    setNewMapHeight,
    setNewMapWidth,
    setStatusMessage,
  } = input;
  const draftRestoreAttemptedRef = useRef(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (loadedSnapshotRef.current === null) {
      loadedSnapshotRef.current = serializedMap;
    }
  }, [loadedSnapshotRef, serializedMap]);

  useEffect(() => {
    if (draftRestoreAttemptedRef.current) {
      return;
    }

    draftRestoreAttemptedRef.current = true;
    const draft = loadEditorDraft();

    if (!draft) {
      return;
    }

    const draftSignature = JSON.stringify(draft.serializedMap);

    if (draftSignature === documentSignature) {
      setDraftSavedAt(draft.savedAt);
      return;
    }

    loadedSnapshotRef.current = draft.serializedMap;
    setCurrentFileHandle(null);
    setCurrentFileName(ensureJsonFileName(draft.fileName));
    setLoadedSignature(draftSignature);
    setDraftSavedAt(draft.savedAt);
    setStatusMessage(`Rascunho restaurado automaticamente: ${draft.fileName}.`);
    setNewMapWidth(
      String(readSnapshotDimension(draft.serializedMap, 'width', mapWidth)),
    );
    setNewMapHeight(
      String(readSnapshotDimension(draft.serializedMap, 'height', mapHeight)),
    );
    loadMapFromRaw(draft.serializedMap, {
      mapName: draft.mapName,
    });
  }, [
    documentSignature,
    loadMapFromRaw,
    loadedSnapshotRef,
    mapHeight,
    mapWidth,
    setCurrentFileHandle,
    setCurrentFileName,
    setLoadedSignature,
    setNewMapHeight,
    setNewMapWidth,
    setStatusMessage,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedAt = saveEditorDraft({
        fileName: currentFileName,
        mapName,
        serializedMap,
      });

      setDraftSavedAt(savedAt);
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [currentFileName, mapName, serializedMap]);

  return formatDraftLabel(draftSavedAt);
}
