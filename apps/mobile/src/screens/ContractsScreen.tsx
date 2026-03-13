import {
  type PvpAssassinationContractsResponse,
  type PvpContractExecutionResponse,
} from '@cs-rio/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type RootStackParamList } from '../../App';
import { useAudio } from '../audio/AudioProvider';
import { resolveCombatResultSfx } from '../audio/audioFeedback';
import { FeedbackBurst } from '../components/FeedbackBurst';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildContractExecutionHighlights,
  buildContractTargets,
  formatContractCountdown,
  formatContractTimestamp,
  resolveContractNotificationLabel,
  resolveContractStatusLabel,
} from '../features/contracts';
import { formatCombatCurrency, resolveCombatTierLabel, resolveCombatTierTone } from '../features/combat';
import { colyseusService, type RealtimeSnapshot } from '../services/colyseus';
import { resolveCombatVisualEffectVariant } from '../features/visualFeedback';
import { formatApiError, pvpApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

const CONTRACT_REWARD_PRESETS = [5000, 10000, 25000, 50000, 100000] as const;
type PendingContractAction = `accept:${string}` | `execute:${string}` | 'create' | 'refresh' | null;

export function ContractsScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const { playSfx } = useAudio();
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>(
    colyseusService.getSnapshot(),
  );
  const [contractsBook, setContractsBook] = useState<PvpAssassinationContractsResponse | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [rewardInput, setRewardInput] = useState('25000');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingContractAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<PvpContractExecutionResponse | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const executionAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => colyseusService.subscribe(setRealtimeSnapshot), []);

  useEffect(() => {
    if (!player?.hasCharacter || !token) {
      return;
    }

    void colyseusService.connectToRegionRoom({
      accessToken: token,
      regionId: player.regionId,
    });
  }, [player?.hasCharacter, player?.regionId, token]);

  useEffect(() => {
    setNowMs(Date.now());

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!lastExecution) {
      return;
    }

    executionAnimation.setValue(0);
    Animated.spring(executionAnimation, {
      damping: 18,
      stiffness: 160,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [executionAnimation, lastExecution]);

  useEffect(() => {
    if (!lastExecution) {
      return;
    }

    void playSfx(resolveCombatResultSfx(lastExecution));
  }, [lastExecution, playSfx]);

  const loadContracts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await pvpApi.listContracts();
      setContractsBook(response);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadContracts();
      return undefined;
    }, [loadContracts]),
  );

  const targetOptions = useMemo(
    () =>
      buildContractTargets({
        currentPlayerId: player?.id,
        realtimePlayers: realtimeSnapshot.players,
      }),
    [player?.id, realtimeSnapshot.players],
  );
  const selectedTarget = useMemo(
    () => targetOptions.find((target) => target.id === selectedTargetId) ?? null,
    [selectedTargetId, targetOptions],
  );

  useEffect(() => {
    setSelectedTargetId((currentTargetId) => {
      if (!targetOptions.length) {
        return null;
      }

      if (currentTargetId && targetOptions.some((target) => target.id === currentTargetId)) {
        return currentTargetId;
      }

      return targetOptions[0]?.id ?? null;
    });
  }, [targetOptions]);

  const handleRefresh = useCallback(async () => {
    setFeedbackMessage('Sincronizando mural de contratos...');
    setBootstrapStatus('Sincronizando contratos PvP.');
    setPendingAction('refresh');
    try {
      await loadContracts();
      setFeedbackMessage('Mural de contratos sincronizado.');
    } finally {
      setPendingAction(null);
    }
  }, [loadContracts, setBootstrapStatus]);

  const handleCreateContract = useCallback(async () => {
    if (!selectedTargetId || !selectedTarget) {
      setErrorMessage('Selecione um alvo online antes de lançar o contrato.');
      return;
    }

    const reward = Math.max(0, Math.round(Number.parseInt(rewardInput.replace(/\D/g, ''), 10) || 0));

    if (reward <= 0) {
      setErrorMessage('Defina uma recompensa válida antes de criar o contrato.');
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setFeedbackMessage(`Subindo contrato contra ${selectedTarget.nickname}...`);
    setPendingAction('create');

    try {
      const response = await pvpApi.createContract(selectedTargetId, reward);
      await Promise.all([refreshPlayerProfile(), loadContracts()]);

      const message =
        `Contrato na rua contra ${response.contract.targetNickname}. Total travado: ${formatCombatCurrency(response.contract.totalCost)}.`;
      setFeedbackMessage(message);
      setBootstrapStatus(message);
    } catch (error) {
      const message = formatApiError(error).message;
      setErrorMessage(message);
      setBootstrapStatus(message);
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }, [
    loadContracts,
    refreshPlayerProfile,
    rewardInput,
    selectedTarget,
    selectedTargetId,
    setBootstrapStatus,
  ]);

  const handleAcceptContract = useCallback(
    async (contractId: string) => {
      setIsMutating(true);
      setErrorMessage(null);
      setFeedbackMessage('Aceitando contrato no mural...');
      setPendingAction(`accept:${contractId}`);

      try {
        const response = await pvpApi.acceptContract(contractId);
        await loadContracts();

        const message = `Contrato aceito: ${response.contract.targetNickname} agora está na sua mira.`;
        setFeedbackMessage(message);
        setBootstrapStatus(message);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setIsMutating(false);
        setPendingAction(null);
      }
    },
    [loadContracts, setBootstrapStatus],
  );

  const handleExecuteContract = useCallback(
    async (contractId: string) => {
      setIsMutating(true);
      setErrorMessage(null);
      setFeedbackMessage('Executando contrato...');
      setPendingAction(`execute:${contractId}`);

      try {
        const response = await pvpApi.executeContract(contractId);
        setLastExecution(response);
        await Promise.all([refreshPlayerProfile(), loadContracts()]);

        const message = response.message;
        setFeedbackMessage(message);
        setBootstrapStatus(message);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setIsMutating(false);
        setPendingAction(null);
      }
    },
    [loadContracts, refreshPlayerProfile, setBootstrapStatus],
  );

  const executionHighlights = useMemo(
    () => (lastExecution ? buildContractExecutionHighlights(lastExecution) : []),
    [lastExecution],
  );
  const executionTone = lastExecution ? resolveCombatTierTone(lastExecution.tier) : 'info';
  const executionEffectVariant = useMemo(
    () => (lastExecution ? resolveCombatVisualEffectVariant(lastExecution) : null),
    [lastExecution],
  );
  const executionEffectTriggerKey = useMemo(() => {
    if (!lastExecution) {
      return null;
    }

    return [
      lastExecution.tier,
      lastExecution.success ? '1' : '0',
      String(lastExecution.powerRatio),
      lastExecution.message,
    ].join(':');
  }, [lastExecution]);
  const executionStyle = {
    opacity: executionAnimation,
    transform: [
      {
        translateY: executionAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: executionAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  } as const;

  return (
    <InGameScreenLayout
      subtitle="Encomende um alvo, aceite contratos do mural e execute a missão quando a janela do backend estiver aberta."
      title="Contratos de Assassinato"
    >
      <View style={styles.topActionRow}>
        <Pressable
          onPress={() => {
            navigation.navigate('Combat');
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir combate</Text>
        </Pressable>
        <Pressable
          disabled={isLoading || isMutating}
          onPress={() => {
            void handleRefresh();
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            (isLoading || isMutating) ? styles.buttonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>
            {pendingAction === 'refresh' || isLoading ? 'Sincronizando...' : 'Sincronizar'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <MetaCard
          label="Dinheiro em mãos"
          value={formatCombatCurrency(player?.resources.money ?? 0)}
        />
        <MetaCard
          label="Alvos online"
          value={String(targetOptions.length)}
        />
        <MetaCard
          label="Mural aberto"
          value={String(contractsBook?.availableContracts.length ?? 0)}
        />
      </View>

      {errorMessage ? <InlineBanner message={errorMessage} tone="danger" /> : null}
      {feedbackMessage ? <InlineBanner message={feedbackMessage} tone="info" /> : null}

      <Section title="Lançar contrato">
        {!targetOptions.length ? (
          <EmptyState
            copy="Nenhum alvo online apareceu na sua região agora. Deixe a conexão estabilizar ou abra esta tela com mais jogadores online."
            title="Sem alvo disponível"
          />
        ) : (
          <>
            <View style={styles.grid}>
              {targetOptions.map((target) => {
                const isSelected = selectedTargetId === target.id;

                return (
                  <Pressable
                    disabled={isMutating}
                    key={target.id}
                    onPress={() => {
                      setSelectedTargetId(target.id);
                      setFeedbackMessage(`Alvo ${target.nickname} preparado para contrato.`);
                    }}
                    style={({ pressed }) => [
                      styles.targetCard,
                      isSelected ? styles.targetCardSelected : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <View style={styles.targetHeader}>
                      <Text style={styles.targetName}>{target.nickname}</Text>
                      <Text style={styles.targetTitle}>{target.title}</Text>
                    </View>
                    <Text style={styles.targetSubtitle}>{target.subtitle}</Text>
                    <Text style={isSelected ? styles.targetMetaInfo : styles.targetMetaMuted}>
                      {isSelected ? 'Alvo selecionado' : 'Toque para selecionar'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rewardPanel}>
              <Text style={styles.sectionHint}>
                Recompensa informada: {formatCombatCurrency(Math.max(0, Number.parseInt(rewardInput.replace(/\D/g, ''), 10) || 0))}
              </Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={setRewardInput}
                placeholder="25000"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={rewardInput}
              />
              <View style={styles.rewardChips}>
                {CONTRACT_REWARD_PRESETS.map((preset) => (
                  <Pressable
                    disabled={isMutating}
                    key={preset}
                    onPress={() => {
                      setRewardInput(String(preset));
                      setFeedbackMessage(`Recompensa ajustada para ${formatCombatCurrency(preset)}.`);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      rewardInput === String(preset) ? styles.chipSelected : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.chipLabel}>{formatCombatCurrency(preset)}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                disabled={!selectedTarget || isMutating}
                onPress={() => {
                  void handleCreateContract();
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!selectedTarget || isMutating) ? styles.buttonDisabled : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                {pendingAction === 'create' ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color={colors.background} size="small" />
                    <Text style={styles.primaryButtonLabel}>Mandando para a rua...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonLabel}>Criar contrato</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </Section>

      <Section title="Mural aberto">
        {contractsBook?.availableContracts.length ? (
          <View style={styles.grid}>
            {contractsBook.availableContracts.map((contract) => (
              <ContractCard
                actionLabel={contract.canAccept ? 'Aceitar contrato' : null}
                contractIdLabel={`Contrato ${contract.id.slice(0, 8)}`}
                cooldownLabel={`Expira em ${formatContractCountdown(contract.expiresAt, nowMs)}`}
                isPending={pendingAction === `accept:${contract.id}`}
                key={contract.id}
                onPressAction={
                  contract.canAccept
                    ? () => {
                        void handleAcceptContract(contract.id);
                      }
                    : undefined
                }
                primaryLine={`${contract.requesterNickname} marcou ${contract.targetNickname}`}
                secondaryLine={`Recompensa ${formatCombatCurrency(contract.reward)} · taxa ${formatCombatCurrency(contract.fee)}`}
                statusLabel={resolveContractStatusLabel(contract.status)}
                tertiaryLine={`Aberto em ${formatContractTimestamp(contract.createdAt)}`}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            copy="Nenhum contrato aberto apareceu no mural neste momento."
            title="Mural vazio"
          />
        )}
      </Section>

      <Section title="Contratos aceitos por você">
        {contractsBook?.acceptedContracts.length ? (
          <View style={styles.grid}>
            {contractsBook.acceptedContracts.map((contract) => (
              <ContractCard
                actionLabel="Executar"
                contractIdLabel={`Contrato ${contract.id.slice(0, 8)}`}
                cooldownLabel={`Prazo restante: ${formatContractCountdown(contract.expiresAt, nowMs)}`}
                isPending={pendingAction === `execute:${contract.id}`}
                key={contract.id}
                onPressAction={() => {
                  void handleExecuteContract(contract.id);
                }}
                primaryLine={`Alvo: ${contract.targetNickname}`}
                secondaryLine={`Mandante: ${contract.requesterNickname} · prêmio ${formatCombatCurrency(contract.reward)}`}
                statusLabel={resolveContractStatusLabel(contract.status)}
                tertiaryLine={`Aceito em ${contract.acceptedAt ? formatContractTimestamp(contract.acceptedAt) : 'agora'}`}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            copy="Quando você aceitar um contrato no mural, ele aparece aqui pronto para execução."
            title="Nenhuma caçada em andamento"
          />
        )}
      </Section>

      <Section title="Encomendados por você">
        {contractsBook?.requestedContracts.length ? (
          <View style={styles.grid}>
            {contractsBook.requestedContracts.map((contract) => (
              <ContractCard
                contractIdLabel={`Contrato ${contract.id.slice(0, 8)}`}
                cooldownLabel={`Expira em ${formatContractCountdown(contract.expiresAt, nowMs)}`}
                key={contract.id}
                primaryLine={`Alvo: ${contract.targetNickname}`}
                secondaryLine={`Total travado: ${formatCombatCurrency(contract.totalCost)}`}
                statusLabel={resolveContractStatusLabel(contract.status)}
                tertiaryLine={`Criado em ${formatContractTimestamp(contract.createdAt)}`}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            copy="Os contratos que você paga aparecem aqui com status, prazo e resultado."
            title="Nenhum contrato enviado"
          />
        )}
      </Section>

      <Section title="Notificações">
        {contractsBook?.notifications.length ? (
          <View style={styles.grid}>
            {contractsBook.notifications.slice(0, 6).map((notification) => (
              <View key={notification.id} style={styles.notificationCard}>
                <Text style={styles.notificationTitle}>{resolveContractNotificationLabel(notification.type)}</Text>
                <Text style={styles.notificationCopy}>{notification.title}</Text>
                <Text style={styles.notificationCopyMuted}>{notification.message}</Text>
                <Text style={styles.notificationTimestamp}>{formatContractTimestamp(notification.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            copy="Os avisos de contrato aceito, expirado, concluído ou alvo avisado aparecem aqui."
            title="Sem notificações"
          />
        )}
      </Section>

      {lastExecution ? (
        <Section title="Última execução">
          <Animated.View
            style={[
              styles.executionCard,
              executionTone === 'success'
                ? styles.executionSuccess
                : executionTone === 'warning'
                  ? styles.executionWarning
                  : executionTone === 'danger'
                    ? styles.executionDanger
                    : styles.executionInfo,
              executionStyle,
            ]}
          >
            {executionEffectVariant && executionEffectTriggerKey ? (
              <FeedbackBurst
                triggerKey={executionEffectTriggerKey}
                variant={executionEffectVariant}
              />
            ) : null}
            <View style={styles.executionHeader}>
              <Text style={styles.executionTitle}>{resolveCombatTierLabel(lastExecution.tier)}</Text>
              <Text style={styles.executionBadge}>
                {lastExecution.success ? 'Contrato executado' : 'Tentativa falhou'}
              </Text>
            </View>
            {executionHighlights.map((line) => (
              <Text key={line} style={styles.executionCopy}>
                {line}
              </Text>
            ))}
            <View style={styles.executionStatsRow}>
              <MetaCard label="Razão de poder" value={`x${lastExecution.powerRatio.toFixed(2)}`} />
              <MetaCard
                label="Loot"
                value={lastExecution.loot ? formatCombatCurrency(lastExecution.loot.amount) : formatCombatCurrency(0)}
              />
              <MetaCard
                label="Alvo avisado"
                value={lastExecution.targetNotified ? 'Sim' : 'Não'}
              />
            </View>
          </Animated.View>
        </Section>
      ) : null}
    </InGameScreenLayout>
  );
}

function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InlineBanner({
  message,
  tone,
}: {
  message: string;
  tone: 'danger' | 'info';
}): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{message}</Text>
    </View>
  );
}

function EmptyState({
  copy,
  title,
}: {
  copy: string;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateCopy}>{copy}</Text>
    </View>
  );
}

function MetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function ContractCard({
  actionLabel,
  contractIdLabel,
  cooldownLabel,
  isPending = false,
  onPressAction,
  primaryLine,
  secondaryLine,
  statusLabel,
  tertiaryLine,
}: {
  actionLabel?: string | null;
  contractIdLabel: string;
  cooldownLabel: string;
  isPending?: boolean;
  onPressAction?: (() => void) | undefined;
  primaryLine: string;
  secondaryLine: string;
  statusLabel: string;
  tertiaryLine: string;
}): JSX.Element {
  return (
    <View style={styles.contractCard}>
      <View style={styles.contractHeader}>
        <Text style={styles.contractStatus}>{statusLabel}</Text>
        <Text style={styles.contractId}>{contractIdLabel}</Text>
      </View>
      <Text style={styles.contractPrimary}>{primaryLine}</Text>
      <Text style={styles.contractSecondary}>{secondaryLine}</Text>
      <Text style={styles.contractMuted}>{tertiaryLine}</Text>
      <Text style={styles.contractMuted}>{cooldownLabel}</Text>
      {actionLabel && onPressAction ? (
        <Pressable
          disabled={isPending}
          onPress={onPressAction}
          style={({ pressed }) => [
            styles.inlineActionButton,
            isPending ? styles.buttonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          {isPending ? (
            <View style={styles.inlineActionContent}>
              <ActivityIndicator color={colors.background} size="small" />
              <Text style={styles.inlineActionLabel}>Processando...</Text>
            </View>
          ) : (
            <Text style={styles.inlineActionLabel}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.12)',
    borderColor: 'rgba(217, 108, 108, 0.4)',
  },
  bannerInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: 'rgba(123, 178, 255, 0.4)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  chip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  chipSelected: {
    borderColor: colors.accent,
  },
  contractCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 15,
  },
  contractHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contractId: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  contractMuted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  contractPrimary: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  contractSecondary: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  contractStatus: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyState: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  emptyStateCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  executionBadge: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  executionCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  executionCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  executionDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
    borderColor: 'rgba(217, 108, 108, 0.5)',
  },
  executionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  executionInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.14)',
    borderColor: 'rgba(123, 178, 255, 0.5)',
  },
  executionStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  executionSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.14)',
    borderColor: 'rgba(63, 163, 77, 0.5)',
  },
  executionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  executionWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.14)',
    borderColor: 'rgba(255, 184, 77, 0.5)',
  },
  grid: {
    gap: 10,
  },
  inlineActionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineActionContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  inlineActionLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metaCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: 0,
    padding: 14,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  notificationCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 15,
  },
  notificationCopy: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  notificationCopyMuted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  notificationTimestamp: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  notificationTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  rewardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rewardPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  section: {
    gap: 10,
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 132,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  targetCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 15,
  },
  targetCardSelected: {
    borderColor: colors.accent,
  },
  targetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  targetMetaInfo: {
    color: colors.info,
    fontSize: 12,
    fontWeight: '700',
  },
  targetMetaMuted: {
    color: colors.muted,
    fontSize: 12,
  },
  targetName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  targetSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  targetTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  topActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
