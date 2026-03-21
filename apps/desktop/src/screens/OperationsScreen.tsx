import {
  SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
  SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
  SLOT_MACHINE_DEFAULT_MAX_BET,
  SLOT_MACHINE_DEFAULT_MIN_BET,
  type GpTemplateSummary,
} from '@cs-rio/shared';
import {
  buildPuteiroDashboardSnapshot,
  countOperationalAlerts,
  countReadyOperations,
  filterPropertiesByTab,
  formatOperationsCurrency,
  formatPercent,
  resolveOperationsTabDescription,
  resolveOperationsTabLabel,
  resolvePropertyAssetClassLabel,
  resolvePropertyOperationSnapshot,
  resolvePropertyRegionLabel,
  resolvePropertyStockLabel,
  resolvePropertyTypeLabel,
  resolvePropertyUtilityLines,
  resolvePuteiroWorkerStatusLabel,
  sumCollectableCash,
  sumPropertyDailyUpkeep,
  type OperationsDashboardData,
  type OperationsTab,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card, ContextMenu, Tabs } from '../components/ui';
import {
  bocaApi,
  factoryApi,
  frontStoreApi,
  propertyApi,
  puteiroApi,
  raveApi,
  slotMachineApi,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';
import {
  OperationsCatalogPanel,
  OperationsPropertyListPanel,
  OperationsSelectedPropertyPanel,
} from './OperationsScreenSections';

const operationTabs = [
  { id: 'business', label: 'Operacoes' },
  { id: 'patrimony', label: 'Base e logistica' },
] as const;

export function OperationsScreen(): JSX.Element {
  const [selectedCatalogType, setSelectedCatalogType] = useState<string | null>(null);
  const [selectedSoldierType, setSelectedSoldierType] = useState<string | null>(null);
  const [selectedGpType, setSelectedGpType] = useState<GpTemplateSummary['type'] | null>(null);
  const [slotMachineInstallQuantityInput, setSlotMachineInstallQuantityInput] = useState('1');
  const [slotMachineHouseEdgeInput, setSlotMachineHouseEdgeInput] = useState(
    formatPercentageInput(SLOT_MACHINE_DEFAULT_HOUSE_EDGE),
  );
  const [slotMachineJackpotInput, setSlotMachineJackpotInput] = useState(
    formatPercentageInput(SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE),
  );
  const [slotMachineMinBetInput, setSlotMachineMinBetInput] = useState(String(SLOT_MACHINE_DEFAULT_MIN_BET));
  const [slotMachineMaxBetInput, setSlotMachineMaxBetInput] = useState(String(SLOT_MACHINE_DEFAULT_MAX_BET));
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [activeTab, setActiveTab] = useState<OperationsTab>('business');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<OperationsDashboardData | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  const allProperties = useMemo(
    () => dashboard?.propertyBook.ownedProperties ?? [],
    [dashboard?.propertyBook.ownedProperties],
  );
  const filteredProperties = useMemo(
    () => filterPropertiesByTab(allProperties, activeTab),
    [activeTab, allProperties],
  );
  const selectedProperty = useMemo(
    () => filteredProperties.find((property) => property.id === selectedPropertyId) ?? filteredProperties[0] ?? null,
    [filteredProperties, selectedPropertyId],
  );
  const selectedCatalogProperty = useMemo(
    () =>
      dashboard?.propertyBook.availableProperties.find((definition) => definition.type === selectedCatalogType) ??
      dashboard?.propertyBook.availableProperties[0] ??
      null,
    [dashboard?.propertyBook.availableProperties, selectedCatalogType],
  );
  const selectedOperation = useMemo(
    () => (dashboard && selectedProperty ? resolvePropertyOperationSnapshot(selectedProperty, dashboard) : null),
    [dashboard, selectedProperty],
  );
  const selectedSlotMachine = useMemo(
    () => dashboard?.slotMachineBook.slotMachines.find((entry) => entry.id === selectedProperty?.id) ?? null,
    [dashboard?.slotMachineBook.slotMachines, selectedProperty?.id],
  );
  const selectedPuteiro = useMemo(
    () => dashboard?.puteiroBook.puteiros.find((entry) => entry.id === selectedProperty?.id) ?? null,
    [dashboard?.puteiroBook.puteiros, selectedProperty?.id],
  );
  const puteiroSnapshot = useMemo(
    () => (selectedPuteiro ? buildPuteiroDashboardSnapshot(selectedPuteiro) : null),
    [selectedPuteiro],
  );
  const unlockedSoldierTemplates = useMemo(
    () =>
      (dashboard?.propertyBook.soldierTemplates ?? []).filter(
        (template) => (player?.level ?? 0) >= template.unlockLevel,
      ),
    [dashboard?.propertyBook.soldierTemplates, player?.level],
  );
  const selectedSoldierTemplate = useMemo(
    () =>
      unlockedSoldierTemplates.find((template) => template.type === selectedSoldierType) ??
      unlockedSoldierTemplates[0] ??
      null,
    [selectedSoldierType, unlockedSoldierTemplates],
  );
  const selectedGpTemplate = useMemo(
    () =>
      (dashboard?.puteiroBook.templates ?? []).find((template) => template.type === selectedGpType) ??
      dashboard?.puteiroBook.templates[0] ??
      null,
    [dashboard?.puteiroBook.templates, selectedGpType],
  );
  const selectedCatalogCanAfford = useMemo(
    () => Boolean(selectedCatalogProperty && (player?.resources.money ?? 0) >= selectedCatalogProperty.basePrice),
    [player?.resources.money, selectedCatalogProperty],
  );
  const selectedCatalogHasStock = useMemo(
    () =>
      selectedCatalogProperty
        ? selectedCatalogProperty.stockAvailable === null || selectedCatalogProperty.stockAvailable > 0
        : false,
    [selectedCatalogProperty],
  );

  useEffect(() => {
    if (!filteredProperties.length) {
      setSelectedPropertyId(null);
      return;
    }

    if (!selectedProperty || !filteredProperties.some((property) => property.id === selectedProperty.id)) {
      const nextPropertyId = filteredProperties[0]?.id;

      if (nextPropertyId) {
        setSelectedPropertyId(nextPropertyId);
      }
    }
  }, [filteredProperties, selectedProperty]);

  useEffect(() => {
    if (!selectedCatalogProperty && dashboard?.propertyBook.availableProperties.length) {
      const nextCatalogType = dashboard.propertyBook.availableProperties[0]?.type;

      if (nextCatalogType) {
        setSelectedCatalogType(nextCatalogType);
      }
    }
  }, [dashboard?.propertyBook.availableProperties, selectedCatalogProperty]);

  useEffect(() => {
    if (!selectedSoldierTemplate && unlockedSoldierTemplates.length > 0) {
      setSelectedSoldierType(unlockedSoldierTemplates[0]?.type ?? null);
      return;
    }

    if (selectedSoldierTemplate && selectedSoldierTemplate.type !== selectedSoldierType) {
      setSelectedSoldierType(selectedSoldierTemplate.type);
      return;
    }

    if (unlockedSoldierTemplates.length === 0) {
      setSelectedSoldierType(null);
    }
  }, [selectedSoldierTemplate, selectedSoldierType, unlockedSoldierTemplates]);

  useEffect(() => {
    const templates = dashboard?.puteiroBook.templates ?? [];

    if (!selectedGpTemplate && templates.length > 0) {
      setSelectedGpType(templates[0]?.type ?? null);
      return;
    }

    if (selectedGpTemplate && selectedGpTemplate.type !== selectedGpType) {
      setSelectedGpType(selectedGpTemplate.type);
      return;
    }

    if (templates.length === 0) {
      setSelectedGpType(null);
    }
  }, [dashboard?.puteiroBook.templates, selectedGpTemplate, selectedGpType]);

  useEffect(() => {
    if (!selectedSlotMachine) {
      return;
    }

    setSlotMachineHouseEdgeInput(formatPercentageInput(selectedSlotMachine.config.houseEdge));
    setSlotMachineJackpotInput(formatPercentageInput(selectedSlotMachine.config.jackpotChance));
    setSlotMachineMinBetInput(String(Math.round(selectedSlotMachine.config.minBet)));
    setSlotMachineMaxBetInput(String(Math.round(selectedSlotMachine.config.maxBet)));
  }, [selectedSlotMachine]);

  async function loadDashboard(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [
        propertyBook,
        bocaBook,
        raveBook,
        puteiroBook,
        frontStoreBook,
        slotMachineBook,
        factoryBook,
      ] = await Promise.all([
        propertyApi.list(),
        bocaApi.list(),
        raveApi.list(),
        puteiroApi.list(),
        frontStoreApi.list(),
        slotMachineApi.list(),
        factoryApi.list(),
      ]);

      setDashboard({
        bocaBook,
        factoryBook,
        frontStoreBook,
        propertyBook,
        puteiroBook,
        raveBook,
        slotMachineBook,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar as operacoes.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCollectSelectedOperation(): Promise<void> {
    if (!selectedProperty || !selectedOperation?.readyToCollect) {
      setError('Selecione uma operacao pronta para coletar.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      if (selectedProperty.type === 'factory') {
        await factoryApi.collect(selectedProperty.id);
      } else if (selectedProperty.type === 'boca') {
        await bocaApi.collect(selectedProperty.id);
      } else if (selectedProperty.type === 'rave') {
        await raveApi.collect(selectedProperty.id);
      } else if (selectedProperty.type === 'puteiro') {
        await puteiroApi.collect(selectedProperty.id);
      } else if (selectedProperty.type === 'front_store') {
        await frontStoreApi.collect(selectedProperty.id);
      } else if (selectedProperty.type === 'slot_machine') {
        await slotMachineApi.collect(selectedProperty.id);
      } else {
        setError('Esse ativo nao tem coleta direta nesta fase do desktop.');
        return;
      }

      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`Coleta executada em ${resolvePropertyTypeLabel(selectedProperty.type)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao coletar a operacao.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handlePurchaseSelectedProperty(): Promise<void> {
    if (!selectedCatalogProperty || !player?.regionId) {
      setError('Selecione um ativo do catalogo e confirme uma regiao valida.');
      return;
    }

    if (!selectedCatalogHasStock) {
      setError('Nao existe slot livre ou estoque restante para esse ativo agora.');
      return;
    }

    if (!selectedCatalogCanAfford) {
      setError('Fundos insuficientes para comprar esse ativo.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await propertyApi.purchase({
        regionId: player.regionId,
        type: selectedCatalogProperty.type,
      });
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`Ativo comprado: ${response.property.definition.label}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao comprar o ativo.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpgradeSelectedProperty(): Promise<void> {
    if (!selectedProperty) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await propertyApi.upgrade(selectedProperty.id);
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`Upgrade aplicado. Novo nivel: ${response.property.level}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao melhorar o ativo.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleHireSelectedSoldiers(): Promise<void> {
    if (!selectedProperty || !selectedSoldierTemplate) {
      setError('Selecione um ativo com capacidade militar e um template desbloqueado.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await propertyApi.hireSoldiers(selectedProperty.id, {
        quantity: 1,
        type: selectedSoldierTemplate.type,
      });
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`${response.hiredQuantity}x ${selectedSoldierTemplate.label} enviado(s) para ${response.property.definition.label}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao contratar segurancas.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleInstallSelectedSlotMachines(): Promise<void> {
    if (!selectedProperty || selectedProperty.type !== 'slot_machine') {
      setError('Selecione uma maquininha antes de instalar unidades.');
      return;
    }

    const quantity = sanitizePositiveInteger(slotMachineInstallQuantityInput);

    if (quantity <= 0) {
      setError('Informe uma quantidade positiva para instalar.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await slotMachineApi.install(selectedProperty.id, {
        quantity,
      });
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`${response.installedQuantity} maquina(s) instalada(s) por ${formatOperationsCurrency(response.totalInstallCost)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao instalar maquinas.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfigureSelectedSlotMachine(): Promise<void> {
    if (!selectedProperty || selectedProperty.type !== 'slot_machine') {
      setError('Selecione uma maquininha antes de configurar a sala.');
      return;
    }

    const houseEdge = sanitizePercentageInput(slotMachineHouseEdgeInput);
    const jackpotChance = sanitizePercentageInput(slotMachineJackpotInput);
    const minBet = sanitizePositiveInteger(slotMachineMinBetInput);
    const maxBet = sanitizePositiveInteger(slotMachineMaxBetInput);

    if (houseEdge <= 0 || jackpotChance <= 0 || minBet <= 0 || maxBet <= 0 || minBet > maxBet) {
      setError('Preencha margem, jackpot e faixa de aposta com valores validos.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      await slotMachineApi.configure(selectedProperty.id, {
        houseEdge,
        jackpotChance,
        maxBet,
        minBet,
      });
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`Sala configurada. Casa ${formatPercent(houseEdge)} · jackpot ${formatPercent(jackpotChance)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao configurar a maquininha.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleHireSelectedGps(): Promise<void> {
    if (!selectedProperty || selectedProperty.type !== 'puteiro' || !selectedGpTemplate) {
      setError('Selecione um puteiro e um template de GP.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await puteiroApi.hireGps(selectedProperty.id, {
        quantity: 1,
        type: selectedGpTemplate.type,
      });
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`${response.hiredGps.length}x ${selectedGpTemplate.label} contratada(s) por ${formatOperationsCurrency(response.totalPurchaseCost)}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao contratar GPs.');
    } finally {
      setIsMutating(false);
    }
  }

  const canPurchaseSelectedCatalogProperty =
    Boolean(selectedCatalogProperty && player?.regionId) &&
    selectedCatalogCanAfford &&
    selectedCatalogHasStock &&
    !isMutating;

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadDashboard()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar ativos'}
          </Button>
        }
        badges={[
          { label: `${allProperties.length} ativos`, tone: 'info' },
          { label: resolveOperationsTabLabel(activeTab), tone: 'neutral' },
        ]}
        description="Cuide do que gira caixa e do que sustenta sua mobilidade, protecao e recuperacao."
        title="Gerir ativos"
      />

      {feedback ? <FeedbackCard message={feedback} title="Ativos atualizados" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha nas operacoes" tone="danger" /> : null}

      <Card className="desktop-panel">
        <Tabs activeId={activeTab} items={[...operationTabs]} onChange={(value) => setActiveTab(value as OperationsTab)} />
        <p>{resolveOperationsTabDescription(activeTab)}</p>
      </Card>

      <div className="desktop-metric-grid">
        <MetricCard label="Caixa coletavel" tone="warning" value={formatOperationsCurrency(dashboard ? sumCollectableCash(dashboard) : 0)} />
        <MetricCard label="Alertas" tone="danger" value={`${countOperationalAlerts(allProperties)}`} />
        <MetricCard label="Prontas" tone="success" value={`${dashboard ? countReadyOperations(dashboard) : 0}`} />
        <MetricCard label="Upkeep diario" tone="info" value={formatOperationsCurrency(sumPropertyDailyUpkeep(allProperties))} />
      </div>

      <div className="desktop-grid-2">
        <OperationsPropertyListPanel
          filteredProperties={filteredProperties}
          onSelectProperty={setSelectedPropertyId}
          selectedPropertyId={selectedProperty?.id ?? null}
        />

        <div className="desktop-screen__stack">
          <OperationsSelectedPropertyPanel
            isMutating={isMutating}
            onCollect={() => void handleCollectSelectedOperation()}
            onConfigureSlotMachine={() => void handleConfigureSelectedSlotMachine()}
            onHireGps={() => void handleHireSelectedGps()}
            onHireSoldiers={() => void handleHireSelectedSoldiers()}
            onInstallSlotMachines={() => void handleInstallSelectedSlotMachines()}
            onSelectGpType={setSelectedGpType}
            onSelectSoldierType={setSelectedSoldierType}
            onSlotMachineHouseEdgeInputChange={setSlotMachineHouseEdgeInput}
            onSlotMachineInstallQuantityInputChange={setSlotMachineInstallQuantityInput}
            onSlotMachineJackpotInputChange={setSlotMachineJackpotInput}
            onSlotMachineMaxBetInputChange={setSlotMachineMaxBetInput}
            onSlotMachineMinBetInputChange={setSlotMachineMinBetInput}
            onUpgrade={() => void handleUpgradeSelectedProperty()}
            puteiroSnapshot={puteiroSnapshot}
            puteiroTemplates={dashboard?.puteiroBook.templates ?? []}
            selectedGpTemplate={selectedGpTemplate}
            selectedOperation={selectedOperation}
            selectedProperty={selectedProperty}
            selectedPuteiro={selectedPuteiro}
            selectedSlotMachine={selectedSlotMachine}
            selectedSoldierTemplate={selectedSoldierTemplate}
            slotMachineHouseEdgeInput={slotMachineHouseEdgeInput}
            slotMachineInstallQuantityInput={slotMachineInstallQuantityInput}
            slotMachineJackpotInput={slotMachineJackpotInput}
            slotMachineMaxBetInput={slotMachineMaxBetInput}
            slotMachineMinBetInput={slotMachineMinBetInput}
            unlockedSoldierTemplates={unlockedSoldierTemplates}
          />

          <OperationsCatalogPanel
            availableProperties={dashboard?.propertyBook.availableProperties ?? []}
            canPurchaseSelectedCatalogProperty={canPurchaseSelectedCatalogProperty}
            isMutating={isMutating}
            onPurchase={() => void handlePurchaseSelectedProperty()}
            onSelectCatalogType={setSelectedCatalogType}
            playerMoney={player?.resources.money ?? 0}
            selectedCatalogProperty={selectedCatalogProperty}
          />
        </div>
      </div>
    </section>
  );
}

function sanitizePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sanitizePercentageInput(value: string): number {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed > 1 ? parsed / 100 : parsed;
}

function formatPercentageInput(value: number): string {
  return `${Math.round(value * 100)}`;
}
