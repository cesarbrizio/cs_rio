import {
  type FactionMembersResponse,
  type PvpAmbushResponse,
  type PvpAssaultResponse,
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
  View,
} from 'react-native';

import { type RootStackParamList } from '../../App';
import { useAudio } from '../audio/AudioProvider';
import { resolveCombatResultSfx } from '../audio/audioFeedback';
import { FeedbackBurst } from '../components/FeedbackBurst';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildAmbushParticipantOptions,
  buildCombatResultHighlights,
  buildCombatTargets,
  canLeadAmbush,
  formatCombatCurrency,
  formatCombatCooldown,
  resolveCombatTierLabel,
  resolveCombatTierTone,
} from '../features/combat';
import { resolveFactionRankLabel } from '../features/faction';
import { resolveCombatVisualEffectVariant } from '../features/visualFeedback';
import { colyseusService, type RealtimeSnapshot } from '../services/colyseus';
import { factionApi, formatApiError, pvpApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

type CombatMode = 'ambush' | 'assault';
type CombatResult = PvpAmbushResponse | PvpAssaultResponse;
type PendingCombatAction = 'ambush' | 'assault' | 'members-refresh' | 'refresh' | null;

export function CombatScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const { playSfx } = useAudio();
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>(
    colyseusService.getSnapshot(),
  );
  const [membersBook, setMembersBook] = useState<FactionMembersResponse | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [confirmMode, setConfirmMode] = useState<CombatMode | null>(null);
  const [lastResult, setLastResult] = useState<CombatResult | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingCombatAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const resultAnimation = useRef(new Animated.Value(0)).current;

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

  useFocusEffect(
    useCallback(() => {
      const factionId = player?.faction?.id;

      if (!factionId) {
        setMembersBook(null);
        return undefined;
      }

      let isActive = true;

      const loadMembers = async () => {
        setIsLoadingMembers(true);
        setPendingAction('members-refresh');

        try {
          const response = await factionApi.getMembers(factionId);

          if (isActive) {
            setMembersBook(response);
          }
        } catch (error) {
          if (isActive) {
            setErrorMessage(formatApiError(error).message);
          }
        } finally {
          if (isActive) {
            setIsLoadingMembers(false);
            setPendingAction((current) => (current === 'members-refresh' ? null : current));
          }
        }
      };

      void loadMembers();

      return () => {
        isActive = false;
      };
    }, [player?.faction?.id]),
  );

  const ownFactionMemberIds = useMemo(
    () => membersBook?.members.map((member) => member.id) ?? [],
    [membersBook?.members],
  );
  const targetOptions = useMemo(
    () =>
      buildCombatTargets({
        currentPlayerId: player?.id,
        ownFactionMemberIds,
        realtimePlayers: realtimeSnapshot.players,
      }),
    [ownFactionMemberIds, player?.id, realtimeSnapshot.players],
  );
  const selectedTarget = useMemo(
    () => targetOptions.find((target) => target.id === selectedTargetId) ?? null,
    [selectedTargetId, targetOptions],
  );
  const ambushParticipantOptions = useMemo(
    () =>
      buildAmbushParticipantOptions({
        currentPlayerId: player?.id,
        members: membersBook?.members ?? [],
      }),
    [membersBook?.members, player?.id],
  );
  const isAmbushLeader = useMemo(
    () => canLeadAmbush(player?.faction?.rank ?? null),
    [player?.faction?.rank],
  );
  const selectedParticipantCount = selectedParticipantIds.length + 1;
  const canRunAmbush =
    isAmbushLeader &&
    Boolean(selectedTarget) &&
    selectedParticipantIds.length >= 1 &&
    selectedParticipantIds.length <= 4;

  useEffect(() => {
    setSelectedTargetId((currentTargetId) => {
      if (!targetOptions.length) {
        return null;
      }

      if (
        currentTargetId &&
        targetOptions.some((target) => target.id === currentTargetId && !target.disabledReason)
      ) {
        return currentTargetId;
      }

      return targetOptions.find((target) => !target.disabledReason)?.id ?? null;
    });
  }, [targetOptions]);

  useEffect(() => {
    const eligibleIds = ambushParticipantOptions
      .filter((option) => option.isEligible)
      .map((option) => option.id);

    setSelectedParticipantIds((currentSelection) => {
      const nextSelection = currentSelection
        .filter((participantId) => eligibleIds.includes(participantId))
        .slice(0, 4);

      if (nextSelection.length > 0) {
        return nextSelection;
      }

      return eligibleIds.slice(0, 1);
    });
  }, [ambushParticipantOptions]);

  useEffect(() => {
    if (!lastResult) {
      return;
    }

    resultAnimation.setValue(0);
    Animated.spring(resultAnimation, {
      damping: 18,
      stiffness: 160,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [lastResult, resultAnimation]);

  useEffect(() => {
    if (!lastResult) {
      return;
    }

    void playSfx(resolveCombatResultSfx(lastResult));
  }, [lastResult, playSfx]);

  const handleRefresh = useCallback(async () => {
    setErrorMessage(null);
    setFeedbackMessage('Sincronizando alvos e bonde online...');
    setBootstrapStatus('Sincronizando combate PvP.');
    setPendingAction('refresh');

    if (player?.faction?.id) {
      try {
        const response = await factionApi.getMembers(player.faction.id);
        setMembersBook(response);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setPendingAction(null);
      }
    } else {
      setPendingAction(null);
    }
  }, [player?.faction?.id, setBootstrapStatus]);

  const handleConfirmCombat = useCallback(
    async (mode: CombatMode) => {
      if (!selectedTargetId || !selectedTarget) {
        setErrorMessage('Selecione um alvo online antes de confirmar o combate.');
        return;
      }

      if (selectedTarget.disabledReason) {
        setErrorMessage(selectedTarget.disabledReason);
        return;
      }

      if (mode === 'ambush' && !canRunAmbush) {
        setErrorMessage(
          isAmbushLeader
            ? 'Emboscada exige entre 2 e 5 membros no total, incluindo você.'
            : 'Só gerente, general ou patrão podem iniciar emboscada.',
        );
        return;
      }

      setIsMutating(true);
      setConfirmMode(null);
      setErrorMessage(null);
      setPendingAction(mode);

      const pendingMessage =
        mode === 'assault'
          ? `Porrada enviada em ${selectedTarget.nickname}.`
          : `Emboscada armada contra ${selectedTarget.nickname}.`;

      setFeedbackMessage(`${pendingMessage} Resolvendo resultado...`);
      setBootstrapStatus(pendingMessage);

      try {
        const result =
          mode === 'assault'
            ? await pvpApi.assault(selectedTargetId)
            : await pvpApi.ambush(selectedTargetId, selectedParticipantIds);

        setLastResult(result);
        await refreshPlayerProfile();

        const resultMessage = `${result.message} Cooldown: ${formatCombatCooldown(result.targetCooldownSeconds)}.`;
        setFeedbackMessage(resultMessage);
        setBootstrapStatus(resultMessage);
      } catch (error) {
        const message = formatApiError(error).message;
        setErrorMessage(message);
        setBootstrapStatus(message);
      } finally {
        setIsMutating(false);
        setPendingAction(null);
      }
    },
    [
      canRunAmbush,
      isAmbushLeader,
      refreshPlayerProfile,
      selectedParticipantIds,
      selectedTarget,
      selectedTargetId,
      setBootstrapStatus,
    ],
  );

  const resultTone = lastResult ? resolveCombatTierTone(lastResult.tier) : 'info';
  const resultHighlights = useMemo(
    () => (lastResult ? buildCombatResultHighlights(lastResult) : []),
    [lastResult],
  );
  const resultEffectVariant = useMemo(
    () => (lastResult ? resolveCombatVisualEffectVariant(lastResult) : null),
    [lastResult],
  );
  const resultEffectTriggerKey = useMemo(() => {
    if (!lastResult) {
      return null;
    }

    return [
      lastResult.mode,
      lastResult.tier,
      lastResult.success ? '1' : '0',
      String(lastResult.powerRatio),
      lastResult.message,
    ].join(':');
  }, [lastResult]);
  const resultStyle = {
    opacity: resultAnimation,
    transform: [
      {
        translateY: resultAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: resultAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  } as const;

  return (
    <InGameScreenLayout
      subtitle="Escolha um alvo online na sua região, decida entre porrada ou emboscada e acompanhe o resultado completo do confronto."
      title="Combate PvP"
    >
      <View style={styles.topActionRow}>
        <Pressable
          onPress={() => {
            navigation.navigate('Faction', {
              initialTab: 'members',
            });
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir facção</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            navigation.navigate('Contracts');
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Contratos</Text>
        </Pressable>
        <Pressable
          disabled={isLoadingMembers || isMutating}
          onPress={() => {
            void handleRefresh();
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            (isLoadingMembers || isMutating) ? styles.buttonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>
            {pendingAction === 'refresh' || pendingAction === 'members-refresh'
              ? 'Sincronizando...'
              : 'Sincronizar'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <MetaCard
          label="Região"
          value={player?.regionId ? formatRegionLabel(player.regionId) : 'Sem região'}
        />
        <MetaCard
          label="Conexão"
          value={resolveRealtimeStatusLabel(realtimeSnapshot.status)}
        />
        <MetaCard
          label="Seu cargo"
          value={resolveFactionRankLabel(player?.faction?.rank ?? null)}
        />
      </View>

      {errorMessage ? <InlineBanner message={errorMessage} tone="danger" /> : null}
      {feedbackMessage ? <InlineBanner message={feedbackMessage} tone="info" /> : null}

      <Section title="Alvos online na sua região">
        {targetOptions.length === 0 ? (
          <EmptyState
            copy="Ninguém online apareceu na sala da sua região ainda. Fique no mapa, espere a conexão estabilizar ou abra esta tela com outro jogador online."
            title="Sem alvo disponível agora"
          />
        ) : (
          <View style={styles.grid}>
            {targetOptions.map((target) => {
              const isSelected = selectedTargetId === target.id;

              return (
                <Pressable
                  disabled={Boolean(target.disabledReason) || isMutating}
                  key={target.id}
                  onPress={() => {
                    setSelectedTargetId(target.id);
                    setConfirmMode(null);
                    setFeedbackMessage(`Alvo travado em ${target.nickname}.`);
                    setErrorMessage(null);
                  }}
                  style={({ pressed }) => [
                    styles.targetCard,
                    isSelected ? styles.targetCardSelected : null,
                    target.disabledReason ? styles.targetCardDisabled : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.targetHeader}>
                    <Text style={styles.targetName}>{target.nickname}</Text>
                    <Text style={styles.targetTitle}>{target.title}</Text>
                  </View>
                  <Text style={styles.targetSubtitle}>{target.subtitle}</Text>
                  {target.disabledReason ? (
                    <Text style={styles.targetMetaDanger}>{target.disabledReason}</Text>
                  ) : isSelected ? (
                    <Text style={styles.targetMetaInfo}>Alvo atual</Text>
                  ) : (
                    <Text style={styles.targetMetaMuted}>Toque para selecionar</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      <Section title="Ação imediata">
        <View style={styles.actionPanel}>
          <Text style={styles.actionHeadline}>
            {selectedTarget ? `Alvo travado: ${selectedTarget.nickname}` : 'Escolha um alvo para abrir combate'}
          </Text>
          <Text style={styles.actionCopy}>
            Porrada é 1x1 e custa menos coordenação. Emboscada exige bonde, mesma facção e todos na mesma região do alvo.
          </Text>
          <View style={styles.actionButtons}>
            <Pressable
              disabled={!selectedTarget || isMutating}
              onPress={() => {
                setConfirmMode('assault');
                setErrorMessage(null);
                setFeedbackMessage(
                  selectedTarget
                    ? `Porrada preparada em ${selectedTarget.nickname}. Revise e confirme abaixo.`
                    : 'Escolha um alvo antes de abrir a porrada.',
                );
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                (!selectedTarget || isMutating) ? styles.buttonDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              {isMutating && confirmMode === 'assault' ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonLabel}>Dar porrada</Text>
              )}
            </Pressable>
            <Pressable
              disabled={!selectedTarget || !player?.faction || isMutating}
              onPress={() => {
                setConfirmMode('ambush');
                setErrorMessage(null);
                setFeedbackMessage(
                  selectedTarget
                    ? `Emboscada preparada contra ${selectedTarget.nickname}. Monte o bonde e confirme abaixo.`
                    : 'Escolha um alvo antes de montar a emboscada.',
                );
              }}
              style={({ pressed }) => [
                styles.secondaryActionButton,
                (!selectedTarget || !player?.faction || isMutating) ? styles.buttonDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.secondaryActionButtonLabel}>
                {confirmMode === 'ambush' ? 'Emboscada pronta' : 'Montar emboscada'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Section>

      {player?.faction ? (
        <Section title="Bonde da emboscada">
          <Text style={styles.sectionHint}>
            Você entra automaticamente. Total atual: {selectedParticipantCount} membros. Líder da ação: {resolveFactionRankLabel(player.faction.rank)}.
          </Text>
          {!isAmbushLeader ? (
            <InlineBanner
              message="Emboscada só pode ser iniciada por gerente, general ou patrão."
              tone="warning"
            />
          ) : null}
          {!ambushParticipantOptions.length ? (
            <EmptyState
              copy="Sua facção ainda não tem membros reais suficientes para fechar um bonde. Recrute ou espere mais gente entrar."
              title="Sem participantes elegíveis"
            />
          ) : (
            <View style={styles.grid}>
              {ambushParticipantOptions.map((member) => {
                const isSelected = selectedParticipantIds.includes(member.id);

                return (
                  <Pressable
                    disabled={!member.isEligible || isMutating || !isAmbushLeader}
                    key={member.id}
                    onPress={() => {
                      setSelectedParticipantIds((currentSelection) => {
                        if (currentSelection.includes(member.id)) {
                          return currentSelection.filter((entry) => entry !== member.id);
                        }

                        if (currentSelection.length >= 4) {
                          return currentSelection;
                        }

                        return [...currentSelection, member.id];
                      });
                      setFeedbackMessage(
                        isSelected
                          ? `${member.nickname} saiu do bonde.`
                          : `${member.nickname} entrou no bonde.`,
                      );
                    }}
                    style={({ pressed }) => [
                      styles.targetCard,
                      isSelected ? styles.targetCardSelected : null,
                      !member.isEligible ? styles.targetCardDisabled : null,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <View style={styles.targetHeader}>
                      <Text style={styles.targetName}>{member.nickname}</Text>
                      <Text style={styles.targetTitle}>{member.title}</Text>
                    </View>
                    <Text style={styles.targetSubtitle}>
                      {isSelected ? 'Entrou no bonde' : 'Toque para incluir'}
                    </Text>
                    <Text style={member.isEligible ? styles.targetMetaInfo : styles.targetMetaDanger}>
                      {member.disabledReason ?? 'Pronto para a emboscada'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>
      ) : (
        <Section title="Emboscada bloqueada">
          <EmptyState
            copy="Entrar em uma facção libera bonde, cargo e membros para emboscada. Enquanto isso, use a porrada 1x1."
            title="Sem facção no momento"
          />
        </Section>
      )}

      {confirmMode && selectedTarget ? (
        <Section title="Confirmação">
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {confirmMode === 'assault'
                ? `Confirmar porrada em ${selectedTarget.nickname}?`
                : `Confirmar emboscada em ${selectedTarget.nickname}?`}
            </Text>
            <Text style={styles.confirmCopy}>
              {confirmMode === 'assault'
                ? 'Vai 1x1. O backend calcula dano, loot, calor, hospitalização e cooldown do alvo.'
                : `Você vai com ${selectedParticipantCount} membros no total. Todos precisam estar aptos, na mesma região e no mesmo bonde.`}
            </Text>
            <View style={styles.actionButtons}>
              <Pressable
                disabled={isMutating}
                onPress={() => {
                  void handleConfirmCombat(confirmMode);
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  isMutating ? styles.buttonDisabled : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {pendingAction === 'assault'
                    ? 'Enviando porrada...'
                    : pendingAction === 'ambush'
                      ? 'Disparando emboscada...'
                      : confirmMode === 'assault'
                        ? 'Confirmar porrada'
                        : 'Confirmar emboscada'}
                </Text>
              </Pressable>
              <Pressable
                disabled={isMutating}
                onPress={() => {
                  setConfirmMode(null);
                }}
                style={({ pressed }) => [
                  styles.secondaryActionButton,
                  isMutating ? styles.buttonDisabled : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.secondaryActionButtonLabel}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Section>
      ) : null}

      {lastResult ? (
        <Section title="Resultado do combate">
          <Animated.View
            style={[
              styles.resultCard,
              resultTone === 'success'
                ? styles.resultSuccess
                : resultTone === 'warning'
                  ? styles.resultWarning
                  : resultTone === 'danger'
                    ? styles.resultDanger
                    : styles.resultInfo,
              resultStyle,
            ]}
          >
            {resultEffectVariant && resultEffectTriggerKey ? (
              <FeedbackBurst
                triggerKey={resultEffectTriggerKey}
                variant={resultEffectVariant}
              />
            ) : null}
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>{resolveCombatTierLabel(lastResult.tier)}</Text>
              <Text style={styles.resultBadge}>
                {lastResult.success ? 'Sucesso' : 'Falha'}
              </Text>
            </View>
            {resultHighlights.map((line) => (
              <Text key={line} style={styles.resultCopy}>
                {line}
              </Text>
            ))}

            <View style={styles.resultStatsRow}>
              <ResultStat
                label="Relação de poder"
                value={`x${lastResult.powerRatio.toFixed(2)}`}
              />
              <ResultStat
                label="Letalidade"
                value={
                  lastResult.fatality.eligible
                    ? `${Math.round(lastResult.fatality.chance * 100)}%`
                    : 'Travada'
                }
              />
              <ResultStat
                label="Loot"
                value={
                  lastResult.loot
                    ? formatCombatCurrency(lastResult.loot.amount)
                    : formatCombatCurrency(0)
                }
              />
            </View>

            <View style={styles.sideSummaryGrid}>
              <SideSummaryCard
                heading={lastResult.mode === 'ambush' ? 'Defensor' : 'Alvo'}
                hospitalizationMinutes={lastResult.defender.hospitalization.durationMinutes}
                hpDelta={lastResult.defender.hpDelta}
                moneyDelta={lastResult.defender.moneyDelta ?? 0}
                nickname={lastResult.defender.nickname}
              />
              <SideSummaryCard
                heading={lastResult.mode === 'ambush' ? 'Líder do bonde' : 'Atacante'}
                hospitalizationMinutes={
                  lastResult.mode === 'ambush'
                    ? lastResult.attackers[0]?.hospitalization.durationMinutes ?? 0
                    : lastResult.attacker.hospitalization.durationMinutes
                }
                hpDelta={
                  lastResult.mode === 'ambush'
                    ? lastResult.attackers[0]?.hpDelta ?? 0
                    : lastResult.attacker.hpDelta
                }
                moneyDelta={
                  lastResult.mode === 'ambush'
                    ? lastResult.attackers[0]?.moneyDelta ?? 0
                    : lastResult.attacker.moneyDelta ?? 0
                }
                nickname={
                  lastResult.mode === 'ambush'
                    ? lastResult.attackers[0]?.nickname ?? 'Bonde'
                    : lastResult.attacker.nickname
                }
              />
            </View>

            {lastResult.mode === 'ambush' ? (
              <View style={styles.resultParticipantList}>
                {lastResult.attackers.map((attacker) => (
                  <Text key={attacker.id} style={styles.resultParticipantLine}>
                    {attacker.nickname}: {attacker.powerSharePercent}% do poder · Δ HP {attacker.hpDelta} · Δ caixa {formatCombatCurrency(attacker.moneyDelta)}
                  </Text>
                ))}
              </View>
            ) : null}
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
  tone: 'danger' | 'info' | 'warning';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        tone === 'danger'
          ? styles.bannerDanger
          : tone === 'warning'
            ? styles.bannerWarning
            : styles.bannerInfo,
      ]}
    >
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

function ResultStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.resultStat}>
      <Text style={styles.resultStatLabel}>{label}</Text>
      <Text style={styles.resultStatValue}>{value}</Text>
    </View>
  );
}

function SideSummaryCard({
  heading,
  hospitalizationMinutes,
  hpDelta,
  moneyDelta,
  nickname,
}: {
  heading: string;
  hospitalizationMinutes: number;
  hpDelta: number;
  moneyDelta: number;
  nickname: string;
}): JSX.Element {
  return (
    <View style={styles.sideCard}>
      <Text style={styles.sideCardHeading}>{heading}</Text>
      <Text style={styles.sideCardName}>{nickname}</Text>
      <Text style={styles.sideCardCopy}>HP Δ {hpDelta}</Text>
      <Text style={styles.sideCardCopy}>Caixa Δ {formatCombatCurrency(moneyDelta)}</Text>
      <Text style={styles.sideCardCopy}>Hospital: {hospitalizationMinutes} min</Text>
    </View>
  );
}

function formatRegionLabel(regionId: string): string {
  switch (regionId) {
    case 'zona_norte':
      return 'Zona Norte';
    case 'zona_sul':
      return 'Zona Sul';
    case 'zona_oeste':
      return 'Zona Oeste';
    case 'zona_sudoeste':
      return 'Zona Sudoeste';
    case 'baixada':
      return 'Baixada';
    case 'centro':
      return 'Centro';
    default:
      return regionId;
  }
}

function resolveRealtimeStatusLabel(status: RealtimeSnapshot['status']): string {
  switch (status) {
    case 'connected':
      return 'Conectado';
    case 'connecting':
      return 'Conectando';
    case 'reconnecting':
      return 'Reconectando';
    case 'disconnected':
      return 'Desconectado';
    default:
      return status;
  }
}

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  actionHeadline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  actionPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
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
  bannerWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.12)',
    borderColor: 'rgba(255, 184, 77, 0.45)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  confirmCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  confirmCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
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
  grid: {
    gap: 10,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 150,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  resultBadge: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  resultCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  resultCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  resultDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
    borderColor: 'rgba(217, 108, 108, 0.5)',
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.14)',
    borderColor: 'rgba(123, 178, 255, 0.5)',
  },
  resultParticipantLine: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  resultParticipantList: {
    gap: 6,
  },
  resultStat: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 14,
    flex: 1,
    gap: 4,
    minWidth: 88,
    padding: 12,
  },
  resultStatLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  resultStatValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  resultStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resultSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.14)',
    borderColor: 'rgba(63, 163, 77, 0.5)',
  },
  resultTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  resultWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.14)',
    borderColor: 'rgba(255, 184, 77, 0.5)',
  },
  secondaryActionButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 150,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryActionButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
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
  sideCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    borderRadius: 16,
    flex: 1,
    gap: 4,
    minWidth: 0,
    padding: 14,
  },
  sideCardCopy: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  sideCardHeading: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sideCardName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sideSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  targetCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 15,
  },
  targetCardDisabled: {
    opacity: 0.5,
  },
  targetCardSelected: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  targetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  targetMetaDanger: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
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
