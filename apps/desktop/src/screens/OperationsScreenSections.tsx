import type {
  GpTemplateSummary,
  OwnedPropertySummary,
  PropertyCatalogResponse,
  PropertyDefinitionSummary,
  PuteiroListResponse,
  PuteiroSummary,
  SlotMachineSummary,
} from '@cs-rio/shared';
import {
  formatOperationsCurrency,
  resolvePropertyAssetClassLabel,
  resolvePropertyRegionLabel,
  resolvePropertyStockLabel,
  resolvePropertyTypeLabel,
  resolvePropertyUtilityLines,
  resolvePuteiroWorkerStatusLabel,
  type PropertyOperationSnapshot,
  type PuteiroDashboardSnapshot,
} from '@cs-rio/ui/hooks';

import { Badge, Button, Card, ContextMenu } from '../components/ui';
import { MetricCard } from './shared/DesktopScreenPrimitives';

interface OperationsPropertyListPanelProps {
  filteredProperties: OwnedPropertySummary[];
  selectedPropertyId: string | null;
  onSelectProperty: (propertyId: string) => void;
}

interface OperationsSelectedPropertyPanelProps {
  isMutating: boolean;
  onCollect: () => void;
  onConfigureSlotMachine: () => void;
  onHireGps: () => void;
  onHireSoldiers: () => void;
  onInstallSlotMachines: () => void;
  onSelectGpType: (type: GpTemplateSummary['type']) => void;
  onSelectSoldierType: (type: string) => void;
  onSlotMachineHouseEdgeInputChange: (value: string) => void;
  onSlotMachineInstallQuantityInputChange: (value: string) => void;
  onSlotMachineJackpotInputChange: (value: string) => void;
  onSlotMachineMaxBetInputChange: (value: string) => void;
  onSlotMachineMinBetInputChange: (value: string) => void;
  onUpgrade: () => void;
  puteiroSnapshot: PuteiroDashboardSnapshot | null;
  puteiroTemplates: PuteiroListResponse['templates'];
  selectedGpTemplate: GpTemplateSummary | null;
  selectedOperation: PropertyOperationSnapshot | null;
  selectedProperty: OwnedPropertySummary | null;
  selectedPuteiro: PuteiroSummary | null;
  selectedSlotMachine: SlotMachineSummary | null;
  selectedSoldierTemplate: PropertyCatalogResponse['soldierTemplates'][number] | null;
  slotMachineHouseEdgeInput: string;
  slotMachineInstallQuantityInput: string;
  slotMachineJackpotInput: string;
  slotMachineMaxBetInput: string;
  slotMachineMinBetInput: string;
  unlockedSoldierTemplates: PropertyCatalogResponse['soldierTemplates'];
}

interface OperationsCatalogPanelProps {
  availableProperties: PropertyCatalogResponse['availableProperties'];
  canPurchaseSelectedCatalogProperty: boolean;
  isMutating: boolean;
  onPurchase: () => void;
  onSelectCatalogType: (type: string) => void;
  playerMoney: number;
  selectedCatalogProperty: PropertyDefinitionSummary | null;
}

export function OperationsPropertyListPanel({
  filteredProperties,
  onSelectProperty,
  selectedPropertyId,
}: OperationsPropertyListPanelProps): JSX.Element {
  return (
    <Card className="desktop-panel">
      <div className="desktop-panel__header">
        <h3>Ativos</h3>
        <Badge tone="neutral">{filteredProperties.length}</Badge>
      </div>
      <div className="desktop-scroll-list">
        {filteredProperties.map((property) => (
          <ContextMenu
            items={[
              {
                id: 'focus-property',
                label: 'Interagir com estrutura',
                onSelect: () => onSelectProperty(property.id),
              },
              {
                id: 'open-property',
                label: 'Abrir detalhes',
                onSelect: () => onSelectProperty(property.id),
              },
            ]}
            key={property.id}
          >
            <button
              className={`desktop-list-row desktop-list-row--clickable ${
                selectedPropertyId === property.id ? 'desktop-list-row--active' : ''
              }`}
              onClick={() => onSelectProperty(property.id)}
              type="button"
            >
              <div className="desktop-list-row__headline">
                <strong>{property.definition.label}</strong>
                <Badge tone="neutral">{resolvePropertyAssetClassLabel(property.definition)}</Badge>
              </div>
              <small>
                {resolvePropertyTypeLabel(property.type)} · {resolvePropertyRegionLabel(property.regionId)}
              </small>
              <small>
                Renda {formatOperationsCurrency(property.economics.dailyIncome)}/dia · custo{' '}
                {formatOperationsCurrency(property.economics.dailyExpense)}/dia
              </small>
            </button>
          </ContextMenu>
        ))}
      </div>
    </Card>
  );
}

export function OperationsSelectedPropertyPanel({
  isMutating,
  onCollect,
  onConfigureSlotMachine,
  onHireGps,
  onHireSoldiers,
  onInstallSlotMachines,
  onSelectGpType,
  onSelectSoldierType,
  onSlotMachineHouseEdgeInputChange,
  onSlotMachineInstallQuantityInputChange,
  onSlotMachineJackpotInputChange,
  onSlotMachineMaxBetInputChange,
  onSlotMachineMinBetInputChange,
  onUpgrade,
  puteiroSnapshot,
  puteiroTemplates,
  selectedGpTemplate,
  selectedOperation,
  selectedProperty,
  selectedPuteiro,
  selectedSlotMachine,
  selectedSoldierTemplate,
  slotMachineHouseEdgeInput,
  slotMachineInstallQuantityInput,
  slotMachineJackpotInput,
  slotMachineMaxBetInput,
  slotMachineMinBetInput,
  unlockedSoldierTemplates,
}: OperationsSelectedPropertyPanelProps): JSX.Element | null {
  if (!selectedProperty) {
    return null;
  }

  return (
    <Card className="desktop-panel">
      <div className="desktop-panel__header">
        <div>
          <h3>{selectedProperty.definition.label}</h3>
          <p>
            {resolvePropertyTypeLabel(selectedProperty.type)} ·{' '}
            {resolvePropertyRegionLabel(selectedProperty.regionId)} ·{' '}
            {resolvePropertyAssetClassLabel(selectedProperty.definition)}
          </p>
        </div>
        <Badge tone={selectedOperation?.readyToCollect ? 'success' : 'neutral'}>
          {selectedOperation?.statusLabel ?? 'Sem snapshot'}
        </Badge>
      </div>
      <div className="desktop-grid-3">
        <MetricCard label="Nivel" tone="info" value={`${selectedProperty.level}`} />
        <MetricCard
          label="Renda/dia"
          tone="success"
          value={formatOperationsCurrency(selectedProperty.economics.dailyIncome)}
        />
        <MetricCard
          label="Custo/dia"
          tone="warning"
          value={formatOperationsCurrency(selectedProperty.economics.dailyExpense)}
        />
      </div>
      <div className="desktop-grid-3">
        <MetricCard
          label="Risco invasao"
          tone="danger"
          value={`${Math.round(selectedProperty.protection.invasionRisk)}%`}
        />
        <MetricCard
          label="Risco roubo"
          tone="warning"
          value={`${Math.round(selectedProperty.protection.robberyRisk)}%`}
        />
        <MetricCard
          label="Defesa"
          tone="info"
          value={`${Math.round(selectedProperty.protection.defenseScore)}`}
        />
      </div>
      <div className="desktop-detail-list">
        {(selectedOperation?.detailLines ?? resolvePropertyUtilityLines(selectedProperty.definition)).map((line) => (
          <div key={line}>
            <strong>Operacao</strong>
            <small>{line}</small>
          </div>
        ))}
        {selectedOperation ? (
          <div>
            <strong>Coleta</strong>
            <small>
              {selectedOperation.collectableLabel} · estimativa {selectedOperation.estimatedHourlyLabel}
            </small>
          </div>
        ) : null}
        <div>
          <strong>Slot</strong>
          <small>{selectedProperty.slotId ?? 'Sem slot mapeado'}</small>
        </div>
      </div>
      <div className="desktop-inline-actions">
        <Button
          disabled={isMutating || !selectedOperation?.readyToCollect}
          onClick={onCollect}
          variant="primary"
        >
          {isMutating ? 'Processando...' : selectedOperation?.actionLabel ?? 'Coletar'}
        </Button>
        <Button disabled={isMutating} onClick={onUpgrade} variant="secondary">
          Melhorar ativo
        </Button>
        <Button
          disabled={isMutating || !selectedProperty.definition.soldierCapacity || !selectedSoldierTemplate}
          onClick={onHireSoldiers}
          variant="ghost"
        >
          Enviar seguranca
        </Button>
      </div>
      {selectedProperty.definition.soldierCapacity > 0 ? (
        <div className="desktop-detail-list">
          <div>
            <strong>Seguranca</strong>
            <small>
              {selectedSoldierTemplate
                ? `${selectedSoldierTemplate.label} · ${formatOperationsCurrency(
                    selectedSoldierTemplate.dailyCost,
                  )}/dia`
                : 'Nenhum template desbloqueado'}
            </small>
          </div>
          {unlockedSoldierTemplates.length > 0 ? (
            <div>
              <strong>Template</strong>
              <small>
                <select
                  onChange={(event) => onSelectSoldierType(event.target.value)}
                  value={selectedSoldierTemplate?.type ?? undefined}
                >
                  {unlockedSoldierTemplates.map((template) => (
                    <option key={template.type} value={template.type}>
                      {template.label} · poder {template.power}
                    </option>
                  ))}
                </select>
              </small>
            </div>
          ) : null}
        </div>
      ) : null}
      {selectedSlotMachine ? (
        <div className="desktop-detail-list">
          <div>
            <strong>Maquininha</strong>
            <small>
              {selectedSlotMachine.economics.installedMachines}/{selectedSlotMachine.economics.capacity}{' '}
              maquinas ·{' '}
              {formatOperationsCurrency(selectedSlotMachine.economics.estimatedHourlyGrossRevenue)}/h
            </small>
          </div>
          <div>
            <strong>Instalar</strong>
            <small>
              <input
                inputMode="numeric"
                onChange={(event) =>
                  onSlotMachineInstallQuantityInputChange(
                    event.target.value.replace(/[^0-9]/g, ''),
                  )
                }
                value={slotMachineInstallQuantityInput}
              />
            </small>
          </div>
          <div>
            <strong>Configurar</strong>
            <small>
              <input
                onChange={(event) => onSlotMachineHouseEdgeInputChange(event.target.value)}
                value={slotMachineHouseEdgeInput}
              />
              {' · '}
              <input
                onChange={(event) => onSlotMachineJackpotInputChange(event.target.value)}
                value={slotMachineJackpotInput}
              />
              {' · '}
              <input
                onChange={(event) =>
                  onSlotMachineMinBetInputChange(event.target.value.replace(/[^0-9]/g, ''))
                }
                value={slotMachineMinBetInput}
              />
              {' → '}
              <input
                onChange={(event) =>
                  onSlotMachineMaxBetInputChange(event.target.value.replace(/[^0-9]/g, ''))
                }
                value={slotMachineMaxBetInput}
              />
            </small>
          </div>
          <div className="desktop-inline-actions">
            <Button disabled={isMutating} onClick={onInstallSlotMachines} variant="secondary">
              Instalar maquinas
            </Button>
            <Button disabled={isMutating} onClick={onConfigureSlotMachine} variant="ghost">
              Salvar configuracao
            </Button>
          </div>
        </div>
      ) : null}
      {puteiroSnapshot ? (
        <div className="desktop-detail-list">
          <div>
            <strong>Puteiro</strong>
            <small>{puteiroSnapshot.operatingHeadline}</small>
          </div>
          <div>
            <strong>Elenco</strong>
            <small>{puteiroSnapshot.workerStatusSummary}</small>
          </div>
          <div>
            <strong>Proximo passo</strong>
            <small>{puteiroSnapshot.nextStepCopy}</small>
          </div>
          {selectedPuteiro?.roster.slice(0, 3).map((worker) => (
            <div key={worker.id}>
              <strong>{worker.label}</strong>
              <small>
                {resolvePuteiroWorkerStatusLabel(worker)} ·{' '}
                {formatOperationsCurrency(worker.hourlyGrossRevenueEstimate)}/h
              </small>
            </div>
          ))}
          {selectedGpTemplate ? (
            <div>
              <strong>Contratar GP</strong>
              <small>
                <select
                  onChange={(event) =>
                    onSelectGpType(event.target.value as GpTemplateSummary['type'])
                  }
                  value={selectedGpTemplate.type}
                >
                  {puteiroTemplates.map((template) => (
                    <option key={template.type} value={template.type}>
                      {template.label} · {formatOperationsCurrency(template.purchasePrice)}
                    </option>
                  ))}
                </select>
              </small>
            </div>
          ) : null}
          <div className="desktop-inline-actions">
            <Button disabled={isMutating || !selectedGpTemplate} onClick={onHireGps} variant="secondary">
              Contratar GP
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function OperationsCatalogPanel({
  availableProperties,
  canPurchaseSelectedCatalogProperty,
  isMutating,
  onPurchase,
  onSelectCatalogType,
  playerMoney,
  selectedCatalogProperty,
}: OperationsCatalogPanelProps): JSX.Element {
  return (
    <Card className="desktop-panel">
      <div className="desktop-panel__header">
        <h3>Catalogo de compra</h3>
        <Badge tone="info">{availableProperties.length}</Badge>
      </div>
      <div className="desktop-scroll-list">
        {availableProperties.map((definition) => (
          <button
            className={`desktop-list-row desktop-list-row--clickable ${
              selectedCatalogProperty?.type === definition.type ? 'desktop-list-row--active' : ''
            }`}
            key={definition.type}
            onClick={() => onSelectCatalogType(definition.type)}
            type="button"
          >
            <div className="desktop-list-row__headline">
              <strong>{definition.label}</strong>
              <Badge tone={definition.stockAvailable === 0 ? 'danger' : 'warning'}>
                {formatOperationsCurrency(definition.basePrice)}
              </Badge>
            </div>
            <small>
              {resolvePropertyTypeLabel(definition.type)} ·{' '}
              {resolvePropertyAssetClassLabel(definition)} · nivel {definition.unlockLevel}
            </small>
            <small>
              Renda {formatOperationsCurrency(definition.baseDailyIncome)}/dia · custo{' '}
              {formatOperationsCurrency(definition.baseDailyMaintenanceCost)}/dia
            </small>
            <small>{resolvePropertyStockLabel(definition)}</small>
            {!(playerMoney >= definition.basePrice) ? <small>Fundos insuficientes</small> : null}
          </button>
        ))}
      </div>
      {selectedCatalogProperty ? (
        <div className="desktop-detail-list">
          <div>
            <strong>Compra</strong>
            <small>
              {resolvePropertyAssetClassLabel(selectedCatalogProperty)} ·{' '}
              {resolvePropertyStockLabel(selectedCatalogProperty)}
            </small>
          </div>
          <div>
            <strong>Utilidade</strong>
            <small>{resolvePropertyUtilityLines(selectedCatalogProperty).join(' · ')}</small>
          </div>
        </div>
      ) : null}
      <Button disabled={!canPurchaseSelectedCatalogProperty || isMutating} onClick={onPurchase} variant="primary">
        {isMutating ? 'Processando...' : 'Comprar ativo selecionado'}
      </Button>
    </Card>
  );
}
