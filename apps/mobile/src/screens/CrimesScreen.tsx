import { useFocusEffect } from '@react-navigation/native';
import { type CrimeAttemptResponse, type CrimeCatalogItem } from '@cs-rio/shared';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { CrimeResultModal } from '../components/CrimeResultModal';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  formatCrimeChance,
  formatCrimeCooldown,
  formatCrimeCurrency,
  formatCrimeRewardReadLabel,
  groupCrimesByLevel,
} from '../features/crimes';
import { crimesApi, formatApiError } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function CrimesScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [catalog, setCatalog] = useState<CrimeCatalogItem[]>([]);
  const [selectedCrimeId, setSelectedCrimeId] = useState<string | null>(null);
  const [result, setResult] = useState<CrimeAttemptResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttempting, setIsAttempting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const selectedCrime = useMemo(
    () => catalog.find((crime) => crime.id === selectedCrimeId) ?? catalog[0] ?? null,
    [catalog, selectedCrimeId],
  );
  const groupedCrimes = useMemo(() => groupCrimesByLevel(catalog), [catalog]);

  const loadCatalog = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setFeedbackMessage('Atualizando catálogo criminal...');

    try {
      await refreshPlayerProfile();
      const response = await crimesApi.list();
      setCatalog(response.crimes);
      setSelectedCrimeId((currentCrimeId) => {
        if (currentCrimeId && response.crimes.some((crime) => crime.id === currentCrimeId)) {
          return currentCrimeId;
        }

        return (
          response.crimes.find((crime) => crime.isRunnable)?.id ??
          response.crimes[0]?.id ??
          null
        );
      });
      setFeedbackMessage('Catálogo criminal sincronizado.');
    } catch (nextError) {
      setError(formatApiError(nextError).message);
      setFeedbackMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshPlayerProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadCatalog();
    }, [loadCatalog]),
  );

  const handleAttemptCrime = useCallback(async () => {
    if (!selectedCrime) {
      return;
    }

    if (!selectedCrime.isRunnable) {
      setBootstrapStatus(selectedCrime.lockReason ?? 'Crime indisponível no momento.');
      return;
    }

    setError(null);
    setIsAttempting(true);
    setFeedbackMessage(`Executando ${selectedCrime.name} agora...`);
    setBootstrapStatus(`Executando ${selectedCrime.name}.`);

    try {
      const response = await crimesApi.attempt(selectedCrime.id);
      setResult(response);
      await refreshPlayerProfile();
      const nextCatalog = await crimesApi.list();
      setCatalog(nextCatalog.crimes);
      setFeedbackMessage(response.message);
      setBootstrapStatus(response.message);
    } catch (nextError) {
      const message = formatApiError(nextError).message;
      setError(message);
      setFeedbackMessage(null);
      setBootstrapStatus(message);
    } finally {
      setIsAttempting(false);
    }
  }, [refreshPlayerProfile, selectedCrime, setBootstrapStatus]);

  return (
    <>
      <InGameScreenLayout
        subtitle="Escolha um crime, veja chance, custo e recompensa, e confirme a ação sem precisar adivinhar o que está liberado agora."
        title="Crimes"
      >
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Cansaço"
            tone={colors.success}
            value={`${player?.resources.cansaco ?? '--'}`}
          />
          <SummaryCard
            label="Disposição"
            tone="#7bb2ff"
            value={`${player?.resources.disposicao ?? '--'}`}
          />
          <SummaryCard label="HP" tone="#f49d9d" value={`${player?.resources.hp ?? '--'}`} />
          <SummaryCard
            label="Conceito"
            tone={colors.accent}
            value={`${player?.resources.conceito ?? '--'}`}
          />
        </View>

        {error ? (
          <Banner copy={error} tone="danger" />
        ) : null}

        {feedbackMessage ? <Banner copy={feedbackMessage} tone="neutral" /> : null}

        {isLoading ? <Banner copy="Carregando catálogo criminal..." tone="neutral" /> : null}

        {groupedCrimes.map((group) => (
          <View key={group.level} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.label}</Text>
            <View style={styles.crimeList}>
              {group.crimes.map((crime) => (
                <Pressable
                  accessibilityLabel={`Selecionar crime ${crime.name}`}
                  accessibilityRole="button"
                  key={crime.id}
                  onPress={() => {
                    setSelectedCrimeId(crime.id);
                    setFeedbackMessage(`${crime.name} pronto para confirmação.`);
                    setError(null);
                  }}
                  style={({ pressed }) => [
                    styles.crimeCard,
                    selectedCrime?.id === crime.id ? styles.crimeCardSelected : null,
                    crime.isLocked ? styles.crimeCardLocked : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.crimeHeader}>
                    <Text style={styles.crimeTitle}>{crime.name}</Text>
                    <Text style={styles.crimeChance}>
                      {formatCrimeChance(crime.estimatedSuccessChance)}
                    </Text>
                  </View>
                  <Text style={styles.crimeMeta}>
                    {formatCrimeCurrency(crime.rewardMin)} → {formatCrimeCurrency(crime.rewardMax)}
                  </Text>
                  <Text style={styles.crimeMeta}>{formatCrimeRewardReadLabel(crime.rewardRead)}</Text>
                  <Text style={styles.crimeMeta}>
                    {crime.cansacoCost} CAN · {crime.disposicaoCost} DIS · cooldown{' '}
                    {formatCrimeCooldown(crime.cooldownRemainingSeconds)}
                  </Text>
                  {crime.lockReason ? (
                    <Text style={styles.crimeLock}>{crime.lockReason}</Text>
                  ) : (
                    <Text style={styles.crimeReady}>Disponível para execução</Text>
                  )}
                  {selectedCrime?.id === crime.id ? (
                    <View style={styles.inlineSelectedCard}>
                      <View style={styles.operationHeader}>
                        <View style={styles.operationCopy}>
                          <Text style={styles.operationEyebrow}>{crime.type}</Text>
                          <Text style={styles.operationDescription}>
                            Chance estimada {formatCrimeChance(crime.estimatedSuccessChance)} ·
                            poder atual {crime.playerPower.toLocaleString('pt-BR')}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.stateChip,
                            crime.isRunnable
                              ? styles.stateChipReady
                              : crime.isOnCooldown
                                ? styles.stateChipCooldown
                                : styles.stateChipLocked,
                          ]}
                        >
                          <Text style={styles.stateChipLabel}>
                            {crime.isRunnable
                              ? 'Pronto'
                              : crime.isOnCooldown
                                ? formatCrimeCooldown(crime.cooldownRemainingSeconds)
                                : 'Bloqueado'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metricRow}>
                        <InfoPill
                          label="Custo"
                          value={`${crime.cansacoCost} CAN · ${crime.disposicaoCost} DIS`}
                        />
                        <InfoPill
                          label={crime.rewardRead === 'exact' ? 'Recompensa real' : 'Recompensa estimada'}
                          value={`${formatCrimeCurrency(crime.rewardMin)} → ${formatCrimeCurrency(crime.rewardMax)}`}
                        />
                        <InfoPill label="Conceito" value={`+${crime.conceitoReward}`} />
                      </View>

                      {crime.lockReason ? (
                        <Text style={styles.lockCopy}>{crime.lockReason}</Text>
                      ) : null}

                      <Pressable
                        accessibilityLabel={`Confirmar crime ${crime.name}`}
                        accessibilityRole="button"
                        disabled={!crime.isRunnable || isAttempting}
                        onPress={() => {
                          void handleAttemptCrime();
                        }}
                        style={({ pressed }) => [
                          styles.confirmButton,
                          (!crime.isRunnable || isAttempting) ? styles.confirmButtonDisabled : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        {isAttempting ? (
                          <View style={styles.buttonContent}>
                            <ActivityIndicator color={colors.background} size="small" />
                            <Text style={styles.confirmButtonLabel}>Executando agora...</Text>
                          </View>
                        ) : (
                          <Text style={styles.confirmButtonLabel}>Confirmar crime</Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </InGameScreenLayout>

      <CrimeResultModal
        onClose={() => {
          setResult(null);
        }}
        onPrisonAction={(actionId) => {
          setResult(null);
          setBootstrapStatus(
            actionId === 'advogado'
              ? 'Abrindo a prisão para tentar uma saída imediata.'
              : 'Abrindo a prisão para acompanhar a soltura.',
          );
          navigation.navigate('Prison');
        }}
        result={result}
        visible={result !== null}
      />
    </>
  );
}

function Banner({
  copy,
  tone,
}: {
  copy: string;
  tone: 'danger' | 'neutral';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        tone === 'danger' ? styles.bannerDanger : styles.bannerNeutral,
      ]}
    >
      <Text style={styles.bannerCopy}>{copy}</Text>
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillLabel}>{label}</Text>
      <Text style={styles.infoPillValue}>{value}</Text>
    </View>
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
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
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
    gap: 6,
    minWidth: '47%',
    padding: 14,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  banner: {
    borderRadius: 18,
    padding: 14,
  },
  bannerDanger: {
    backgroundColor: 'rgba(164, 63, 63, 0.18)',
    borderColor: 'rgba(220, 102, 102, 0.32)',
    borderWidth: 1,
  },
  bannerNeutral: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  operationCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 22,
    gap: 12,
    padding: 16,
  },
  operationHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  operationCopy: {
    flex: 1,
    gap: 4,
  },
  operationEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  operationTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  operationDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  stateChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    minWidth: 84,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stateChipReady: {
    backgroundColor: 'rgba(63, 163, 77, 0.16)',
  },
  stateChipCooldown: {
    backgroundColor: 'rgba(224, 176, 75, 0.16)',
  },
  stateChipLocked: {
    backgroundColor: 'rgba(164, 63, 63, 0.18)',
  },
  stateChipLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoPill: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    minWidth: '31%',
    padding: 12,
  },
  infoPillLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoPillValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmationCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  lockCopy: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#7b6640',
  },
  confirmButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  crimeList: {
    gap: 10,
  },
  crimeCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  crimeCardSelected: {
    borderColor: colors.accent,
  },
  inlineSelectedCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 12,
    padding: 14,
  },
  crimeCardLocked: {
    opacity: 0.62,
  },
  crimeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  crimeTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  crimeChance: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  crimeMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  crimeLock: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  crimeReady: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
