import {
  buildPuteiroDashboardSnapshot,
  countOperationalAlerts,
  countReadyOperations,
  filterPropertiesByTab,
  formatOperationsCurrency,
  resolveOperationsTabDescription,
  resolveOperationsTabLabel,
  resolvePropertyAssetClassLabel,
  resolvePropertyOperationSnapshot,
  resolvePropertyRegionLabel,
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

const operationTabs = [
  { id: 'business', label: 'Operacoes' },
  { id: 'patrimony', label: 'Base e logistica' },
] as const;

export function OperationsScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [activeTab, setActiveTab] = useState<OperationsTab>('business');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<OperationsDashboardData | null>(null);
  const [sabotageCenter, setSabotageCenter] = useState<Awaited<ReturnType<typeof propertyApi.getSabotageCenter>> | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedCatalogType, setSelectedCatalogType] = useState<string | null>(null);
  const [selectedTargetPropertyId, setSelectedTargetPropertyId] = useState<string | null>(null);

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
  const selectedTarget = useMemo(
    () =>
      sabotageCenter?.targets.find((target) => target.id === selectedTargetPropertyId) ??
      sabotageCenter?.targets[0] ??
      null,
    [sabotageCenter?.targets, selectedTargetPropertyId],
  );
  const selectedOperation = useMemo(
    () => (dashboard && selectedProperty ? resolvePropertyOperationSnapshot(selectedProperty, dashboard) : null),
    [dashboard, selectedProperty],
  );
  const selectedPuteiro = useMemo(
    () => dashboard?.puteiroBook.puteiros.find((entry) => entry.id === selectedProperty?.id) ?? null,
    [dashboard?.puteiroBook.puteiros, selectedProperty?.id],
  );
  const puteiroSnapshot = useMemo(
    () => (selectedPuteiro ? buildPuteiroDashboardSnapshot(selectedPuteiro) : null),
    [selectedPuteiro],
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
        nextSabotageCenter,
      ] = await Promise.all([
        propertyApi.list(),
        bocaApi.list(),
        raveApi.list(),
        puteiroApi.list(),
        frontStoreApi.list(),
        slotMachineApi.list(),
        factoryApi.list(),
        propertyApi.getSabotageCenter(),
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
      setSabotageCenter(nextSabotageCenter);
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

  async function handleRecoverSelectedProperty(): Promise<void> {
    if (!selectedProperty) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await propertyApi.recoverSabotage(selectedProperty.id);
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(`${response.property.definition.label} liberado para recuperar a operacao.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao recuperar o ativo sabotado.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSabotageSelectedTarget(): Promise<void> {
    if (!selectedTarget) {
      return;
    }

    await handleSabotageTarget(selectedTarget.id);
  }

  async function handleSabotageTarget(targetId: string): Promise<void> {
    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await propertyApi.attemptSabotage(targetId);
      await Promise.all([loadDashboard(), refreshPlayerProfile()]);
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao sabotar o alvo.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadDashboard()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar operacoes'}
          </Button>
        }
        badges={[
          { label: `${allProperties.length} ativos`, tone: 'info' },
          { label: `${sabotageCenter?.targets.length ?? 0} alvos`, tone: 'warning' },
          { label: resolveOperationsTabLabel(activeTab), tone: 'neutral' },
        ]}
        description="Operacoes, base e logistica do personagem com coleta, upgrade, compra de ativos e centro de sabotagem direto no desktop."
        title="Operacoes"
      />

      {feedback ? <FeedbackCard message={feedback} title="Operacoes sincronizadas" tone="success" /> : null}
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
                    onSelect: () => setSelectedPropertyId(property.id),
                  },
                  {
                    id: 'open-property',
                    label: 'Abrir detalhes',
                    onSelect: () => setSelectedPropertyId(property.id),
                  },
                ]}
                key={property.id}
              >
                <button
                  className={`desktop-list-row desktop-list-row--clickable ${selectedProperty?.id === property.id ? 'desktop-list-row--active' : ''}`}
                  onClick={() => setSelectedPropertyId(property.id)}
                  type="button"
                >
                  <div className="desktop-list-row__headline">
                    <strong>{property.definition.label}</strong>
                    <Badge tone={property.sabotageStatus.state === 'normal' ? 'success' : 'danger'}>
                      {property.sabotageStatus.state === 'normal' ? 'Estavel' : property.sabotageStatus.state}
                    </Badge>
                  </div>
                  <small>{resolvePropertyTypeLabel(property.type)} · {resolvePropertyRegionLabel(property.regionId)}</small>
                  <small>Nivel {property.level} · {resolvePropertyAssetClassLabel(property.definition)}</small>
                </button>
              </ContextMenu>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          {selectedProperty ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <div>
                  <h3>{selectedProperty.definition.label}</h3>
                  <p>{resolvePropertyTypeLabel(selectedProperty.type)} · {resolvePropertyRegionLabel(selectedProperty.regionId)}</p>
                </div>
                <Badge tone={selectedOperation?.readyToCollect ? 'success' : 'neutral'}>
                  {selectedOperation?.statusLabel ?? 'Sem snapshot'}
                </Badge>
              </div>
              <div className="desktop-grid-3">
                <MetricCard label="Nivel" tone="info" value={`${selectedProperty.level}`} />
                <MetricCard label="Risco invasao" tone="danger" value={`${Math.round(selectedProperty.protection.invasionRisk)}%`} />
                <MetricCard label="Risco roubo" tone="warning" value={`${Math.round(selectedProperty.protection.robberyRisk)}%`} />
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
                    <small>{selectedOperation.collectableLabel} · estimativa {selectedOperation.estimatedHourlyLabel}</small>
                  </div>
                ) : null}
              </div>
              <div className="desktop-inline-actions">
                <Button disabled={isMutating || !selectedOperation?.readyToCollect} onClick={() => void handleCollectSelectedOperation()} variant="primary">
                  {isMutating ? 'Processando...' : selectedOperation?.actionLabel ?? 'Coletar'}
                </Button>
                <Button disabled={isMutating} onClick={() => void handleUpgradeSelectedProperty()} variant="secondary">
                  Melhorar ativo
                </Button>
                <Button disabled={isMutating || selectedProperty.sabotageStatus.state === 'normal'} onClick={() => void handleRecoverSelectedProperty()} variant="ghost">
                  Recuperar sabotagem
                </Button>
              </div>
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
                      <small>{resolvePuteiroWorkerStatusLabel(worker)} · {formatOperationsCurrency(worker.hourlyGrossRevenueEstimate)}/h</small>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Catalogo de compra</h3>
              <Badge tone="info">{dashboard?.propertyBook.availableProperties.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(dashboard?.propertyBook.availableProperties ?? []).map((definition) => (
                <button
                  className={`desktop-list-row desktop-list-row--clickable ${selectedCatalogProperty?.type === definition.type ? 'desktop-list-row--active' : ''}`}
                  key={definition.type}
                  onClick={() => setSelectedCatalogType(definition.type)}
                  type="button"
                >
                  <div className="desktop-list-row__headline">
                    <strong>{definition.label}</strong>
                    <Badge tone="warning">{formatOperationsCurrency(definition.basePrice)}</Badge>
                  </div>
                  <small>{resolvePropertyTypeLabel(definition.type)} · nivel {definition.unlockLevel}</small>
                </button>
              ))}
            </div>
            <Button disabled={isMutating || !selectedCatalogProperty || !player?.regionId} onClick={() => void handlePurchaseSelectedProperty()} variant="primary">
              {isMutating ? 'Processando...' : 'Comprar ativo selecionado'}
            </Button>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Centro de sabotagem</h3>
              <Badge tone="danger">{sabotageCenter?.targets.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(sabotageCenter?.targets ?? []).map((target) => (
                <ContextMenu
                  items={[
                    {
                      id: 'focus-target',
                      label: 'Interagir com estrutura',
                      onSelect: () => setSelectedTargetPropertyId(target.id),
                    },
                    {
                      id: 'sabotage-target',
                      label: 'Sabotar estrutura',
                      onSelect: () => {
                        setSelectedTargetPropertyId(target.id);
                        void handleSabotageTarget(target.id);
                      },
                    },
                  ]}
                  key={target.id}
                >
                  <button
                    className={`desktop-list-row desktop-list-row--clickable ${selectedTarget?.id === target.id ? 'desktop-list-row--active' : ''}`}
                    onClick={() => setSelectedTargetPropertyId(target.id)}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{resolvePropertyTypeLabel(target.type)} · {target.ownerNickname}</strong>
                      <Badge tone={target.status === 'eligible' ? 'warning' : 'neutral'}>
                        {target.status === 'eligible' ? 'Elegivel' : 'Cooldown'}
                      </Badge>
                    </div>
                    <small>{resolvePropertyRegionLabel(target.regionId)} · defesa {Math.round(target.defenseScore)}</small>
                  </button>
                </ContextMenu>
              ))}
            </div>
            <Button data-desktop-primary-action="true" disabled={isMutating || !selectedTarget || selectedTarget.status !== 'eligible'} onClick={() => void handleSabotageSelectedTarget()} variant="danger">
              {isMutating ? 'Processando...' : 'Sabotar alvo selecionado'}
            </Button>
          </Card>
        </div>
      </div>
    </section>
  );
}
