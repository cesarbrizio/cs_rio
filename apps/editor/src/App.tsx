import { useMemo, useRef, useState } from 'react';

import type { BrowserWritableFileHandle } from './io/browserFiles';
import {
  downloadTextFile,
  ensureJsonFileName,
  showJsonSaveFilePicker,
  writeTextToFileHandle,
} from './io/browserFiles';
import { MapCanvas, type MapCanvasHandle } from './canvas/MapCanvas';
import { useEditorDraftPersistence } from './hooks/useEditorDraftPersistence';
import { useEditorFileDrop } from './hooks/useEditorFileDrop';
import { useEditorKeyboardShortcuts } from './hooks/useEditorKeyboardShortcuts';
import {
  buildMapDisplayName,
  buildNormalizedSnapshot,
  readSnapshotDimension,
} from './io/editorDocumentSnapshot';
import { findTilemapObjectById } from './objects/objectLayerEditing';
import { DocumentPanel } from './panels/DocumentPanel';
import { EditorStatsPanel } from './panels/EditorStatsPanel';
import { LayerPanel } from './panels/LayerPanel';
import { PropertyPanel } from './panels/PropertyPanel';
import { StructureCatalog } from './panels/StructureCatalog';
import { TilePalette } from './panels/TilePalette';
import { ToolBar } from './panels/ToolBar';
import {
  createEmptyMapDocument,
  serializeEditorMapDocument,
  validateSerializedMap,
} from './state/editorMapDocument';
import { useEditorStore } from './state/editorStore';
import { findStructureByObjectId } from './structures/structureEditing';

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleSaveRef = useRef<
    (input?: { forceDownload?: boolean; forceSaveAs?: boolean }) => Promise<void>
  >(() => Promise.resolve());
  const mapCanvasRef = useRef<MapCanvasHandle | null>(null);
  const loadedSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const cameraZoom = useEditorStore((state) => state.cameraState.zoom);
  const activeLayerName = useEditorStore((state) => state.activeLayerName);
  const activeTool = useEditorStore((state) => state.activeTool);
  const copySelectedTileRegion = useEditorStore((state) => state.copySelectedTileRegion);
  const hoveredTile = useEditorStore((state) => state.hoveredTile);
  const loadMapFromRaw = useEditorStore((state) => state.loadMapFromRaw);
  const pasteTileClipboard = useEditorStore((state) => state.pasteTileClipboard);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const visibleTiles = useEditorStore(
    (state) =>
      state.renderPlan.ground.length +
      state.renderPlan.objects.length +
      state.renderPlan.overlay.length,
  );
  const mapName = useEditorStore((state) => state.mapName);
  const mapDocument = useEditorStore((state) => state.mapDocument);
  const structureCount = useEditorStore((state) => state.structureOverlays.length);
  const spawnCount = useEditorStore((state) => state.spawnPointOverlays.length);
  const regionCount = useEditorStore((state) => state.regionMarkerOverlays.length);
  const tileClipboard = useEditorStore((state) => state.tileClipboard);
  const undoCount = useEditorStore((state) => state.history.undoStack.length);
  const redoCount = useEditorStore((state) => state.history.redoStack.length);
  const zoomByStep = useEditorStore((state) => state.zoomByStep);
  const mapWidth = useEditorStore((state) => state.map.width);
  const mapHeight = useEditorStore((state) => state.map.height);
  const map = useEditorStore((state) => state.map);
  const selectedSelection = useEditorStore((state) => state.selectedSelection);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const deleteSelectedObject = useEditorStore((state) => state.deleteSelectedObject);
  const tilesetName = map.tilesets[0]?.name ?? 'tileset';
  const selectedStructure =
    selectedSelection?.layerName === 'structures'
      ? findStructureByObjectId(map.structures, selectedSelection.objectId)
      : null;
  const selectedSpawnPoint =
    selectedSelection?.layerName === 'spawn_points'
      ? findTilemapObjectById(map.spawnPoints, selectedSelection.objectId)
      : null;
  const selectedRegionMarker =
    selectedSelection?.layerName === 'region_markers'
      ? findTilemapObjectById(map.regionMarkers, selectedSelection.objectId)
      : null;
  const selectedLabel = selectedStructure
    ? selectedStructure.label ?? selectedStructure.name
    : selectedSpawnPoint
      ? selectedSpawnPoint.name
      : selectedRegionMarker
        ? selectedRegionMarker.name
        : 'nenhuma';
  const serializedMap = useMemo(
    () => serializeEditorMapDocument(mapDocument),
    [mapDocument],
  );
  const documentSignature = useMemo(
    () => JSON.stringify(serializedMap),
    [serializedMap],
  );
  const validation = useMemo(
    () => validateSerializedMap(serializedMap),
    [serializedMap],
  );
  const [currentFileHandle, setCurrentFileHandle] = useState<BrowserWritableFileHandle | null>(null);
  const [currentFileName, setCurrentFileName] = useState('zona_norte.json');
  const [loadedSignature, setLoadedSignature] = useState(() => documentSignature);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [newMapWidth, setNewMapWidth] = useState(String(mapWidth));
  const [newMapHeight, setNewMapHeight] = useState(String(mapHeight));
  const isDirty = documentSignature !== loadedSignature;
  const canReload = currentFileHandle !== null || loadedSnapshotRef.current !== null;
  const canSave = validation.errors.length === 0;
  const draftLabel = useEditorDraftPersistence({
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
  });

  useEditorFileDrop({
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
  });

  async function loadRawMap(input: {
    fileHandle?: BrowserWritableFileHandle | null;
    fileName: string;
    rawMap: Record<string, unknown>;
    status: string;
  }) {
    const normalizedSnapshot = buildNormalizedSnapshot(input.rawMap);

    loadedSnapshotRef.current = normalizedSnapshot;
    setCurrentFileHandle(input.fileHandle ?? null);
    setCurrentFileName(ensureJsonFileName(input.fileName));
    setLoadedSignature(JSON.stringify(normalizedSnapshot));
    setNewMapWidth(String(readSnapshotDimension(normalizedSnapshot, 'width', mapWidth)));
    setNewMapHeight(String(readSnapshotDimension(normalizedSnapshot, 'height', mapHeight)));
    setStatusMessage(input.status);
    loadMapFromRaw(normalizedSnapshot, {
      mapName: buildMapDisplayName(input.fileName),
    });
  }

  async function handleOpenFile(file: File) {
    try {
      const text = await file.text();
      const rawMap = JSON.parse(text) as Record<string, unknown>;
      await loadRawMap({
        fileHandle: null,
        fileName: file.name,
        rawMap,
        status: `Arquivo aberto: ${file.name}.`,
      });
    } catch (error) {
      setStatusMessage(
        `Falha ao abrir JSON: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }.`,
      );
    }
  }

  async function handleSave(input?: { forceDownload?: boolean; forceSaveAs?: boolean }) {
    if (!canSave) {
      setStatusMessage('Corrija os erros de validacao antes de salvar.');
      return;
    }

    const fileName = ensureJsonFileName(currentFileName);
    const json = JSON.stringify(serializedMap, null, 2);

    try {
      if (!input?.forceDownload && !input?.forceSaveAs && currentFileHandle) {
        await writeTextToFileHandle(currentFileHandle, json);
        loadedSnapshotRef.current = serializedMap;
        setLoadedSignature(documentSignature);
        setStatusMessage(`Arquivo salvo em disco: ${fileName}.`);
        return;
      }

      if (!input?.forceDownload) {
        const pickedHandle = await showJsonSaveFilePicker(fileName);

        if (pickedHandle) {
          await writeTextToFileHandle(pickedHandle, json);
          loadedSnapshotRef.current = serializedMap;
          setCurrentFileHandle(pickedHandle);
          setCurrentFileName(ensureJsonFileName(pickedHandle.name ?? fileName));
          setLoadedSignature(documentSignature);
          setStatusMessage(`Arquivo salvo em disco: ${pickedHandle.name ?? fileName}.`);
          return;
        }
      }

      const promptedFileName = input?.forceSaveAs
        ? window.prompt('Nome do arquivo JSON', fileName) ?? ''
        : fileName;
      const downloadFileName = ensureJsonFileName(promptedFileName, fileName);

      downloadTextFile({
        contents: json,
        fileName: downloadFileName,
      });

      if (input?.forceDownload) {
        setStatusMessage(`Download iniciado: ${downloadFileName}.`);
        return;
      }

      loadedSnapshotRef.current = serializedMap;
      setCurrentFileHandle(null);
      setCurrentFileName(downloadFileName);
      setLoadedSignature(documentSignature);
      setStatusMessage(`Arquivo salvo por download: ${downloadFileName}.`);
    } catch (error) {
      if (isAbortError(error)) {
        setStatusMessage('Operacao de salvamento cancelada.');
        return;
      }

      setStatusMessage(
        `Falha ao salvar JSON: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }.`,
      );
    }
  }
  handleSaveRef.current = handleSave;

  async function handleReload() {
    if (currentFileHandle) {
      try {
        const file = await currentFileHandle.getFile();
        const text = await file.text();
        const rawMap = JSON.parse(text) as Record<string, unknown>;
        await loadRawMap({
          fileHandle: currentFileHandle,
          fileName: currentFileHandle.name ?? file.name ?? currentFileName,
          rawMap,
          status: `Arquivo recarregado do disco: ${currentFileHandle.name ?? file.name}.`,
        });
        return;
      } catch (error) {
        setStatusMessage(
          `Falha ao recarregar do disco: ${
            error instanceof Error ? error.message : 'erro desconhecido'
          }.`,
        );
        return;
      }
    }

    if (loadedSnapshotRef.current) {
      await loadRawMap({
        fileHandle: null,
        fileName: currentFileName,
        rawMap: loadedSnapshotRef.current,
        status: `Documento recarregado do ultimo snapshot: ${currentFileName}.`,
      });
    }
  }

  function handleCreateNewMap() {
    const width = Number(newMapWidth);
    const height = Number(newMapHeight);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      setStatusMessage('Dimensoes invalidas para criar um novo mapa.');
      return;
    }

    const nextMapDocument = createEmptyMapDocument({
      height,
      templateDocument: mapDocument,
      tilesetName,
      width,
    });
    const rawMap = serializeEditorMapDocument(nextMapDocument);

    loadedSnapshotRef.current = rawMap;
    setCurrentFileHandle(null);
    setCurrentFileName('novo_mapa.json');
    setLoadedSignature(JSON.stringify(rawMap));
    setNewMapOpen(false);
    setStatusMessage(`Novo mapa criado: ${width}x${height}.`);
    loadMapFromRaw(rawMap, {
      mapName: 'Novo Mapa',
    });
  }

  async function handleExportViewportPng() {
    try {
      const exported = await mapCanvasRef.current?.exportViewportPng(
        currentFileName.replace(/\.json$/i, '.viewport.png'),
      );

      if (exported) {
        setStatusMessage(`PNG da viewport exportado: ${currentFileName.replace(/\.json$/i, '.viewport.png')}.`);
        return;
      }

      setStatusMessage('Canvas da viewport indisponivel para exportar PNG.');
    } catch (error) {
      setStatusMessage(
        `Falha ao exportar PNG da viewport: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }.`,
      );
    }
  }

  async function handleExportMapPng() {
    try {
      const exported = await mapCanvasRef.current?.exportFullMapPng(
        currentFileName.replace(/\.json$/i, '.mapa.png'),
      );

      if (exported) {
        setStatusMessage(`PNG do mapa exportado: ${currentFileName.replace(/\.json$/i, '.mapa.png')}.`);
        return;
      }

      setStatusMessage('Canvas do mapa indisponivel para exportar PNG.');
    } catch (error) {
      setStatusMessage(
        `Falha ao exportar PNG do mapa: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }.`,
      );
    }
  }

  useEditorKeyboardShortcuts({
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
  });

  return (
    <main className="editor-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void handleOpenFile(file);
          }

          event.target.value = '';
        }}
      />

      {isDraggingFile ? (
        <div className="drop-overlay">
          <strong>Solte um JSON Tiled para abrir</strong>
          <span>O documento atual sera substituido pela versao importada.</span>
        </div>
      ) : null}

      <section className="editor-sidebar">
        <div className="panel panel-hero">
          <p className="eyebrow">Editor de Mapa</p>
          <h1>{mapName}</h1>
          <p className="panel-copy">
            {mapWidth}x{mapHeight} tiles &bull; {structureCount} estruturas &bull; {spawnCount} spawns &bull; {regionCount} regions
          </p>
          <div className="hero-quick-actions">
            <span className="hero-status">
              Layer: <strong>{activeLayerName}</strong> &bull; Tool: <strong>{activeTool}</strong>
              {isDirty ? ' &bull; nao salvo' : ''}
            </span>
          </div>
        </div>

        <DocumentPanel
          canReload={canReload}
          canSave={canSave}
          currentFileName={currentFileName}
          draftLabel={draftLabel}
          isDirty={isDirty}
          newMapHeight={newMapHeight}
          newMapOpen={newMapOpen}
          newMapWidth={newMapWidth}
          onChangeNewMapHeight={setNewMapHeight}
          onChangeNewMapWidth={setNewMapWidth}
          onCloseNewMap={() => setNewMapOpen(false)}
          onConfirmNewMap={handleCreateNewMap}
          onExport={() => {
            void handleSave({ forceDownload: true });
          }}
          onExportMapPng={() => {
            void handleExportMapPng();
          }}
          onExportViewportPng={() => {
            void handleExportViewportPng();
          }}
          onOpen={() => fileInputRef.current?.click()}
          onOpenNewMap={() => setNewMapOpen(true)}
          onReload={() => {
            void handleReload();
          }}
          onSave={() => {
            void handleSave();
          }}
          onSaveAs={() => {
            void handleSave({ forceSaveAs: true });
          }}
          statusMessage={statusMessage}
          tilesetName={tilesetName}
          validationErrors={validation.errors}
          validationWarnings={validation.warnings}
        />

        <EditorStatsPanel
          activeLayerName={activeLayerName}
          activeTool={activeTool}
          cameraZoom={cameraZoom}
          currentFileName={currentFileName}
          hoveredTile={hoveredTile}
          isDirty={isDirty}
          mapHeight={mapHeight}
          mapWidth={mapWidth}
          redoCount={redoCount}
          regionCount={regionCount}
          selectedLabel={selectedLabel}
          spawnCount={spawnCount}
          structureCount={structureCount}
          tileClipboardLabel={
            tileClipboard
              ? `${tileClipboard.width}x${tileClipboard.height} • ${tileClipboard.layerName}`
              : 'vazio'
          }
          undoCount={undoCount}
          visibleTiles={visibleTiles}
        />

        <ToolBar />
        <TilePalette />
        <StructureCatalog />
        <PropertyPanel />
        <LayerPanel />

        <div className="panel panel-help">
          <h2>Como usar</h2>

          <div className="help-section">
            <strong>Atalhos de ferramentas</strong>
            <p><kbd>B</kbd> Paint &bull; <kbd>E</kbd> Erase &bull; <kbd>V</kbd> Select &bull; <kbd>P</kbd> Place &bull; <kbd>X</kbd> Delete &bull; <kbd>I</kbd> Eyedropper</p>
          </div>

          <div className="help-section">
            <strong>Adicionar estrutura</strong>
            <p>1. Escolha uma estrutura no catalogo (ativa Place automaticamente)</p>
            <p>2. Clique no mapa para posicionar</p>
          </div>

          <div className="help-section">
            <strong>Mover estrutura / marcador</strong>
            <p>1. Pressione <kbd>V</kbd> (Select)</p>
            <p>2. Clique no objeto e arraste para nova posicao</p>
          </div>

          <div className="help-section">
            <strong>Remover estrutura / spawn / region</strong>
            <p>Opcao A: <kbd>X</kbd> (Delete tool) + clique no objeto</p>
            <p>Opcao B: <kbd>V</kbd> (Select) + clique no objeto + <kbd>Delete</kbd> ou <kbd>Backspace</kbd></p>
            <p>Opcao C: Select + painel Propriedades + botao "Remover"</p>
          </div>

          <div className="help-section">
            <strong>Adicionar spawn / region</strong>
            <p>1. No painel Layers, clique em spawn_points ou region_markers</p>
            <p>2. Pressione <kbd>P</kbd> (Place) e clique no mapa</p>
          </div>

          <div className="help-section">
            <strong>Pintar collision</strong>
            <p>1. No painel Layers, clique em collision</p>
            <p>2. Pressione <kbd>B</kbd> (Paint) e clique no mapa (alterna on/off)</p>
            <p>3. Ative o overlay "Collision" em Ferramentas para visualizar</p>
          </div>

          <div className="help-section">
            <strong>Navegacao</strong>
            <p>Scroll: zoom &bull; <kbd>Shift</kbd>+arraste / <kbd>Space</kbd>+arraste / botao do meio: pan</p>
            <p><kbd>Ctrl+Z</kbd> undo &bull; <kbd>Ctrl+Shift+Z</kbd> redo &bull; <kbd>Ctrl+S</kbd> salvar</p>
            <p>Arraste um .json para a janela para abrir</p>
          </div>
        </div>
      </section>

      <section className="editor-stage">
        <MapCanvas ref={mapCanvasRef} />
      </section>
    </main>
  );
}
