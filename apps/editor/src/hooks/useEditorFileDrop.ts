import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { BrowserWritableFileHandle } from '../io/browserFiles';
import {
  buildMapDisplayName,
  buildNormalizedSnapshot,
  readSnapshotDimension,
} from '../io/editorDocumentSnapshot';

interface UseEditorFileDropInput {
  loadedSnapshotRef: MutableRefObject<Record<string, unknown> | null>;
  loadMapFromRaw: (
    rawMap: Record<string, unknown>,
    options?: { mapName?: string },
  ) => void;
  mapHeight: number;
  mapWidth: number;
  setCurrentFileHandle: Dispatch<SetStateAction<BrowserWritableFileHandle | null>>;
  setCurrentFileName: Dispatch<SetStateAction<string>>;
  setIsDraggingFile: Dispatch<SetStateAction<boolean>>;
  setLoadedSignature: Dispatch<SetStateAction<string>>;
  setNewMapHeight: Dispatch<SetStateAction<string>>;
  setNewMapWidth: Dispatch<SetStateAction<string>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
}

export function useEditorFileDrop(input: UseEditorFileDropInput) {
  const {
    loadedSnapshotRef,
    loadMapFromRaw,
    mapHeight,
    mapWidth,
    setCurrentFileHandle,
    setCurrentFileName,
    setIsDraggingFile,
    setLoadedSignature,
    setNewMapHeight,
    setNewMapWidth,
    setStatusMessage,
  } = input;
  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');
    let dragDepth = 0;

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      dragDepth += 1;
      setIsDraggingFile(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer!.dropEffect = 'copy';
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);

      if (dragDepth === 0) {
        setIsDraggingFile(false);
      }
    };

    const handleDrop = async (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      dragDepth = 0;
      setIsDraggingFile(false);
      const file = event.dataTransfer?.files?.[0];

      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const rawMap = JSON.parse(text) as Record<string, unknown>;
        const normalizedSnapshot = buildNormalizedSnapshot(rawMap);

        loadedSnapshotRef.current = normalizedSnapshot;
        setCurrentFileHandle(null);
        setCurrentFileName(file.name);
        setLoadedSignature(JSON.stringify(normalizedSnapshot));
        setNewMapWidth(
          String(readSnapshotDimension(normalizedSnapshot, 'width', mapWidth)),
        );
        setNewMapHeight(
          String(readSnapshotDimension(normalizedSnapshot, 'height', mapHeight)),
        );
        setStatusMessage(`Arquivo aberto por drag-and-drop: ${file.name}.`);
        loadMapFromRaw(normalizedSnapshot, {
          mapName: buildMapDisplayName(file.name),
        });
      } catch (error) {
        setStatusMessage(
          `Falha ao abrir arquivo por drag-and-drop: ${
            error instanceof Error ? error.message : 'erro desconhecido'
          }.`,
        );
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [
    loadMapFromRaw,
    loadedSnapshotRef,
    mapHeight,
    mapWidth,
    setCurrentFileHandle,
    setCurrentFileName,
    setIsDraggingFile,
    setLoadedSignature,
    setNewMapHeight,
    setNewMapWidth,
    setStatusMessage,
  ]);
}
