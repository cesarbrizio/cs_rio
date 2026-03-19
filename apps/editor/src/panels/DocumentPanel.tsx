interface DocumentPanelProps {
  canReload: boolean;
  canSave: boolean;
  currentFileName: string;
  draftLabel: string | null;
  isDirty: boolean;
  newMapHeight: string;
  newMapOpen: boolean;
  newMapWidth: string;
  onChangeNewMapHeight: (value: string) => void;
  onChangeNewMapWidth: (value: string) => void;
  onCloseNewMap: () => void;
  onConfirmNewMap: () => void;
  onExport: () => void;
  onExportMapPng: () => void;
  onExportViewportPng: () => void;
  onOpen: () => void;
  onOpenNewMap: () => void;
  onReload: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  statusMessage: string | null;
  tilesetName: string;
  validationErrors: string[];
  validationWarnings: string[];
}

export function DocumentPanel(props: DocumentPanelProps) {
  return (
    <section className="panel panel-document">
      <div className="panel-section-head">
        <h2>Documento</h2>
        <span>{props.isDirty ? 'alterado' : 'sincronizado'}</span>
      </div>

      <div className="document-meta">
        <strong>{props.currentFileName}</strong>
        <span>{props.tilesetName}</span>
      </div>

      {props.draftLabel ? <p className="panel-note">{props.draftLabel}</p> : null}

      <div className="document-actions">
        <button type="button" className="chip-button" onClick={props.onOpenNewMap}>
          Novo
        </button>
        <button type="button" className="chip-button" onClick={props.onOpen}>
          Abrir
        </button>
        <button
          type="button"
          className="chip-button is-active"
          disabled={!props.canSave}
          onClick={props.onSave}
        >
          Salvar
        </button>
        <button
          type="button"
          className="chip-button"
          disabled={!props.canSave}
          onClick={props.onSaveAs}
        >
          Salvar Como
        </button>
        <button type="button" className="chip-button" onClick={props.onExport}>
          Exportar
        </button>
        <button type="button" className="chip-button" onClick={props.onExportViewportPng}>
          PNG View
        </button>
        <button type="button" className="chip-button" onClick={props.onExportMapPng}>
          PNG Map
        </button>
        <button
          type="button"
          className="chip-button"
          disabled={!props.canReload}
          onClick={props.onReload}
        >
          Recarregar
        </button>
      </div>

      {props.statusMessage ? <p className="panel-note">{props.statusMessage}</p> : null}

      {props.validationErrors.length > 0 ? (
        <div className="validation-block validation-block-error">
          <strong>Validacao</strong>
          {props.validationErrors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </div>
      ) : null}

      {props.validationWarnings.length > 0 ? (
        <div className="validation-block">
          <strong>Avisos</strong>
          {props.validationWarnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}

      {props.newMapOpen ? (
        <form
          className="new-map-form"
          onSubmit={(event) => {
            event.preventDefault();
            props.onConfirmNewMap();
          }}
        >
          <div className="panel-section-head panel-section-head-compact">
            <h3>Novo mapa</h3>
            <button type="button" className="chip-button" onClick={props.onCloseNewMap}>
              Fechar
            </button>
          </div>

          <div className="property-grid">
            <label className="property-field">
              <span>Largura</span>
              <input
                type="number"
                min="1"
                value={props.newMapWidth}
                onChange={(event) => props.onChangeNewMapWidth(event.target.value)}
              />
            </label>

            <label className="property-field">
              <span>Altura</span>
              <input
                type="number"
                min="1"
                value={props.newMapHeight}
                onChange={(event) => props.onChangeNewMapHeight(event.target.value)}
              />
            </label>
          </div>

          <div className="property-readonly">
            <strong>Tileset padrão</strong>
            <span>{props.tilesetName}</span>
          </div>

          <div className="property-actions">
            <button type="submit" className="chip-button is-active">
              Criar
            </button>
            <button type="button" className="chip-button" onClick={props.onCloseNewMap}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
