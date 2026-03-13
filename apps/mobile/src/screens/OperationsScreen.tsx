import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { type OwnedPropertySummary } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  countOperationalAlerts,
  countReadyOperations,
  filterPropertiesByTab,
  formatOperationsCurrency,
  formatPercent,
  type OperationsDashboardData,
  type OperationsTab,
  isBusinessProperty,
  resolvePropertyOperationSnapshot,
  resolvePropertyRegionLabel,
  resolvePropertyTypeLabel,
  resolvePropertyUtilityLines,
  sumCollectableCash,
  sumPropertyPrestige,
} from '../features/operations';
import {
  bocaApi,
  factoryApi,
  formatApiError,
  frontStoreApi,
  propertyApi,
  puteiroApi,
  raveApi,
  slotMachineApi,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

const HIRE_QUANTITY_OPTIONS = [1, 3, 5] as const;

export function OperationsScreen(): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'Operations'>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [dashboard, setDashboard] = useState<OperationsDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<OperationsTab>(route.params?.initialTab ?? 'business');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    route.params?.focusPropertyId ?? null,
  );
  const [selectedSoldierType, setSelectedSoldierType] = useState<string | null>(null);
  const [hireQuantity, setHireQuantity] = useState<(typeof HIRE_QUANTITY_OPTIONS)[number]>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    setIsLoading(true);

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
        refreshPlayerProfile(),
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
      setError(formatApiError(nextError).message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshPlayerProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const allProperties = useMemo(
    () => dashboard?.propertyBook.ownedProperties ?? [],
    [dashboard?.propertyBook.ownedProperties],
  );
  const filteredProperties = useMemo(
    () => filterPropertiesByTab(allProperties, activeTab),
    [activeTab, allProperties],
  );

  useEffect(() => {
    if (allProperties.length === 0) {
      setSelectedPropertyId(null);
      return;
    }

    const focusedById = route.params?.focusPropertyId
      ? allProperties.find((property) => property.id === route.params?.focusPropertyId) ?? null
      : null;
    const focusedByType = route.params?.focusPropertyType
      ? allProperties.find((property) => property.type === route.params?.focusPropertyType) ?? null
      : null;
    const preferredProperty = focusedById ?? focusedByType;

    if (preferredProperty) {
      const preferredTab = isBusinessProperty(preferredProperty) ? 'business' : 'patrimony';

      if (preferredTab !== activeTab) {
        setActiveTab(preferredTab);
      }

      if (preferredProperty.id !== selectedPropertyId) {
        setSelectedPropertyId(preferredProperty.id);
      }
      return;
    }

    if (!selectedPropertyId || !filteredProperties.some((property) => property.id === selectedPropertyId)) {
      setSelectedPropertyId(filteredProperties[0]?.id ?? null);
    }
  }, [
    activeTab,
    allProperties,
    filteredProperties,
    route.params?.focusPropertyId,
    route.params?.focusPropertyType,
    selectedPropertyId,
  ]);

  const selectedProperty = useMemo(
    () =>
      allProperties.find((property) => property.id === selectedPropertyId) ??
      filteredProperties[0] ??
      null,
    [allProperties, filteredProperties, selectedPropertyId],
  );
  const selectedOperation = useMemo(
    () => (dashboard && selectedProperty ? resolvePropertyOperationSnapshot(selectedProperty, dashboard) : null),
    [dashboard, selectedProperty],
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

  const summary = useMemo(() => {
    const ownedProperties = dashboard?.propertyBook.ownedProperties ?? [];
    const businessCount = ownedProperties.filter(isBusinessProperty).length;
    const patrimonyCount = ownedProperties.length - businessCount;

    return {
      alerts: countOperationalAlerts(ownedProperties),
      businessCount,
      cashReady: sumCollectableCash(
        dashboard ?? {
          bocaBook: { bocas: [] },
          factoryBook: { availableRecipes: [], factories: [] },
          frontStoreBook: { frontStores: [], kinds: [] },
          propertyBook: { availableProperties: [], ownedProperties: [], soldierTemplates: [] },
          puteiroBook: { puteiros: [], templates: [] },
          raveBook: { raves: [] },
          slotMachineBook: { slotMachines: [] },
        },
      ),
      patrimonyCount,
      prestige: sumPropertyPrestige(ownedProperties),
      readyOperations: dashboard ? countReadyOperations(dashboard) : 0,
    };
  }, [dashboard]);

  const handleRefresh = useCallback(async () => {
    setFeedback('Patrimônio sincronizado. A manutenção é debitada automaticamente quando houver saldo.');
    setBootstrapStatus('Patrimônio sincronizado com o backend autoritativo.');
    await loadDashboard();
  }, [loadDashboard, setBootstrapStatus]);

  const handleUpgrade = useCallback(async () => {
    if (!selectedProperty) {
      setError('Selecione uma propriedade para melhorar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await propertyApi.upgrade(selectedProperty.id);
      const message = `${response.property.definition.label} melhorada para nível ${response.property.level}.`;
      setFeedback(message);
      setBootstrapStatus(message);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadDashboard, selectedProperty, setBootstrapStatus]);

  const handleHireSoldiers = useCallback(async () => {
    if (!selectedProperty) {
      setError('Selecione uma propriedade antes de contratar segurança.');
      return;
    }

    if (!selectedSoldierTemplate) {
      setError('Selecione um template de soldado desbloqueado.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await propertyApi.hireSoldiers(selectedProperty.id, {
        quantity: hireQuantity,
        type: selectedSoldierTemplate.type,
      });
      const message = `${response.hiredQuantity}x ${selectedSoldierTemplate.label} enviados para ${response.property.definition.label}.`;
      setFeedback(message);
      setBootstrapStatus(message);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [hireQuantity, loadDashboard, selectedProperty, selectedSoldierTemplate, setBootstrapStatus]);

  const handleCollect = useCallback(async () => {
    if (!selectedProperty || !selectedOperation) {
      setError('Selecione um ativo operacional para coletar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const message = await collectPropertyOperation(selectedProperty);
      setFeedback(message);
      setBootstrapStatus(message);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadDashboard, selectedOperation, selectedProperty, setBootstrapStatus]);

  const canUpgrade =
    Boolean(selectedProperty) &&
    selectedProperty.level < selectedProperty.definition.maxLevel &&
    !isLoading &&
    !isSubmitting;
  const canCollect =
    Boolean(selectedOperation?.readyToCollect) && !isLoading && !isSubmitting;
  const canHireSoldiers =
    Boolean(selectedProperty && selectedProperty.definition.soldierCapacity > 0 && selectedSoldierTemplate) &&
    !isLoading &&
    !isSubmitting;

  return (
    <InGameScreenLayout
      subtitle="Painel unificado do patrimônio: sincronize manutenção, acompanhe risco e proteção, colete receita e reforce a segurança dos ativos do jogador."
      title="Negócios e Patrimônio"
    >
      <View style={styles.summaryGrid}>
        <SummaryCard label="Negócios" tone={colors.accent} value={`${summary.businessCount}`} />
        <SummaryCard label="Patrimônio" tone={colors.info} value={`${summary.patrimonyCount}`} />
        <SummaryCard label="Prestígio" tone={colors.success} value={`${Math.round(summary.prestige)}`} />
        <SummaryCard label="Caixa pronto" tone={colors.warning} value={formatOperationsCurrency(summary.cashReady)} />
        <SummaryCard label="Coletas" tone={colors.accent} value={`${summary.readyOperations}`} />
        <SummaryCard label="Alertas" tone={colors.danger} value={`${summary.alerts}`} />
      </View>

      <View style={styles.tabRow}>
        {(['business', 'patrimony'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              setSelectedPropertyId(null);
            }}
            style={({ pressed }) => [
              styles.tabButton,
              activeTab === tab ? styles.tabButtonSelected : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.tabButtonLabel}>{tab === 'business' ? 'Negócios' : 'Patrimônio'}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Banner copy={error} tone="danger" /> : null}
      {feedback ? <Banner copy={feedback} tone="neutral" /> : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'business' ? 'Operações do jogador' : 'Ativos patrimoniais'}
          </Text>
          <Pressable
            onPress={() => {
              void handleRefresh();
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.secondaryButtonLabel}>{isLoading ? 'Sincronizando...' : 'Atualizar'}</Text>
          </Pressable>
        </View>

        {filteredProperties.length > 0 ? (
          <View style={styles.cardList}>
            {filteredProperties.map((property) => {
              const operation = dashboard ? resolvePropertyOperationSnapshot(property, dashboard) : null;
              const isSelected = property.id === selectedProperty?.id;

              return (
                <Pressable
                  key={property.id}
                  onPress={() => {
                    setSelectedPropertyId(property.id);
                  }}
                  style={({ pressed }) => [
                    styles.propertyCard,
                    isSelected ? styles.propertyCardSelected : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.propertyCardHeader}>
                    <View style={styles.propertyCardTitleWrap}>
                      <Text style={styles.propertyCardTitle}>{property.definition.label}</Text>
                      <Text style={styles.propertyCardMeta}>
                        {resolvePropertyRegionLabel(property.regionId)} · {resolvePropertyTypeLabel(property.type)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        property.status === 'maintenance_blocked' ? styles.statusBadgeDanger : styles.statusBadgeAccent,
                      ]}
                    >
                      <Text style={styles.statusBadgeLabel}>
                        {property.status === 'maintenance_blocked' ? 'Travado' : 'Ativo'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <MetricPill label="Prestígio" value={`${Math.round(property.economics.effectivePrestigeScore)}`} />
                    <MetricPill label="Defesa" value={`${Math.round(property.protection.defenseScore)}`} />
                    <MetricPill label="Upkeep" value={formatOperationsCurrency(property.economics.totalDailyUpkeep)} />
                  </View>

                  {operation ? (
                    <Text style={styles.propertyCardCopy}>
                      {operation.statusLabel} · {operation.collectableLabel} prontos
                    </Text>
                  ) : (
                    <Text style={styles.propertyCardCopy}>
                      Ativo patrimonial sem renda direta, com proteção e desgaste próprios.
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            copy={
              activeTab === 'business'
                ? 'Nenhum negócio ativo ainda. Compre ou provisione um ativo operacional para ver caixa e coleta.'
                : 'Nenhum patrimônio pessoal comprado ainda. Os ativos entram aqui com prestígio, utilidade e risco.'
            }
          />
        )}
      </View>

      {selectedProperty ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Painel do ativo</Text>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={styles.detailTitleWrap}>
                  <Text style={styles.detailTitle}>{selectedProperty.definition.label}</Text>
                  <Text style={styles.detailCopy}>
                    {resolvePropertyRegionLabel(selectedProperty.regionId)}
                    {selectedProperty.favelaId ? ` · Favela ${selectedProperty.favelaId}` : ''}
                  </Text>
                </View>
                <Text style={styles.detailMeta}>
                  Nível {selectedProperty.level}/{selectedProperty.definition.maxLevel}
                </Text>
              </View>

              <View style={styles.metricGrid}>
                <MetricCard label="Risco de invasão" tone={colors.danger} value={`${selectedProperty.protection.invasionRisk}%`} />
                <MetricCard label="Risco de roubo" tone={colors.warning} value={`${selectedProperty.protection.robberyRisk}%`} />
                <MetricCard label="Risco de tomada" tone={colors.info} value={`${selectedProperty.protection.takeoverRisk}%`} />
                <MetricCard label="Facção" tone={colors.accent} value={selectedProperty.protection.factionProtectionActive ? 'Protegendo' : 'Sem proteção'} />
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockTitle}>Proteção e manutenção</Text>
                <Text style={styles.infoBlockCopy}>
                  Defesa {Math.round(selectedProperty.protection.defenseScore)} · Tier territorial {selectedProperty.protection.territoryTier} · Controle regional {formatPercent(selectedProperty.protection.territoryControlRatio)}
                </Text>
                <Text style={styles.infoBlockCopy}>
                  Última manutenção: {formatDateLabel(selectedProperty.maintenanceStatus.lastMaintenanceAt)} · Débito na sincronização: {formatOperationsCurrency(selectedProperty.maintenanceStatus.moneySpentOnSync)}
                </Text>
                <Text style={styles.infoBlockCopy}>
                  Upkeep diário: {formatOperationsCurrency(selectedProperty.economics.totalDailyUpkeep)} · Em atraso: {selectedProperty.maintenanceStatus.overdueDays} dia(s)
                </Text>
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.infoBlockTitle}>Prestígio e utilidade</Text>
                <Text style={styles.infoBlockCopy}>
                  Prestígio efetivo: {Math.round(selectedProperty.economics.effectivePrestigeScore)} · Classe {selectedProperty.definition.assetClass}
                </Text>
                {resolvePropertyUtilityLines(selectedProperty.definition).map((line) => (
                  <Text key={line} style={styles.infoBlockCopy}>
                    {line}
                  </Text>
                ))}
              </View>

              {selectedOperation ? (
                <View style={styles.infoBlock}>
                  <Text style={styles.infoBlockTitle}>Operação</Text>
                  <Text style={styles.infoBlockCopy}>
                    {selectedOperation.statusLabel} · Pronto: {selectedOperation.collectableLabel}
                  </Text>
                  <Text style={styles.infoBlockCopy}>
                    Ritmo estimado: {selectedOperation.estimatedHourlyLabel} · Comissão faccional {formatPercent(selectedProperty.economics.effectiveFactionCommissionRate)}
                  </Text>
                  {selectedOperation.detailLines.map((line) => (
                    <Text key={line} style={styles.infoBlockCopy}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => {
                    void handleRefresh();
                  }}
                  style={({ pressed }) => [styles.secondaryButtonWide, pressed ? styles.buttonPressed : null]}
                >
                  <Text style={styles.secondaryButtonLabel}>Sincronizar manutenção</Text>
                </Pressable>
                <Pressable
                  disabled={!canUpgrade}
                  onPress={() => {
                    void handleUpgrade();
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButtonWide,
                    !canUpgrade ? styles.buttonDisabled : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.secondaryButtonLabel}>
                    {selectedProperty.level >= selectedProperty.definition.maxLevel ? 'Nível máximo' : 'Melhorar ativo'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={!canCollect}
                  onPress={() => {
                    void handleCollect();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canCollect ? styles.buttonDisabled : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {selectedOperation?.actionLabel ?? 'Sem coleta'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Segurança e soldados</Text>
            <View style={styles.detailCard}>
              <Text style={styles.infoBlockCopy}>
                Capacidade: {selectedProperty.soldiersCount}/{selectedProperty.definition.soldierCapacity} · Poder total {selectedProperty.protection.soldiersPower}
              </Text>

              {selectedProperty.soldierRoster.length > 0 ? (
                <View style={styles.cardList}>
                  {selectedProperty.soldierRoster.map((soldier) => (
                    <View key={soldier.type} style={styles.rosterCard}>
                      <Text style={styles.rosterTitle}>{soldier.label}</Text>
                      <Text style={styles.rosterCopy}>
                        {soldier.count} alocados · Poder {soldier.totalPower} · Custo {formatOperationsCurrency(soldier.dailyCost)}/dia
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.infoBlockCopy}>
                  Nenhum soldado alocado. Use os modelos abaixo para reforçar o ativo.
                </Text>
              )}

              {selectedProperty.definition.soldierCapacity > 0 ? (
                <>
                  <View style={styles.choiceRow}>
                    {unlockedSoldierTemplates.map((template) => (
                      <Pressable
                        key={template.type}
                        onPress={() => {
                          setSelectedSoldierType(template.type);
                        }}
                        style={({ pressed }) => [
                          styles.choiceChip,
                          selectedSoldierTemplate?.type === template.type ? styles.choiceChipSelected : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.choiceChipTitle}>{template.label}</Text>
                        <Text style={styles.choiceChipCopy}>
                          {template.power} poder · {formatOperationsCurrency(template.dailyCost)}/dia
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.quantityRow}>
                    {HIRE_QUANTITY_OPTIONS.map((quantity) => (
                      <Pressable
                        key={quantity}
                        onPress={() => {
                          setHireQuantity(quantity);
                        }}
                        style={({ pressed }) => [
                          styles.quantityChip,
                          hireQuantity === quantity ? styles.quantityChipSelected : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.quantityChipLabel}>{quantity}x</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    disabled={!canHireSoldiers}
                    onPress={() => {
                      void handleHireSoldiers();
                    }}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      !canHireSoldiers ? styles.buttonDisabled : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      Contratar {hireQuantity}x {selectedSoldierTemplate?.label ?? 'soldado'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.infoBlockCopy}>
                  Este ativo não aceita guarda dedicada. A proteção aqui depende da facção e do domínio territorial.
                </Text>
              )}
            </View>
          </View>
        </>
      ) : null}
    </InGameScreenLayout>
  );

  async function collectPropertyOperation(property: OwnedPropertySummary): Promise<string> {
    if (property.type === 'boca') {
      const response = await bocaApi.collect(property.id);
      return `Coletado ${formatOperationsCurrency(response.collectedAmount)} da boca.`;
    }

    if (property.type === 'rave') {
      const response = await raveApi.collect(property.id);
      return `Coletado ${formatOperationsCurrency(response.collectedAmount)} da rave.`;
    }

    if (property.type === 'puteiro') {
      const response = await puteiroApi.collect(property.id);
      return `Coletado ${formatOperationsCurrency(response.collectedAmount)} do puteiro.`;
    }

    if (property.type === 'front_store') {
      const response = await frontStoreApi.collect(property.id);
      return `Coletado ${formatOperationsCurrency(response.collectedAmount)} limpos para o banco.`;
    }

    if (property.type === 'slot_machine') {
      const response = await slotMachineApi.collect(property.id);
      return `Coletado ${formatOperationsCurrency(response.collectedAmount)} das maquininhas.`;
    }

    if (property.type === 'factory') {
      const response = await factoryApi.collect(property.id);
      return `Coletado ${response.collectedQuantity}x ${response.drug.name} da fábrica.`;
    }

    throw new Error('Este patrimônio não gera coleta operacional.');
  }
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function Banner(props: {
  copy: string;
  tone: 'danger' | 'neutral';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        props.tone === 'danger' ? styles.bannerDanger : styles.bannerNeutral,
      ]}
    >
      <Text style={styles.bannerCopy}>{props.copy}</Text>
    </View>
  );
}

function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateCopy}>{copy}</Text>
    </View>
  );
}

function SummaryCard(props: {
  label: string;
  tone: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color: props.tone }]}>{props.value}</Text>
      <Text style={styles.summaryLabel}>{props.label}</Text>
    </View>
  );
}

function MetricCard(props: {
  label: string;
  tone: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricCardValue, { color: props.tone }]}>{props.value}</Text>
      <Text style={styles.metricCardLabel}>{props.label}</Text>
    </View>
  );
}

function MetricPill(props: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{props.label}</Text>
      <Text style={styles.metricPillValue}>{props.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '30%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabButtonSelected: {
    borderColor: colors.accent,
  },
  tabButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonWide: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: '#17120a',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  banner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.12)',
    borderColor: 'rgba(217, 108, 108, 0.35)',
    borderWidth: 1,
  },
  bannerNeutral: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderWidth: 1,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  emptyStateCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardList: {
    gap: 10,
  },
  propertyCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  propertyCardSelected: {
    borderColor: colors.accent,
  },
  propertyCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  propertyCardTitleWrap: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  propertyCardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  propertyCardMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  propertyCardCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeAccent: {
    backgroundColor: 'rgba(224, 176, 75, 0.16)',
  },
  statusBadgeDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.16)',
  },
  statusBadgeLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    backgroundColor: colors.panelAlt,
    borderRadius: 14,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricPillLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricPillValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  detailCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailTitleWrap: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
  },
  detailCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  detailMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    flexGrow: 1,
    minWidth: '46%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metricCardValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricCardLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  infoBlock: {
    gap: 6,
  },
  infoBlockTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoBlockCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rosterCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 16,
    gap: 4,
    padding: 12,
  },
  rosterTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rosterCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  choiceRow: {
    gap: 10,
  },
  choiceChip: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  choiceChipSelected: {
    borderColor: colors.accent,
  },
  choiceChipTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  choiceChipCopy: {
    color: colors.muted,
    fontSize: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quantityChip: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quantityChipSelected: {
    borderColor: colors.accent,
  },
  quantityChipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
