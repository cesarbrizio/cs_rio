import { useEffect, useState } from 'react';

import { MAP_STRUCTURE_CATALOG } from '@shared/map/structureCatalog';

import {
  buildRegionMarkerDraft,
  buildSpawnPointDraft,
  findTilemapObjectById,
  type RegionMarkerDraft,
  type SpawnPointDraft,
} from '../objects/objectLayerEditing';
import { useEditorStore } from '../state/editorStore';
import {
  buildStructurePropertyDraft,
  findStructureByObjectId,
  type StructurePropertyDraft,
} from '../structures/structureEditing';

function buildEmptyStructureDraft(): StructurePropertyDraft {
  return {
    footprintH: 1,
    footprintW: 1,
    interactiveEntityId: '',
    kind: 'boca',
    label: '',
    name: '',
  };
}

function buildEmptySpawnDraft(): SpawnPointDraft {
  return {
    name: '',
    spawnId: '',
    type: 'spawn',
  };
}

function buildEmptyRegionDraft(): RegionMarkerDraft {
  return {
    name: '',
    properties: [],
    type: 'region',
  };
}

export function PropertyPanel() {
  const applySelectedRegionMarkerProperties = useEditorStore(
    (state) => state.applySelectedRegionMarkerProperties,
  );
  const applySelectedSpawnPointProperties = useEditorStore(
    (state) => state.applySelectedSpawnPointProperties,
  );
  const applySelectedStructureProperties = useEditorStore(
    (state) => state.applySelectedStructureProperties,
  );
  const deleteSelectedObject = useEditorStore((state) => state.deleteSelectedObject);
  const map = useEditorStore((state) => state.map);
  const selectedSelection = useEditorStore((state) => state.selectedSelection);
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
  const [structureDraft, setStructureDraft] = useState<StructurePropertyDraft>(
    buildEmptyStructureDraft(),
  );
  const [spawnDraft, setSpawnDraft] = useState<SpawnPointDraft>(buildEmptySpawnDraft());
  const [regionDraft, setRegionDraft] = useState<RegionMarkerDraft>(buildEmptyRegionDraft());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedStructure) {
      setStructureDraft(buildStructurePropertyDraft(selectedStructure));
      setError(null);
      return;
    }

    setStructureDraft(buildEmptyStructureDraft());
  }, [selectedStructure]);

  useEffect(() => {
    if (selectedSpawnPoint) {
      setSpawnDraft(buildSpawnPointDraft(selectedSpawnPoint));
      setError(null);
      return;
    }

    setSpawnDraft(buildEmptySpawnDraft());
  }, [selectedSpawnPoint]);

  useEffect(() => {
    if (selectedRegionMarker) {
      setRegionDraft(buildRegionMarkerDraft(selectedRegionMarker));
      setError(null);
      return;
    }

    setRegionDraft(buildEmptyRegionDraft());
  }, [selectedRegionMarker]);

  return (
    <section className="panel panel-properties">
      <div className="panel-section-head">
        <h2>Propriedades</h2>
        <span>
          {selectedSelection ? `objeto ${selectedSelection.objectId}` : 'sem seleção'}
        </span>
      </div>

      {!selectedSelection ? (
        <div className="context-hint">
          Nenhum objeto selecionado. Para selecionar: pressione <kbd>V</kbd> (Select), escolha a layer desejada (structures, spawn_points ou region_markers) e clique no objeto no mapa. Depois edite as propriedades aqui ou pressione <kbd>Delete</kbd> para remover.
        </div>
      ) : null}

      {selectedStructure ? (
        <form
          className="property-form"
          onSubmit={(event) => {
            event.preventDefault();
            const applied = applySelectedStructureProperties(structureDraft);
            setError(applied ? null : 'Nao foi possivel aplicar: conflito com outra estrutura.');
          }}
        >
          <label className="property-field">
            <span>Kind</span>
            <select
              value={structureDraft.kind}
              onChange={(event) =>
                setStructureDraft((currentDraft) => ({
                  ...currentDraft,
                  kind: event.target.value as StructurePropertyDraft['kind'],
                }))
              }
            >
              {Object.values(MAP_STRUCTURE_CATALOG).map((entry) => (
                <option key={entry.kind} value={entry.kind}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="property-field">
            <span>Nome</span>
            <input
              value={structureDraft.name}
              onChange={(event) =>
                setStructureDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <label className="property-field">
            <span>Label</span>
            <input
              value={structureDraft.label}
              onChange={(event) =>
                setStructureDraft((currentDraft) => ({
                  ...currentDraft,
                  label: event.target.value,
                }))
              }
            />
          </label>

          <label className="property-field">
            <span>Interactive ID</span>
            <input
              value={structureDraft.interactiveEntityId}
              onChange={(event) =>
                setStructureDraft((currentDraft) => ({
                  ...currentDraft,
                  interactiveEntityId: event.target.value,
                }))
              }
            />
          </label>

          <div className="property-grid">
            <label className="property-field">
              <span>Footprint W</span>
              <input
                type="number"
                min="1"
                value={structureDraft.footprintW}
                onChange={(event) =>
                  setStructureDraft((currentDraft) => ({
                    ...currentDraft,
                    footprintW: Number(event.target.value || 1),
                  }))
                }
              />
            </label>

            <label className="property-field">
              <span>Footprint H</span>
              <input
                type="number"
                min="1"
                value={structureDraft.footprintH}
                onChange={(event) =>
                  setStructureDraft((currentDraft) => ({
                    ...currentDraft,
                    footprintH: Number(event.target.value || 1),
                  }))
                }
              />
            </label>
          </div>

          <div className="property-readonly">
            <strong>Grid</strong>
            <span>
              {selectedStructure.gridX}, {selectedStructure.gridY}
            </span>
          </div>

          {error ? <p className="panel-error">{error}</p> : null}

          <div className="property-actions">
            <button type="submit" className="chip-button is-active">
              Aplicar
            </button>
            <button
              type="button"
              className="chip-button"
              onClick={() => {
                deleteSelectedObject();
              }}
            >
              Remover
            </button>
          </div>
        </form>
      ) : null}

      {selectedSpawnPoint ? (
        <form
          className="property-form"
          onSubmit={(event) => {
            event.preventDefault();
            const applied = applySelectedSpawnPointProperties(spawnDraft);
            setError(applied ? null : 'Nao foi possivel aplicar as propriedades do spawn.');
          }}
        >
          <label className="property-field">
            <span>Nome</span>
            <input
              value={spawnDraft.name}
              onChange={(event) =>
                setSpawnDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <label className="property-field">
            <span>Type</span>
            <input
              value={spawnDraft.type}
              onChange={(event) =>
                setSpawnDraft((currentDraft) => ({
                  ...currentDraft,
                  type: event.target.value,
                }))
              }
            />
          </label>

          <label className="property-field">
            <span>spawnId</span>
            <input
              value={spawnDraft.spawnId}
              onChange={(event) =>
                setSpawnDraft((currentDraft) => ({
                  ...currentDraft,
                  spawnId: event.target.value,
                }))
              }
            />
          </label>

          <div className="property-readonly">
            <strong>Grid</strong>
            <span>
              {selectedSpawnPoint.gridX}, {selectedSpawnPoint.gridY}
            </span>
          </div>

          {error ? <p className="panel-error">{error}</p> : null}

          <div className="property-actions">
            <button type="submit" className="chip-button is-active">
              Aplicar
            </button>
            <button
              type="button"
              className="chip-button"
              onClick={() => {
                deleteSelectedObject();
              }}
            >
              Remover
            </button>
          </div>
        </form>
      ) : null}

      {selectedRegionMarker ? (
        <form
          className="property-form"
          onSubmit={(event) => {
            event.preventDefault();
            const applied = applySelectedRegionMarkerProperties(regionDraft);
            setError(applied ? null : 'Nao foi possivel aplicar as propriedades da region.');
          }}
        >
          <label className="property-field">
            <span>Nome</span>
            <input
              value={regionDraft.name}
              onChange={(event) =>
                setRegionDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <label className="property-field">
            <span>Type</span>
            <input
              value={regionDraft.type}
              onChange={(event) =>
                setRegionDraft((currentDraft) => ({
                  ...currentDraft,
                  type: event.target.value,
                }))
              }
            />
          </label>

          <div className="panel-section-head panel-section-head-compact">
            <h3>Custom Properties</h3>
            <button
              type="button"
              className="chip-button"
              onClick={() =>
                setRegionDraft((currentDraft) => ({
                  ...currentDraft,
                  properties: [
                    ...currentDraft.properties,
                    {
                      key: '',
                      value: '',
                    },
                  ],
                }))
              }
            >
              Adicionar
            </button>
          </div>

          <div className="property-list">
            {regionDraft.properties.length === 0 ? (
              <p className="panel-note">Nenhuma property customizada nesta region.</p>
            ) : null}

            {regionDraft.properties.map((entry, index) => (
              <div key={`${index}:${entry.key}`} className="property-list-row">
                <input
                  value={entry.key}
                  placeholder="key"
                  onChange={(event) =>
                    setRegionDraft((currentDraft) => ({
                      ...currentDraft,
                      properties: currentDraft.properties.map((propertyEntry, entryIndex) =>
                        entryIndex === index
                          ? {
                              ...propertyEntry,
                              key: event.target.value,
                            }
                          : propertyEntry,
                      ),
                    }))
                  }
                />
                <input
                  value={entry.value}
                  placeholder="value"
                  onChange={(event) =>
                    setRegionDraft((currentDraft) => ({
                      ...currentDraft,
                      properties: currentDraft.properties.map((propertyEntry, entryIndex) =>
                        entryIndex === index
                          ? {
                              ...propertyEntry,
                              value: event.target.value,
                            }
                          : propertyEntry,
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="chip-button"
                  onClick={() =>
                    setRegionDraft((currentDraft) => ({
                      ...currentDraft,
                      properties: currentDraft.properties.filter((_, entryIndex) => entryIndex !== index),
                    }))
                  }
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="property-readonly">
            <strong>Grid</strong>
            <span>
              {selectedRegionMarker.gridX}, {selectedRegionMarker.gridY}
            </span>
          </div>

          {error ? <p className="panel-error">{error}</p> : null}

          <div className="property-actions">
            <button type="submit" className="chip-button is-active">
              Aplicar
            </button>
            <button
              type="button"
              className="chip-button"
              onClick={() => {
                deleteSelectedObject();
              }}
            >
              Remover
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
