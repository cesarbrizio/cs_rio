import { type PlayerProfile, type TerritoryFavelaSummary } from '@cs-rio/shared';
import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { buildWarResultCue, type WarResultCue } from '../features/war-results';
import { rememberSeenWarResult } from '../features/war-result-storage';
import { formatApiError, territoryApi } from '../services/api';
import { extractResponseMessage, parsePositiveInteger, parseWarPreparationInput } from './territoryScreenSupport';
import { resolveWarSideLabel } from '../features/territory';

interface UseTerritoryScreenMutationsInput {
  baileBudgetInput: string;
  baileEntryPriceInput: string;
  loadTerritoryHub: (preferredFavelaId: null | string, preferredRegionId: null | string) => Promise<null | string>;
  player: null | Pick<PlayerProfile, 'faction' | 'id' | 'regionId'>;
  refreshPlayerProfile: () => Promise<unknown>;
  runContext: {
    selectedFavela: null | TerritoryFavelaSummary;
    selectedFavelaId: null | string;
    selectedRegionId: null | string;
    selectedWarSide: null | 'attacker' | 'defender';
    selectedBaileTier: 'estelar' | 'local' | 'regional';
    warBudgetInput: string;
    warSoldierCommitmentInput: string;
  };
  setBootstrapStatus: (status: string) => void;
  setErrorMessage: Dispatch<SetStateAction<null | string>>;
  setFeedbackMessage: Dispatch<SetStateAction<null | string>>;
  setIsMutating: Dispatch<SetStateAction<boolean>>;
  setWarResultCue: Dispatch<SetStateAction<null | WarResultCue>>;
}

export function useTerritoryScreenMutations({
  baileBudgetInput,
  baileEntryPriceInput,
  loadTerritoryHub,
  player,
  refreshPlayerProfile,
  runContext,
  setBootstrapStatus,
  setErrorMessage,
  setFeedbackMessage,
  setIsMutating,
  setWarResultCue,
}: UseTerritoryScreenMutationsInput) {
  const {
    selectedBaileTier,
    selectedFavela,
    selectedFavelaId,
    selectedRegionId,
    selectedWarSide,
    warBudgetInput,
    warSoldierCommitmentInput,
  } = runContext;

  const runMutation = useCallback(
    async (action: () => Promise<unknown>, fallbackMessage: string) => {
      const focusFavelaId = selectedFavela?.id ?? selectedFavelaId;

      if (!focusFavelaId) {
        setErrorMessage('Selecione uma favela antes de executar a ação.');
        return;
      }

      setIsMutating(true);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        const result = await action();
        await refreshPlayerProfile();
        await loadTerritoryHub(focusFavelaId, selectedFavela?.regionId ?? selectedRegionId);

        const message = extractResponseMessage(result) ?? fallbackMessage;
        setFeedbackMessage(message);
        setBootstrapStatus(message);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setIsMutating(false);
      }
    },
    [
      loadTerritoryHub,
      refreshPlayerProfile,
      selectedFavela,
      selectedFavelaId,
      selectedRegionId,
      setBootstrapStatus,
      setErrorMessage,
      setFeedbackMessage,
      setIsMutating,
    ],
  );

  const handleConquer = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.conquer(selectedFavela.id),
      `Ataque enviado para tomar ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  const handleDeclareWar = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.declareWar(selectedFavela.id),
      `Guerra declarada em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  const handlePrepareWar = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    const parsedInput = parseWarPreparationInput(warBudgetInput, warSoldierCommitmentInput);

    if (!parsedInput) {
      const message = 'Informe budget e comprometimento de soldados validos para a guerra.';
      setErrorMessage(message);
      setBootstrapStatus(message);
      return;
    }

    await runMutation(
      () => territoryApi.prepareWar(selectedFavela.id, parsedInput),
      `Lado ${selectedWarSide ? resolveWarSideLabel(selectedWarSide).toLowerCase() : ''} preparado para a guerra.`,
    );
  }, [
    runMutation,
    selectedFavela,
    selectedWarSide,
    setBootstrapStatus,
    setErrorMessage,
    warBudgetInput,
    warSoldierCommitmentInput,
  ]);

  const handleAdvanceWarRound = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const result = await territoryApi.resolveWarRound(selectedFavela.id);
      await refreshPlayerProfile();
      await loadTerritoryHub(selectedFavela.id, selectedFavela.regionId);

      const cue = buildWarResultCue(result.favela, player);

      if (cue && player?.id) {
        await rememberSeenWarResult(player.id, cue.key);
        setWarResultCue(cue);
        setBootstrapStatus(cue.body);
      } else {
        const message =
          extractResponseMessage(result) ?? `Round de guerra resolvido em ${selectedFavela.name}.`;
        setFeedbackMessage(message);
        setBootstrapStatus(message);
      }
    } catch (error) {
      const message = formatApiError(error).message;
      setErrorMessage(message);
      setBootstrapStatus(message);
    } finally {
      setIsMutating(false);
    }
  }, [
    loadTerritoryHub,
    player,
    refreshPlayerProfile,
    selectedFavela,
    setBootstrapStatus,
    setErrorMessage,
    setFeedbackMessage,
    setIsMutating,
    setWarResultCue,
  ]);

  const handleInstallService = useCallback(
    async (
      serviceType: Awaited<
        ReturnType<typeof territoryApi.getServices>
      >['services'][number]['definition']['type'],
    ) => {
      if (!selectedFavela) {
        return;
      }

      await runMutation(
        () => territoryApi.installService(selectedFavela.id, { serviceType }),
        'Servico territorial instalado.',
      );
    },
    [runMutation, selectedFavela],
  );

  const handleUpgradeService = useCallback(
    async (
      serviceType: Awaited<
        ReturnType<typeof territoryApi.getServices>
      >['services'][number]['definition']['type'],
    ) => {
      if (!selectedFavela) {
        return;
      }

      await runMutation(
        () => territoryApi.upgradeService(selectedFavela.id, serviceType),
        'Servico territorial melhorado.',
      );
    },
    [runMutation, selectedFavela],
  );

  const handleNegotiatePropina = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.negotiatePropina(selectedFavela.id),
      `Arrego negociado em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  const handleOrganizeBaile = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    const budget = parsePositiveInteger(baileBudgetInput);
    const entryPrice = parsePositiveInteger(baileEntryPriceInput);

    if (budget === null || entryPrice === null) {
      const message = 'Informe budget e ingresso validos para organizar o baile.';
      setErrorMessage(message);
      setBootstrapStatus(message);
      return;
    }

    await runMutation(
      () =>
        territoryApi.organizeBaile(selectedFavela.id, {
          budget,
          entryPrice,
          mcTier: selectedBaileTier,
        }),
      `Baile organizado em ${selectedFavela.name}.`,
    );
  }, [
    baileBudgetInput,
    baileEntryPriceInput,
    runMutation,
    selectedBaileTier,
    selectedFavela,
    setBootstrapStatus,
    setErrorMessage,
  ]);

  const handleX9Desenrolo = useCallback(async () => {
    if (!selectedFavela) {
      return;
    }

    await runMutation(
      () => territoryApi.attemptX9Desenrolo(selectedFavela.id),
      `Desenrolo tentado em ${selectedFavela.name}.`,
    );
  }, [runMutation, selectedFavela]);

  return {
    handleAdvanceWarRound,
    handleConquer,
    handleDeclareWar,
    handleInstallService,
    handleNegotiatePropina,
    handleOrganizeBaile,
    handlePrepareWar,
    handleUpgradeService,
    handleX9Desenrolo,
  };
}
