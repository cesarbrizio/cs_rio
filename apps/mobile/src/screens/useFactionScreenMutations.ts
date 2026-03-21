import {
  type FactionCoordinationKind,
  type FactionMemberSummary,
  type FactionUpgradeType,
} from '@cs-rio/shared';
import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { factionApi, factionCrimeApi, formatApiError } from '../services/api';
import { factionRealtimeService, type FactionRealtimeSnapshot } from '../services/factionRealtime';
import { parsePositiveAmount } from './factionScreenSupport';

interface UseFactionScreenMutationsInput {
  chatMessage: string;
  configAbbreviation: string;
  configDescription: string;
  configName: string;
  coordinationKind: FactionCoordinationKind;
  coordinationLabel: string;
  createAbbreviation: string;
  createDescription: string;
  createName: string;
  currentFactionId: null | string;
  depositAmount: string;
  loadFactionHub: () => Promise<void>;
  recruitNickname: string;
  realtimeStatus: FactionRealtimeSnapshot['status'];
  refreshPlayerProfile: () => Promise<unknown>;
  selectedCrime: null | {
    id: string;
  };
  selectedParticipantIds: string[];
  setBootstrapStatus: (status: string) => void;
  setChatMessage: Dispatch<SetStateAction<string>>;
  setCoordinationLabel: Dispatch<SetStateAction<string>>;
  setCreateAbbreviation: Dispatch<SetStateAction<string>>;
  setCreateDescription: Dispatch<SetStateAction<string>>;
  setCreateName: Dispatch<SetStateAction<string>>;
  setDepositAmount: Dispatch<SetStateAction<string>>;
  setErrorMessage: Dispatch<SetStateAction<null | string>>;
  setFeedbackMessage: Dispatch<SetStateAction<null | string>>;
  setIsMutating: Dispatch<SetStateAction<boolean>>;
  setRecruitNickname: Dispatch<SetStateAction<string>>;
  setWithdrawAmount: Dispatch<SetStateAction<string>>;
  withdrawAmount: string;
}

export function useFactionScreenMutations({
  chatMessage,
  configAbbreviation,
  configDescription,
  configName,
  coordinationKind,
  coordinationLabel,
  createAbbreviation,
  createDescription,
  createName,
  currentFactionId,
  depositAmount,
  loadFactionHub,
  recruitNickname,
  realtimeStatus,
  refreshPlayerProfile,
  selectedCrime,
  selectedParticipantIds,
  setBootstrapStatus,
  setChatMessage,
  setCoordinationLabel,
  setCreateAbbreviation,
  setCreateDescription,
  setCreateName,
  setDepositAmount,
  setErrorMessage,
  setFeedbackMessage,
  setIsMutating,
  setRecruitNickname,
  setWithdrawAmount,
  withdrawAmount,
}: UseFactionScreenMutationsInput) {
  const runMutation = useCallback(
    async (
      action: () => Promise<unknown>,
      successMessage: string,
      options: {
        refreshProfile?: boolean;
      } = {},
    ) => {
      setIsMutating(true);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        await action();

        if (options.refreshProfile !== false) {
          await refreshPlayerProfile();
        }

        await loadFactionHub();
        setFeedbackMessage(successMessage);
        setBootstrapStatus(successMessage);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setIsMutating(false);
      }
    },
    [
      loadFactionHub,
      refreshPlayerProfile,
      setBootstrapStatus,
      setErrorMessage,
      setFeedbackMessage,
      setIsMutating,
    ],
  );

  const handleRefresh = useCallback(async () => {
    setFeedbackMessage('Painel da facção atualizado.');
    setBootstrapStatus('Painel da facção atualizado.');
    await Promise.all([loadFactionHub(), refreshPlayerProfile()]);
  }, [loadFactionHub, refreshPlayerProfile, setBootstrapStatus, setFeedbackMessage]);

  const handleCreateFaction = useCallback(async () => {
    await runMutation(async () => {
      await factionApi.create({
        abbreviation: createAbbreviation.trim().toUpperCase(),
        description: createDescription.trim() || null,
        name: createName.trim(),
      });
      setCreateAbbreviation('');
      setCreateDescription('');
      setCreateName('');
    }, 'Facção criada e vinculada ao personagem.');
  }, [
    createAbbreviation,
    createDescription,
    createName,
    runMutation,
    setCreateAbbreviation,
    setCreateDescription,
    setCreateName,
  ]);

  const handleUpdateFaction = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(async () => {
      await factionApi.update(currentFactionId, {
        abbreviation: configAbbreviation.trim().toUpperCase(),
        description: configDescription.trim() || null,
        name: configName.trim(),
      });
    }, 'Configuração da facção atualizada.');
  }, [configAbbreviation, configDescription, configName, currentFactionId, runMutation]);

  const handleLeaveFaction = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(async () => factionApi.leave(currentFactionId), 'Você saiu da facção atual.');
  }, [currentFactionId, runMutation]);

  const handleDissolveFaction = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => factionApi.dissolve(currentFactionId),
      'Facção dissolvida com sucesso.',
    );
  }, [currentFactionId, runMutation]);

  const handleRecruitMember = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => {
        await factionApi.recruit(currentFactionId, {
          nickname: recruitNickname.trim(),
        });
        setRecruitNickname('');
      },
      'Convite enviado para o jogador.',
      {
        refreshProfile: false,
      },
    );
  }, [currentFactionId, recruitNickname, runMutation, setRecruitNickname]);

  const handleJoinFixedFaction = useCallback(
    async (factionId: string) => {
      await runMutation(
        async () => factionApi.join(factionId),
        'Você entrou na facção fixa como cria.',
      );
    },
    [runMutation],
  );

  const handleDeposit = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    const parsedAmount = parsePositiveAmount(depositAmount);

    if (!parsedAmount) {
      setErrorMessage('Informe um valor positivo para depositar.');
      return;
    }

    await runMutation(async () => {
      await factionApi.deposit(currentFactionId, { amount: parsedAmount });
      setDepositAmount('');
    }, 'Depósito efetuado no banco da facção.');
  }, [currentFactionId, depositAmount, runMutation, setDepositAmount, setErrorMessage]);

  const handleWithdraw = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    const parsedAmount = parsePositiveAmount(withdrawAmount);

    if (!parsedAmount) {
      setErrorMessage('Informe um valor positivo para sacar.');
      return;
    }

    await runMutation(async () => {
      await factionApi.withdraw(currentFactionId, { amount: parsedAmount });
      setWithdrawAmount('');
    }, 'Saque efetuado no banco da facção.');
  }, [currentFactionId, runMutation, setErrorMessage, setWithdrawAmount, withdrawAmount]);

  const handleUnlockUpgrade = useCallback(
    async (upgradeType: FactionUpgradeType) => {
      if (!currentFactionId) {
        return;
      }

      await runMutation(
        async () => factionApi.unlockUpgrade(currentFactionId, upgradeType),
        'Upgrade coletivo desbloqueado.',
        {
          refreshProfile: false,
        },
      );
    },
    [currentFactionId, runMutation],
  );

  const handleSupportElection = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(
      async () => factionApi.supportLeadershipElection(currentFactionId),
      'Seu apoio foi registrado na disputa da facção.',
      {
        refreshProfile: false,
      },
    );
  }, [currentFactionId, runMutation]);

  const handleVoteCandidate = useCallback(
    async (candidatePlayerId: string) => {
      if (!currentFactionId) {
        return;
      }

      await runMutation(
        async () => {
          await factionApi.voteLeadership(currentFactionId, { candidatePlayerId });
        },
        'Voto registrado na eleição da facção.',
        {
          refreshProfile: false,
        },
      );
    },
    [currentFactionId, runMutation],
  );

  const handleChallengeLeadership = useCallback(async () => {
    if (!currentFactionId) {
      return;
    }

    await runMutation(async () => {
      const response = await factionApi.challengeLeadership(currentFactionId);
      const resultLabel = response.result.challengerWon
        ? `${response.result.challengerNickname} tomou a liderança na porrada.`
        : `${response.result.defenderNickname} segurou a liderança.`;
      setFeedbackMessage(resultLabel);
    }, 'Desafio de liderança resolvido.');
  }, [currentFactionId, runMutation, setFeedbackMessage]);

  const handleMemberAction = useCallback(
    async (action: 'demote' | 'expel' | 'promote', member: FactionMemberSummary) => {
      if (!currentFactionId) {
        return;
      }

      const operation = async () => {
        if (action === 'promote') {
          await factionApi.promote(currentFactionId, member.id);
          return;
        }

        if (action === 'demote') {
          await factionApi.demote(currentFactionId, member.id);
          return;
        }

        await factionApi.expel(currentFactionId, member.id);
      };

      const labels = {
        demote: `${member.nickname} foi rebaixado na hierarquia.`,
        expel: `${member.nickname} foi removido da facção.`,
        promote: `${member.nickname} subiu na hierarquia.`,
      } as const;

      await runMutation(operation, labels[action], {
        refreshProfile: false,
      });
    },
    [currentFactionId, runMutation],
  );

  const handleLaunchFactionCrime = useCallback(async () => {
    if (!currentFactionId || !selectedCrime) {
      return;
    }

    await runMutation(async () => {
      const response = await factionCrimeApi.attempt(currentFactionId, selectedCrime.id, {
        participantIds: selectedParticipantIds,
      });
      setFeedbackMessage(response.message);
    }, 'Crime coletivo disparado para o bonde.');
  }, [currentFactionId, runMutation, selectedCrime, selectedParticipantIds, setFeedbackMessage]);

  const handleSendChat = useCallback(() => {
    if (realtimeStatus !== 'connected') {
      setErrorMessage('A sala da facção ainda não abriu.');
      return;
    }

    if (!chatMessage.trim()) {
      setErrorMessage('Escreva uma mensagem para o chat da facção.');
      return;
    }

    factionRealtimeService.sendChatMessage(chatMessage);
    setChatMessage('');
    setFeedbackMessage('Mensagem enviada para a sala da facção.');
  }, [chatMessage, realtimeStatus, setChatMessage, setErrorMessage, setFeedbackMessage]);

  const handleSendCoordination = useCallback(() => {
    if (realtimeStatus !== 'connected') {
      setErrorMessage('A sala da facção ainda não abriu.');
      return;
    }

    if (!coordinationLabel.trim()) {
      setErrorMessage('Defina um alvo curto para a chamada de coordenação.');
      return;
    }

    factionRealtimeService.sendCoordinationMessage({
      kind: coordinationKind,
      label: coordinationLabel,
    });
    setCoordinationLabel('');
    setFeedbackMessage('Chamada de coordenação publicada para a facção.');
  }, [
    coordinationKind,
    coordinationLabel,
    realtimeStatus,
    setCoordinationLabel,
    setErrorMessage,
    setFeedbackMessage,
  ]);

  return {
    handleChallengeLeadership,
    handleCreateFaction,
    handleDeposit,
    handleDissolveFaction,
    handleJoinFixedFaction,
    handleLaunchFactionCrime,
    handleLeaveFaction,
    handleMemberAction,
    handleRecruitMember,
    handleRefresh,
    handleSendChat,
    handleSendCoordination,
    handleSupportElection,
    handleUnlockUpgrade,
    handleUpdateFaction,
    handleVoteCandidate,
    handleWithdraw,
  };
}
