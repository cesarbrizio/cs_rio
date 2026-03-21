import { useCallback } from 'react';

import {
  formatOperationsCurrency,
  formatPercent,
  type OperationsDashboardData,
  type OperationsTab,
  resolvePropertyRegionLabel,
} from '../features/operations';
import { formatApiError, propertyApi, puteiroApi, slotMachineApi } from '../services/api';
import {
  collectPropertyOperation,
  sanitizePercentageInput,
  sanitizePositiveInteger,
} from './operationsScreenSupport';
import type { UseOperationsScreenMutationsInput } from './useOperationsScreenMutations.types';

export function useOperationsScreenMutations({
  gpHireQuantity,
  hireQuantity,
  loadDashboard,
  playerMoney,
  playerRegionId,
  puteiroAcquisition,
  selectedGpTemplate,
  selectedOperation,
  selectedProperty,
  selectedPuteiro,
  selectedSoldierTemplate,
  setActiveTab,
  setBootstrapStatus,
  setError,
  setFeedback,
  setIsSubmitting,
  setOperationResult,
  setPendingFocusPropertyId,
  setSelectedPropertyId,
  setSlotMachineActionMode,
  slotMachineAcquisition,
  slotMachineHouseEdgeInput,
  slotMachineInstallQuantityInput,
  slotMachineJackpotInput,
  slotMachineMaxBetInput,
  slotMachineMinBetInput,
}: UseOperationsScreenMutationsInput) {
  const handleRefresh = useCallback(async () => {
    setFeedback('Ativos atualizados. A manutenção é debitada automaticamente quando houver saldo.');
    setBootstrapStatus('Ativos prontos para o corre.');
    await loadDashboard();
  }, [loadDashboard, setBootstrapStatus, setFeedback]);

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
  }, [
    loadDashboard,
    selectedProperty,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
  ]);

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
  }, [
    hireQuantity,
    loadDashboard,
    selectedProperty,
    selectedSoldierTemplate,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
  ]);

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
      if (selectedProperty.type === 'slot_machine' || selectedProperty.type === 'puteiro') {
        setOperationResult({
          message,
          title:
            selectedProperty.type === 'puteiro'
              ? 'Puteiro atualizado'
              : 'Maquininha atualizada',
        });
      }
      setBootstrapStatus(message);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    loadDashboard,
    selectedOperation,
    selectedProperty,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
    setOperationResult,
  ]);

  const handleInstallSlotMachines = useCallback(async () => {
    if (!selectedProperty || selectedProperty.type !== 'slot_machine') {
      setError('Selecione uma maquininha antes de instalar novas unidades.');
      return;
    }

    const quantity = sanitizePositiveInteger(slotMachineInstallQuantityInput);

    if (quantity <= 0) {
      setError('Informe uma quantidade inteira positiva para instalar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await slotMachineApi.install(selectedProperty.id, {
        quantity,
      });
      const message = `${response.installedQuantity} maquina(s) instalada(s). Custo total ${formatOperationsCurrency(response.totalInstallCost)}.`;
      setFeedback(message);
      setOperationResult({
        message,
        title: 'Maquininha atualizada',
      });
      setBootstrapStatus(message);
      setSlotMachineActionMode(null);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    loadDashboard,
    selectedProperty,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
    setOperationResult,
    setSlotMachineActionMode,
    slotMachineInstallQuantityInput,
  ]);

  const handlePurchaseSlotMachine = useCallback(async () => {
    if (!slotMachineAcquisition.definition || !slotMachineAcquisition.purchaseInput) {
      setError(
        slotMachineAcquisition.blockerLabel ??
          'Nao foi possivel montar a compra da maquininha.',
      );
      return;
    }

    if (!slotMachineAcquisition.canPurchase) {
      setError(
        slotMachineAcquisition.blockerLabel ??
          'A compra da maquininha ainda nao esta liberada.',
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await propertyApi.purchase(slotMachineAcquisition.purchaseInput);
      const message = `${response.property.definition.label} comprada por ${formatOperationsCurrency(response.purchaseCost)} em ${resolvePropertyRegionLabel(response.property.regionId)}. Proximo passo: instalar as maquinas do ponto.`;
      setFeedback(message);
      setOperationResult({
        message,
        title: 'Maquininha atualizada',
      });
      setBootstrapStatus(message);
      setActiveTab('business');
      setPendingFocusPropertyId(response.property.id);
      setSelectedPropertyId(response.property.id);
      setSlotMachineActionMode('install');
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    loadDashboard,
    setActiveTab,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
    setOperationResult,
    setPendingFocusPropertyId,
    setSelectedPropertyId,
    setSlotMachineActionMode,
    slotMachineAcquisition,
  ]);

  const handleConfigureSlotMachine = useCallback(async () => {
    if (!selectedProperty || selectedProperty.type !== 'slot_machine') {
      setError('Selecione uma maquininha antes de configurar a operação.');
      return;
    }

    const houseEdge = sanitizePercentageInput(slotMachineHouseEdgeInput);
    const jackpotChance = sanitizePercentageInput(slotMachineJackpotInput);
    const minBet = sanitizePositiveInteger(slotMachineMinBetInput);
    const maxBet = sanitizePositiveInteger(slotMachineMaxBetInput);

    if (houseEdge <= 0 || jackpotChance <= 0 || minBet <= 0 || maxBet <= 0) {
      setError('Preencha margem, jackpot e apostas com valores válidos.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await slotMachineApi.configure(selectedProperty.id, {
        houseEdge,
        jackpotChance,
        maxBet,
        minBet,
      });
      const message = `Maquininha configurada. Casa ${formatPercent(houseEdge)} · jackpot ${formatPercent(jackpotChance)} · faixa ${formatOperationsCurrency(minBet)} → ${formatOperationsCurrency(maxBet)}.`;
      setFeedback(message);
      setOperationResult({
        message,
        title: 'Maquininha atualizada',
      });
      setBootstrapStatus(message);
      setSlotMachineActionMode(null);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    loadDashboard,
    selectedProperty,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
    setOperationResult,
    setSlotMachineActionMode,
    slotMachineHouseEdgeInput,
    slotMachineJackpotInput,
    slotMachineMaxBetInput,
    slotMachineMinBetInput,
  ]);

  const handlePurchasePuteiro = useCallback(async () => {
    if (!puteiroAcquisition.definition || !puteiroAcquisition.purchaseInput) {
      setError(
        puteiroAcquisition.blockerLabel ??
          'Nao foi possivel montar a compra do puteiro.',
      );
      return;
    }

    if (!puteiroAcquisition.canPurchase) {
      setError(
        puteiroAcquisition.blockerLabel ??
          'A compra do puteiro ainda nao esta liberada.',
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await propertyApi.purchase(puteiroAcquisition.purchaseInput);
      const message = `${response.property.definition.label} comprado por ${formatOperationsCurrency(response.purchaseCost)} em ${resolvePropertyRegionLabel(response.property.regionId)}. Proximo passo: contratar o elenco para começar a girar caixa.`;
      setFeedback(message);
      setOperationResult({
        message,
        title: 'Puteiro atualizado',
      });
      setBootstrapStatus(message);
      setActiveTab('business');
      setPendingFocusPropertyId(response.property.id);
      setSelectedPropertyId(response.property.id);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    loadDashboard,
    puteiroAcquisition,
    setActiveTab,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
    setOperationResult,
    setPendingFocusPropertyId,
    setSelectedPropertyId,
  ]);

  const handlePurchaseDefinition = useCallback(
    async (
      definition: NonNullable<OperationsDashboardData['propertyBook']>['availableProperties'][number],
    ) => {
      if (!playerRegionId) {
        setError('Defina uma região válida antes de comprar o ativo.');
        return;
      }

      if (definition.stockAvailable !== null && definition.stockAvailable <= 0) {
        setError('Nao existe slot livre ou estoque restante para esse ativo agora.');
        return;
      }

      if (playerMoney < definition.basePrice) {
        setError('Fundos insuficientes para comprar esse ativo.');
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const response = await propertyApi.purchase({
          regionId: playerRegionId,
          type: definition.type,
        });
        const message = `${response.property.definition.label} comprado por ${formatOperationsCurrency(response.purchaseCost)} em ${resolvePropertyRegionLabel(response.property.regionId)}.`;
        setFeedback(message);
        setBootstrapStatus(message);
        setActiveTab(definition.category === 'business' ? 'business' : 'patrimony');
        setPendingFocusPropertyId(response.property.id);
        setSelectedPropertyId(response.property.id);
        await loadDashboard();
      } catch (nextError) {
        setError(formatApiError(nextError).message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      loadDashboard,
      playerMoney,
      playerRegionId,
      setActiveTab,
      setBootstrapStatus,
      setError,
      setFeedback,
      setIsSubmitting,
      setPendingFocusPropertyId,
      setSelectedPropertyId,
    ],
  );

  const handleHireGps = useCallback(async () => {
    if (!selectedProperty || selectedProperty.type !== 'puteiro') {
      setError('Selecione um puteiro antes de contratar GPs.');
      return;
    }

    if (!selectedPuteiro) {
      setError('Painel do puteiro indisponível. Reabra a tela e tente de novo.');
      return;
    }

    if (!selectedGpTemplate) {
      setError('Selecione um template de GP antes de contratar.');
      return;
    }

    if (selectedPuteiro.economics.availableSlots <= 0) {
      setError(
        'Lotação máxima atingida. Aguarde vagas ou reduza o elenco antes de contratar.',
      );
      return;
    }

    if (gpHireQuantity > selectedPuteiro.economics.availableSlots) {
      setError(
        `Só restam ${selectedPuteiro.economics.availableSlots} vaga(s) livres nesse puteiro.`,
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await puteiroApi.hireGps(selectedProperty.id, {
        quantity: gpHireQuantity,
        type: selectedGpTemplate.type,
      });
      const message = `${response.hiredGps.length}x ${selectedGpTemplate.label} contratada(s) por ${formatOperationsCurrency(response.totalPurchaseCost)}. Lotação ${response.puteiro.economics.activeGps}/${response.puteiro.economics.capacity}.`;
      setFeedback(message);
      setOperationResult({
        message,
        title: 'Puteiro atualizado',
      });
      setBootstrapStatus(message);
      await loadDashboard();
    } catch (nextError) {
      setError(formatApiError(nextError).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    gpHireQuantity,
    loadDashboard,
    selectedGpTemplate,
    selectedProperty,
    selectedPuteiro,
    setBootstrapStatus,
    setError,
    setFeedback,
    setIsSubmitting,
    setOperationResult,
  ]);

  return {
    handleCollect,
    handleConfigureSlotMachine,
    handleHireGps,
    handleHireSoldiers,
    handleInstallSlotMachines,
    handlePurchaseDefinition,
    handlePurchasePuteiro,
    handlePurchaseSlotMachine,
    handleRefresh,
    handleUpgrade,
  };
}
