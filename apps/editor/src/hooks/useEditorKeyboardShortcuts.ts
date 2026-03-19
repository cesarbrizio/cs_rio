import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { GridPoint } from '@engine/types';

import type { TilePaintCommand } from '../state/historyManager';
import type { TileClipboardData } from '../state/tileRegionClipboard';
import type { EditorToolName } from '../tools/ToolManager';

interface UseEditorKeyboardShortcutsInput {
  copySelectedTileRegion: () => TileClipboardData | null;
  deleteSelectedObject: () => boolean;
  handleSaveRef: MutableRefObject<
    (input?: { forceDownload?: boolean; forceSaveAs?: boolean }) => Promise<void>
  >;
  hoveredTile: GridPoint | null;
  pasteTileClipboard: (tile: GridPoint) => TilePaintCommand | null;
  redo: () => void;
  setActiveTool: (tool: EditorToolName) => void;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  undo: () => void;
  zoomByStep: (direction: 'in' | 'out') => void;
}

export function useEditorKeyboardShortcuts(input: UseEditorKeyboardShortcutsInput) {
  const {
    copySelectedTileRegion,
    deleteSelectedObject,
    handleSaveRef,
    hoveredTile,
    pasteTileClipboard,
    redo,
    setActiveTool,
    setStatusMessage,
    undo,
    zoomByStep,
  } = input;
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isInputTarget =
        event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
      const key = event.key.toLowerCase();
      const modifierKey = event.ctrlKey || event.metaKey;

      if (!isInputTarget && modifierKey && key === 'z') {
        event.preventDefault();

        if (event.shiftKey) {
          redo();
          return;
        }

        undo();
        return;
      }

      if (!isInputTarget && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        deleteSelectedObject();
        return;
      }

      if (modifierKey && key === 's') {
        event.preventDefault();
        void handleSaveRef.current({
          forceSaveAs: event.shiftKey,
        });
        return;
      }

      if (isInputTarget) {
        return;
      }

      if (modifierKey && key === 'c') {
        const clipboard = copySelectedTileRegion();

        if (clipboard) {
          event.preventDefault();
          setStatusMessage(
            `Regiao copiada: ${clipboard.width}x${clipboard.height} do layer ${clipboard.layerName}.`,
          );
        }

        return;
      }

      if (modifierKey && key === 'v') {
        if (!hoveredTile) {
          setStatusMessage('Passe o cursor sobre um tile para colar a regiao copiada.');
          return;
        }

        const command = pasteTileClipboard(hoveredTile);

        if (command) {
          event.preventDefault();
          setStatusMessage(
            `Regiao colada em ${hoveredTile.x}, ${hoveredTile.y} com ${command.tiles.length} alteracoes.`,
          );
        }

        return;
      }

      if (event.code === 'Equal' || event.code === 'NumpadAdd') {
        event.preventDefault();
        zoomByStep('in');
        return;
      }

      if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        event.preventDefault();
        zoomByStep('out');
        return;
      }

      if (key === 'b') {
        setActiveTool('paint');
        return;
      }

      if (key === 'e') {
        setActiveTool('erase');
        return;
      }

      if (key === 'v') {
        setActiveTool('select');
        return;
      }

      if (key === 'i') {
        setActiveTool('eyedropper');
        return;
      }

      if (key === 'p') {
        setActiveTool('place');
        return;
      }

      if (key === 'x') {
        setActiveTool('delete');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    copySelectedTileRegion,
    deleteSelectedObject,
    handleSaveRef,
    hoveredTile,
    pasteTileClipboard,
    redo,
    setActiveTool,
    setStatusMessage,
    undo,
    zoomByStep,
  ]);
}
