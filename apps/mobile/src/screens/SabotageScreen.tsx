import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { SabotageResultModal } from '../components/SabotageResultModal';
import {
  buildOwnedSabotageRecoveryCards,
  buildPendingSabotageCues,
  buildSabotageCue,
  formatSabotageAvailabilityCost,
  formatSabotageCooldown,
  formatSabotageCurrency,
  formatSabotageOperationalImpact,
  formatSabotageRecoveryStatus,
} from '../features/sabotage';
import {
  loadSeenSabotageCueKeys,
  rememberSeenSabotageCue,
} from '../features/sabotage-storage';
import {
  resolvePropertyRegionLabel,
  resolvePropertyTypeLabel,
} from '../features/operations';
import { formatApiError, propertyApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

type ScreenTab = 'damage' | 'history' | 'targets';

interface ActionFeedbackState {
  message: string;
  title: string;
}

export function SabotageScreen(): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'Sabotage'>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof propertyApi.getSabotageCenter>> | null>(null);
  const [propertyBook, setPropertyBook] = useState<Awaited<ReturnType<typeof propertyApi.list>> | null>(null);
  const [activeTab, setActiveTab] = useState<ScreenTab>('targets');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultCue, setResultCue] = useState<ReturnType<typeof buildSabotageCue>>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedbackState | null>(null);

  const loadScreenData = useCallback(async () => {
    if (!player?.id) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextCenter, nextPropertyBook] = await Promise.all([
        propertyApi.getSabotageCenter(),
        propertyApi.list(),
      ]);
      setCenter(nextCenter);
      setPropertyBook(nextPropertyBook);

      const seenKeys = await loadSeenSabotageCueKeys(player.id);
      const unseenCues = buildPendingSabotageCues({
        center: nextCenter,
        playerId: player.id,
        seenKeys,
      });

      let nextSeen = seenKeys;
      for (const cue of unseenCues) {
        nextSeen = await rememberSeenSabotageCue(player.id, cue.key);
      }

      void nextSeen;
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [player?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadScreenData();
      return undefined;
    }, [loadScreenData]),
  );

  const ownedDamagedProperties = useMemo(
    () => buildOwnedSabotageRecoveryCards(propertyBook?.ownedProperties ?? []),
    [propertyBook?.ownedProperties],
  );
  const eligibleTargets = useMemo(
    () => center?.targets.filter((target) => target.status === 'eligible') ?? [],
    [center?.targets],
  );
  const logCues = useMemo(
    () =>
      player?.id && center
        ? center.recentLogs
            .map((log) => buildSabotageCue(log, player.id))
            .filter((cue): cue is NonNullable<typeof cue> => cue !== null)
        : [],
    [center, player?.id],
  );

  useEffect(() => {
    const focusPropertyId = route.params?.focusPropertyId;

    if (!focusPropertyId) {
      return;
    }

    const damagedProperty = ownedDamagedProperties.find((entry) => entry.id === focusPropertyId) ?? null;
    const targetProperty = center?.targets.find((entry) => entry.id === focusPropertyId) ?? null;

    if (damagedProperty) {
      setActiveTab('damage');
      setExpandedCardId(damagedProperty.id);
      return;
    }

    if (targetProperty) {
      setActiveTab('targets');
      setExpandedCardId(targetProperty.id);
    }
  }, [center?.targets, ownedDamagedProperties, route.params?.focusPropertyId]);

  const handleAttemptSabotage = useCallback(async (propertyId: string) => {
    if (!player?.id) {
      return;
    }

    setSubmittingId(propertyId);
    setErrorMessage(null);

    try {
      const response = await propertyApi.attemptSabotage(propertyId);
      setCenter(response.center);
      await refreshPlayerProfile();
      const refreshedPropertyBook = await propertyApi.list();
      setPropertyBook(refreshedPropertyBook);
      const cue = buildSabotageCue(response.result, player.id);

      if (cue) {
        await rememberSeenSabotageCue(player.id, cue.key);
        setResultCue(cue);
      }

      setBootstrapStatus(response.message);
    } catch (error) {
      const message = formatApiError(error).message;
      setErrorMessage(message);
      setBootstrapStatus(message);
    } finally {
      setSubmittingId(null);
    }
  }, [player?.id, refreshPlayerProfile, setBootstrapStatus]);

  const handleRecoverSabotage = useCallback(async (propertyId: string) => {
    setSubmittingId(propertyId);
    setErrorMessage(null);

    try {
      const response = await propertyApi.recoverSabotage(propertyId);
      setCenter(response.center);
      await refreshPlayerProfile();
      const refreshedPropertyBook = await propertyApi.list();
      setPropertyBook(refreshedPropertyBook);
      setBootstrapStatus(response.message);
      setActionFeedback({
        message: `${response.message} Custo aplicado: ${formatSabotageCurrency(response.recoveryCost)}.`,
        title: resolvePropertyTypeLabel(response.property.type),
      });
    } catch (error) {
      const message = formatApiError(error).message;
      setErrorMessage(message);
      setBootstrapStatus(message);
    } finally {
      setSubmittingId(null);
    }
  }, [refreshPlayerProfile, setBootstrapStatus]);

  const subtitle = center
    ? `${center.player.nickname} está em ${resolvePropertyRegionLabel(center.player.regionId)}. Use sabotagem para travar operações rivais na sua região e responda rápido se a sua base tomar dano.`
    : 'Sabote operações rivais na mesma região, acompanhe o histórico recente e recupere sua base depois de uma avaria ou destruição.';

  return (
    <InGameScreenLayout
      eyebrow="Conflito operacional"
      subtitle={subtitle}
      title="Central de Sabotagem"
    >
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Disponibilidade"
          tone={center?.availability.available ? colors.success : colors.warning}
          value={center?.availability.available ? 'Liberada agora' : 'Travada'}
        />
        <SummaryCard
          label="Custo"
          tone={colors.accent}
          value={center ? formatSabotageAvailabilityCost(center.availability) : '--'}
        />
        <SummaryCard
          label="Alvos livres"
          tone={colors.info}
          value={String(eligibleTargets.length)}
        />
        <SummaryCard
          label="Sua base"
          tone={ownedDamagedProperties.length > 0 ? colors.danger : colors.success}
          value={ownedDamagedProperties.length > 0 ? `${ownedDamagedProperties.length} dano(s)` : 'Sem dano'}
        />
      </View>

      {center ? (
        <View style={[styles.heroCard, !center.availability.available ? styles.heroCardWarning : null]}>
          <Text style={styles.heroTitle}>Janela atual</Text>
          <Text style={styles.heroCopy}>
            {center.availability.reason
              ? center.availability.reason
              : 'Você pode abrir sabotagem agora. Escolha o alvo rival e confirme tudo no mesmo card.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.tabRow}>
        {[
          ['targets', `Alvos (${center?.targets.length ?? 0})`],
          ['damage', `Sua base (${ownedDamagedProperties.length})`],
          ['history', `Histórico (${logCues.length})`],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => {
              setActiveTab(value as ScreenTab);
              setExpandedCardId(null);
            }}
            style={({ pressed }) => [
              styles.tabButton,
              activeTab === value ? styles.tabButtonActive : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={[styles.tabLabel, activeTab === value ? styles.tabLabelActive : null]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingCopy}>Carregando a central de sabotagem...</Text>
        </View>
      ) : null}

      {errorMessage ? <InlineBanner message={errorMessage} tone="danger" /> : null}

      {activeTab === 'targets' ? (
        <View style={styles.section}>
          {(center?.targets ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma operação rival na sua região"
              body="Só aparecem aqui operações sabotáveis da mesma região. Mova o personagem ou espere novos ativos subirem."
            />
          ) : (
            center?.targets.map((target) => {
              const isExpanded = expandedCardId === target.id;
              const lockedByDamage = target.sabotageStatus.state !== 'normal';

              return (
                <Pressable
                  key={target.id}
                  onPress={() => {
                    setExpandedCardId(isExpanded ? null : target.id);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    target.status === 'eligible' ? styles.cardEligible : styles.cardMuted,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleGroup}>
                      <Text style={styles.cardEyebrow}>{resolvePropertyTypeLabel(target.type)}</Text>
                      <Text style={styles.cardTitle}>{target.ownerNickname}</Text>
                    </View>
                    <Text style={styles.cardTag}>
                      {target.status === 'eligible'
                        ? 'Livre'
                        : lockedByDamage
                          ? 'Alvo já danificado'
                          : `Cooldown ${formatSabotageCooldown(target.targetCooldownSeconds)}`}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <MiniMetric label="Defesa" value={String(target.defenseScore)} />
                    <MiniMetric label="Soldados" value={String(target.soldiersCount)} />
                    <MiniMetric label="Região" value={resolvePropertyRegionLabel(target.regionId)} />
                  </View>

                  {isExpanded ? (
                    <View style={styles.expandedBlock}>
                      <Text style={styles.expandedCopy}>
                        {lockedByDamage
                          ? `Esse alvo já está em ${target.sabotageStatus.state === 'destroyed' ? 'destruição total' : 'avaria'} e não aceita nova pressão até a recuperação.`
                          : target.status === 'eligible'
                            ? 'Alvo liberado para sabotagem agora.'
                            : `A última tentativa ainda segura o alvo em cooldown por ${formatSabotageCooldown(target.targetCooldownSeconds)}.`}
                      </Text>
                      <Text style={styles.expandedCopy}>
                        Impacto atual: {formatSabotageOperationalImpact(target.sabotageStatus.operationalMultiplier)}.
                      </Text>

                      <Pressable
                        disabled={
                          submittingId === target.id ||
                          target.status !== 'eligible' ||
                          !center?.availability.available
                        }
                        onPress={() => {
                          void handleAttemptSabotage(target.id);
                        }}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          (submittingId === target.id ||
                            target.status !== 'eligible' ||
                            !center?.availability.available) ? styles.buttonDisabled : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.primaryButtonLabel}>
                          {submittingId === target.id ? 'Sabotando...' : 'Sabotar alvo'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}

      {activeTab === 'damage' ? (
        <View style={styles.section}>
          {ownedDamagedProperties.length === 0 ? (
            <EmptyState
              title="Sua base está limpa"
              body="Quando um rival avariar ou destruir uma operação sua, ela aparece aqui com o botão de reparo inline."
            />
          ) : (
            ownedDamagedProperties.map((property) => {
              const isExpanded = expandedCardId === property.id;

              return (
                <Pressable
                  key={property.id}
                  onPress={() => {
                    setExpandedCardId(isExpanded ? null : property.id);
                  }}
                  style={({ pressed }) => [styles.card, styles.cardDanger, pressed ? styles.buttonPressed : null]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleGroup}>
                      <Text style={styles.cardEyebrow}>{resolvePropertyTypeLabel(property.type)}</Text>
                      <Text style={styles.cardTitle}>{resolvePropertyRegionLabel(property.regionId)}</Text>
                    </View>
                    <Text style={styles.cardTag}>
                      {property.sabotageStatus.state === 'destroyed' ? 'Destruída' : 'Avariada'}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <MiniMetric label="Impacto" value={formatSabotageOperationalImpact(property.sabotageStatus.operationalMultiplier)} />
                    <MiniMetric label="Custo" value={formatSabotageCurrency(property.sabotageStatus.recoveryCost ?? 0)} />
                    <MiniMetric label="Janela" value={formatSabotageRecoveryStatus(property)} />
                  </View>

                  {isExpanded ? (
                    <View style={styles.expandedBlock}>
                      <Text style={styles.expandedCopy}>
                        {property.sabotageStatus.state === 'destroyed'
                          ? 'Essa operação travou por completo e só volta depois da reconstrução.'
                          : 'Essa operação caiu para metade do ritmo até o reparo.'}
                      </Text>
                      <Pressable
                        disabled={submittingId === property.id || !property.sabotageStatus.recoveryReady}
                        onPress={() => {
                          void handleRecoverSabotage(property.id);
                        }}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          submittingId === property.id || !property.sabotageStatus.recoveryReady
                            ? styles.buttonDisabled
                            : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text style={styles.primaryButtonLabel}>
                          {submittingId === property.id
                            ? 'Recuperando...'
                            : property.sabotageStatus.state === 'destroyed'
                              ? 'Reconstruir agora'
                              : 'Reparar agora'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}

      {activeTab === 'history' ? (
        <View style={styles.section}>
          {logCues.length === 0 ? (
            <EmptyState
              title="Sem sabotagens recentes"
              body="Quando você atacar um rival ou sua base for pressionada, o resultado entra aqui com replay offline."
            />
          ) : (
            logCues.map((cue) => (
              <View
                key={cue.key}
                style={[
                  styles.card,
                  cue.outcomeTone === 'danger' ? styles.cardDanger : null,
                  cue.outcomeTone === 'success' ? styles.cardSuccess : null,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleGroup}>
                    <Text style={styles.cardEyebrow}>{cue.eyebrow}</Text>
                    <Text style={styles.cardTitle}>{cue.title}</Text>
                  </View>
                  <Text style={styles.cardTag}>{cue.createdAtLabel}</Text>
                </View>
                <Text style={styles.expandedCopy}>{cue.body}</Text>
                {cue.recoveryHint ? (
                  <Text style={styles.mutedNote}>{cue.recoveryHint}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      <SabotageResultModal
        cue={resultCue}
        onClose={() => {
          setResultCue(null);
        }}
        onOpenTarget={() => {
          setResultCue(null);
          setActiveTab('targets');
        }}
        visible={Boolean(resultCue)}
      />

      <Modal animationType="fade" transparent visible={Boolean(actionFeedback)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{actionFeedback?.title}</Text>
            <Text style={styles.modalCopy}>{actionFeedback?.message}</Text>
            <Pressable
              onPress={() => {
                setActionFeedback(null);
              }}
              style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.primaryButtonLabel}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </InGameScreenLayout>
  );
}

function SummaryCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryLabel, { color: tone }]}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InlineBanner({
  message,
  tone,
}: {
  message: string;
  tone: 'danger';
}): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : null]}>
      <Text style={styles.bannerCopy}>{message}</Text>
    </View>
  );
}

function EmptyState({
  body,
  title,
}: {
  body: string;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(217, 108, 108, 0.12)',
    borderColor: 'rgba(217, 108, 108, 0.3)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  bannerDanger: {
    borderColor: 'rgba(217, 108, 108, 0.32)',
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  buttonPressed: {
    opacity: 0.84,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardDanger: {
    borderColor: 'rgba(217, 108, 108, 0.26)',
  },
  cardEligible: {
    borderColor: 'rgba(224, 176, 75, 0.26)',
  },
  cardEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardMuted: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardSuccess: {
    borderColor: 'rgba(108, 198, 136, 0.26)',
  },
  cardTag: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  cardTitleGroup: {
    flex: 1,
    gap: 4,
  },
  emptyCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 8,
    padding: 18,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  expandedBlock: {
    gap: 10,
  },
  expandedCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    backgroundColor: colors.panelAlt,
    borderColor: 'rgba(224, 176, 75, 0.18)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  heroCardWarning: {
    borderColor: 'rgba(224, 176, 75, 0.32)',
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 10,
    padding: 18,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
  },
  metricCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 14,
    flex: 1,
    gap: 4,
    minWidth: 88,
    padding: 12,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  modalCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  mutedNote: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  section: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 16,
    flexBasis: '48%',
    gap: 6,
    minWidth: 132,
    padding: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  tabButton: {
    backgroundColor: colors.panelAlt,
    borderRadius: 999,
    flex: 1,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
  },
  tabLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
