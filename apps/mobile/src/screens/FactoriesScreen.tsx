import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  filterFactoryRecipes,
  filterStockableComponentItems,
  formatFactoryCurrency,
  resolveFactoryStatus,
  sanitizeFactoryQuantity,
} from '../features/factories';
import { factoryApi, formatApiError } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';
import {
  Banner,
  EmptyState,
  MetricPill,
  resolveFactoryTone,
  StatusChip,
  styles,
  SummaryCard,
} from './FactoriesScreen.parts';

export function FactoriesScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [factoryBook, setFactoryBook] = useState<Awaited<
    ReturnType<typeof factoryApi.list>
  > | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const [selectedComponentItemId, setSelectedComponentItemId] = useState<string | null>(null);
  const [componentQuantityInput, setComponentQuantityInput] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFactories = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const [nextFactoryBook] = await Promise.all([factoryApi.list(), refreshPlayerProfile()]);
      setFactoryBook(nextFactoryBook);
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshPlayerProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadFactories();
    }, [loadFactories]),
  );

  const recipes = useMemo(
    () => filterFactoryRecipes(factoryBook?.availableRecipes ?? []),
    [factoryBook?.availableRecipes],
  );
  const factories = useMemo(
    () =>
      [...(factoryBook?.factories ?? [])].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [factoryBook?.factories],
  );
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.drugId === selectedRecipeId) ?? recipes[0] ?? null,
    [recipes, selectedRecipeId],
  );
  const selectedFactory = useMemo(
    () => factories.find((factory) => factory.id === selectedFactoryId) ?? factories[0] ?? null,
    [factories, selectedFactoryId],
  );
  const stockableItems = useMemo(
    () => filterStockableComponentItems(player?.inventory ?? [], selectedFactory),
    [player?.inventory, selectedFactory],
  );
  const selectedComponentItem = useMemo(
    () =>
      stockableItems.find((item) => item.id === selectedComponentItemId) ??
      stockableItems[0] ??
      null,
    [selectedComponentItemId, stockableItems],
  );
  const totalStoredOutput = useMemo(
    () => factories.reduce((total, factory) => total + factory.storedOutput, 0),
    [factories],
  );
  const blockedFactoriesCount = useMemo(
    () => factories.filter((factory) => factory.blockedReason !== null).length,
    [factories],
  );
  const readyFactoriesCount = useMemo(
    () => factories.filter((factory) => factory.storedOutput > 0).length,
    [factories],
  );

  useEffect(() => {
    if (!selectedRecipe && recipes.length > 0) {
      setSelectedRecipeId(recipes[0]?.drugId ?? null);
      return;
    }

    if (selectedRecipe && selectedRecipe.drugId !== selectedRecipeId) {
      setSelectedRecipeId(selectedRecipe.drugId);
      return;
    }

    if (recipes.length === 0) {
      setSelectedRecipeId(null);
    }
  }, [recipes, selectedRecipe, selectedRecipeId]);

  useEffect(() => {
    if (!selectedFactory && factories.length > 0) {
      setSelectedFactoryId(factories[0]?.id ?? null);
      return;
    }

    if (selectedFactory && selectedFactory.id !== selectedFactoryId) {
      setSelectedFactoryId(selectedFactory.id);
      return;
    }

    if (factories.length === 0) {
      setSelectedFactoryId(null);
    }
  }, [factories, selectedFactory, selectedFactoryId]);

  useEffect(() => {
    if (!selectedComponentItem && stockableItems.length > 0) {
      setSelectedComponentItemId(stockableItems[0]?.id ?? null);
      return;
    }

    if (selectedComponentItem && selectedComponentItem.id !== selectedComponentItemId) {
      setSelectedComponentItemId(selectedComponentItem.id);
      return;
    }

    if (stockableItems.length === 0) {
      setSelectedComponentItemId(null);
    }
  }, [selectedComponentItem, selectedComponentItemId, stockableItems]);

  const handleCreateFactory = useCallback(async () => {
    if (!selectedRecipe) {
      setError('Selecione uma receita para abrir a fábrica.');
      return;
    }

    if ((player?.level ?? 0) < selectedRecipe.levelRequired) {
      setError(`Nível insuficiente para abrir fábrica de ${selectedRecipe.drugName}.`);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await factoryApi.create({
        drugId: selectedRecipe.drugId,
      });
      const message = `Fábrica de ${response.factory.drugName} provisionada na região.`;
      setFeedback(message);
      setBootstrapStatus(message);
      setSelectedFactoryId(response.factory.id);
      await loadFactories();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadFactories, player?.level, selectedRecipe, setBootstrapStatus]);

  const handleStockComponent = useCallback(async () => {
    if (!selectedFactory) {
      setError('Selecione uma fábrica para abastecer.');
      return;
    }

    if (!selectedComponentItem) {
      setError('Selecione um componente do inventário para transferir.');
      return;
    }

    const quantity = sanitizeFactoryQuantity(
      componentQuantityInput,
      selectedComponentItem.quantity,
    );

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await factoryApi.stockComponent(selectedFactory.id, {
        inventoryItemId: selectedComponentItem.id,
        quantity,
      });
      const message = `${response.transferredQuantity}x ${response.component.name} enviados para ${response.factory.drugName}.`;
      setFeedback(message);
      setBootstrapStatus(message);
      setSelectedFactoryId(response.factory.id);
      await loadFactories();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    componentQuantityInput,
    loadFactories,
    selectedComponentItem,
    selectedFactory,
    setBootstrapStatus,
  ]);

  const handleCollectOutput = useCallback(async () => {
    if (!selectedFactory) {
      setError('Selecione uma fábrica para coletar a produção.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await factoryApi.collect(selectedFactory.id);
      const message = `Coletado ${response.collectedQuantity}x ${response.drug.name} da fábrica.`;
      setFeedback(message);
      setBootstrapStatus(message);
      setSelectedFactoryId(response.factory.id);
      await loadFactories();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadFactories, selectedFactory, setBootstrapStatus]);

  const createButtonDisabled =
    !selectedRecipe ||
    isLoading ||
    isSubmitting ||
    (player?.level ?? 0) < selectedRecipe.levelRequired;
  const stockButtonDisabled =
    !selectedFactory || !selectedComponentItem || isLoading || isSubmitting;
  const collectButtonDisabled =
    !selectedFactory || selectedFactory.storedOutput < 1 || isLoading || isSubmitting;

  return (
    <InGameScreenLayout
      subtitle="Gerencie laboratórios, injete componentes do inventário, acompanhe bloqueios por manutenção e puxe a produção pronta para o stash do personagem."
      title="Fábricas"
    >
      <View style={styles.summaryRow}>
        <SummaryCard label="Fábricas" tone={colors.accent} value={`${factories.length}`} />
        <SummaryCard label="Prontas" tone={colors.success} value={`${readyFactoriesCount}`} />
        <SummaryCard label="Estoque" tone={colors.info} value={`${totalStoredOutput}`} />
        <SummaryCard
          label="Caixa"
          tone={colors.warning}
          value={formatFactoryCurrency(player?.resources.money ?? 0)}
        />
      </View>

      {blockedFactoriesCount > 0 ? (
        <Banner
          copy={`${blockedFactoriesCount} fábrica(s) com produção travada por manutenção ou falta de componente.`}
          tone="warning"
        />
      ) : null}
      {error ? <Banner copy={error} tone="danger" /> : null}
      {feedback ? <Banner copy={feedback} tone="neutral" /> : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Receitas disponíveis</Text>
          <Pressable
            onPress={() => {
              void loadFactories();
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.secondaryButtonLabel}>{isLoading ? 'Atualizando...' : 'Sync'}</Text>
          </Pressable>
        </View>

        {recipes.length > 0 ? (
          <View style={styles.cardList}>
            {recipes.map((recipe) => {
              const isSelected = recipe.drugId === selectedRecipe?.drugId;
              const isUnlocked = (player?.level ?? 0) >= recipe.levelRequired;

              return (
                <Pressable
                  key={recipe.drugId}
                  onPress={() => {
                    setSelectedRecipeId(recipe.drugId);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    isSelected ? styles.cardSelected : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardEyebrow}>Nível {recipe.levelRequired}</Text>
                      <Text style={styles.cardTitle}>{recipe.drugName}</Text>
                      <Text style={styles.cardMeta}>
                        {recipe.baseProduction} por ciclo de {recipe.cycleMinutes} min - manutenção{' '}
                        {formatFactoryCurrency(recipe.dailyMaintenanceCost)}/dia
                      </Text>
                    </View>
                    <StatusChip
                      label={isUnlocked ? 'Liberada' : 'Travada'}
                      tone={isUnlocked ? 'success' : 'danger'}
                    />
                  </View>

                  <View style={styles.requirementList}>
                    {recipe.requirements.map((requirement) => (
                      <Text
                        key={`${recipe.drugId}:${requirement.componentId}`}
                        style={styles.requirementText}
                      >
                        {requirement.componentName}: {requirement.quantityPerCycle}/ciclo
                      </Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState copy="Nenhuma receita foi liberada ainda. Quando a primeira mistura abrir, ela aparece aqui." />
        )}

        <Pressable
          disabled={createButtonDisabled}
          onPress={() => {
            void handleCreateFactory();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            createButtonDisabled ? styles.primaryButtonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.primaryButtonLabel}>
            {isSubmitting
              ? 'Provisionando...'
              : `Abrir fábrica de ${selectedRecipe?.drugName ?? 'droga'}`}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fábricas ativas</Text>

        {factories.length > 0 ? (
          <View style={styles.cardList}>
            {factories.map((factory) => {
              const isSelected = factory.id === selectedFactory?.id;

              return (
                <Pressable
                  key={factory.id}
                  onPress={() => {
                    setSelectedFactoryId(factory.id);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    isSelected ? styles.cardSelected : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardEyebrow}>Output {factory.outputPerCycle}/ciclo</Text>
                      <Text style={styles.cardTitle}>{factory.drugName}</Text>
                      <Text style={styles.cardMeta}>
                        {resolveFactoryStatus(factory)} - estoque {factory.storedOutput} -
                        manutenção {formatFactoryCurrency(factory.dailyMaintenanceCost)}/dia
                      </Text>
                    </View>
                    <StatusChip
                      label={factory.blockedReason === null ? 'Operando' : 'Atenção'}
                      tone={resolveFactoryTone(factory)}
                    />
                  </View>

                  <View style={styles.metricRow}>
                    <MetricPill label="Ciclo" value={`${factory.cycleMinutes} min`} />
                    <MetricPill
                      label="Overdue"
                      value={`${factory.maintenanceStatus.overdueDays} d`}
                    />
                    <MetricPill
                      label="Sync"
                      value={formatFactoryCurrency(factory.maintenanceStatus.moneySpentOnSync)}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState copy="Você ainda não abriu nenhuma fábrica. Escolha uma receita acima para ativar o primeiro laboratório." />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gerenciar fábrica</Text>

        {selectedFactory ? (
          <View style={styles.managementCard}>
            <View style={styles.managementHeader}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardEyebrow}>Região {selectedFactory.regionId}</Text>
                <Text style={styles.managementTitle}>{selectedFactory.drugName}</Text>
                <Text style={styles.managementCopy}>{resolveFactoryStatus(selectedFactory)}</Text>
              </View>
              <StatusChip
                label={`${selectedFactory.storedOutput} prontos`}
                tone={selectedFactory.storedOutput > 0 ? 'success' : 'info'}
              />
            </View>

            <View style={styles.metricRow}>
              <MetricPill label="Base" value={`${selectedFactory.baseProduction}`} />
              <MetricPill label="Output" value={`${selectedFactory.outputPerCycle}`} />
              <MetricPill
                label="Impulso"
                value={`${selectedFactory.multipliers.impulse.toFixed(2)}x`}
              />
              <MetricPill
                label="Vocação"
                value={`${selectedFactory.multipliers.vocation.toFixed(2)}x`}
              />
            </View>

            <View style={styles.requirementPanel}>
              <Text style={styles.panelTitle}>Componentes por ciclo</Text>
              {selectedFactory.requirements.map((requirement) => {
                const hasEnough = requirement.availableQuantity >= requirement.quantityPerCycle;

                return (
                  <View
                    key={`${selectedFactory.id}:${requirement.componentId}`}
                    style={styles.requirementRow}
                  >
                    <View style={styles.requirementCopy}>
                      <Text style={styles.requirementName}>{requirement.componentName}</Text>
                      <Text style={styles.requirementSubcopy}>
                        Necessário: {requirement.quantityPerCycle} - em estoque:{' '}
                        {requirement.availableQuantity}
                      </Text>
                    </View>
                    <StatusChip
                      label={hasEnough ? 'OK' : 'Falta'}
                      tone={hasEnough ? 'success' : 'warning'}
                    />
                  </View>
                );
              })}
            </View>

            <View style={styles.requirementPanel}>
              <Text style={styles.panelTitle}>Abastecer componentes</Text>
              {stockableItems.length > 0 ? (
                <View style={styles.cardList}>
                  {stockableItems.map((item) => {
                    const isSelected = item.id === selectedComponentItem?.id;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          setSelectedComponentItemId(item.id);
                        }}
                        style={({ pressed }) => [
                          styles.compactCard,
                          isSelected ? styles.compactCardSelected : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.compactCardTitle}>
                          {item.itemName ?? 'Componente sem nome'}
                        </Text>
                        <Text style={styles.compactCardMeta}>
                          qtd. inventário {item.quantity} - peso {item.totalWeight}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <EmptyState copy="Nenhum componente útil para esta fábrica está disponível no inventário." />
              )}

              <View style={styles.inputRow}>
                <View style={styles.inputShell}>
                  <Text style={styles.inputLabel}>Quantidade</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setComponentQuantityInput}
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    value={componentQuantityInput}
                  />
                </View>
                <Pressable
                  disabled={stockButtonDisabled}
                  onPress={() => {
                    void handleStockComponent();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.inlineButton,
                    stockButtonDisabled ? styles.primaryButtonDisabled : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {isSubmitting ? 'Enviando...' : 'Estocar'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              disabled={collectButtonDisabled}
              onPress={() => {
                void handleCollectOutput();
              }}
              style={({ pressed }) => [
                styles.collectButton,
                collectButtonDisabled ? styles.collectButtonDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.collectButtonLabel}>
                {isSubmitting
                  ? 'Coletando...'
                  : `Coletar ${selectedFactory.storedOutput} unidades prontas`}
              </Text>
            </Pressable>
          </View>
        ) : (
          <EmptyState copy="Selecione uma fábrica ativa para abastecer componentes e coletar a produção pronta." />
        )}
      </View>
    </InGameScreenLayout>
  );
}
