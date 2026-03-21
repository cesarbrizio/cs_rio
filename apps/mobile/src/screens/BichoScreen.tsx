import {
  BICHO_DRAW_INTERVAL_MINUTES,
  BICHO_MAX_BET,
  BICHO_MIN_BET,
  BICHO_PAYOUT_MULTIPLIERS,
  type BichoAnimalSummary,
  type BichoBetMode,
  type BichoListResponse,
  type BichoPlaceBetResponse,
} from '@cs-rio/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { bichoApi, formatApiError } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';
import {
  Banner,
  BichoResultModal,
  EmptyState,
  formatBetMode,
  formatCurrency,
  formatDateTime,
  formatDozen,
  formatRemainingSeconds,
  formatTimeOnly,
  MetricCard,
  MetricPill,
  resolveAnimalLabel,
  sanitizeDozen,
  sanitizeInteger,
  styles,
  SummaryCard,
} from './BichoScreen.parts';

const BET_AMOUNT_SUGGESTIONS = [100, 500, 1_000, 5_000] as const;
const BET_MODES: Array<{
  description: string;
  id: BichoBetMode;
  label: string;
}> = [
  {
    description: 'Aposta no grupo vencedor do sorteio. Mais direta, retorno médio.',
    id: 'grupo',
    label: 'Grupo',
  },
  {
    description: 'Aposta no animal que vai sair na cabeça. Mais pressionada, retorno melhor.',
    id: 'cabeca',
    label: 'Cabeça',
  },
  {
    description: 'Aposta na dezena vencedora. Mais arriscada, retorno mais alto.',
    id: 'dezena',
    label: 'Dezena',
  },
];

export function BichoScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [book, setBook] = useState<BichoListResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<BichoBetMode>('grupo');
  const [selectedAnimalNumber, setSelectedAnimalNumber] = useState<number | null>(1);
  const [dozenInput, setDozenInput] = useState('');
  const [amountInput, setAmountInput] = useState(String(BICHO_MIN_BET));
  const [result, setResult] = useState<BichoPlaceBetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const loadBook = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await bichoApi.getState();
      setBook(response);
      setSelectedAnimalNumber((current) => current ?? response.animals[0]?.number ?? 1);
      setFeedbackMessage('Banca atualizada. Escolha a jogada e confirme na própria card.');
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
      setFeedbackMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBook();
      return undefined;
    }, [loadBook]),
  );

  useEffect(() => {
    setNowMs(Date.now());
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const selectedAnimal = useMemo(
    () => book?.animals.find((animal) => animal.number === selectedAnimalNumber) ?? null,
    [book?.animals, selectedAnimalNumber],
  );
  const selectedModeDefinition = useMemo(
    () => BET_MODES.find((mode) => mode.id === selectedMode) ?? BET_MODES[0],
    [selectedMode],
  );
  const parsedAmount = useMemo(() => sanitizeInteger(amountInput), [amountInput]);
  const parsedDozen = useMemo(() => sanitizeDozen(dozenInput), [dozenInput]);
  const expectedPayout = useMemo(() => {
    if (parsedAmount <= 0) {
      return 0;
    }

    return parsedAmount * BICHO_PAYOUT_MULTIPLIERS[selectedMode];
  }, [parsedAmount, selectedMode]);
  const pendingBets = useMemo(
    () => book?.bets.filter((bet) => bet.status === 'pending') ?? [],
    [book?.bets],
  );
  const timeUntilCloseLabel = useMemo(() => {
    if (!book?.currentDraw) {
      return '--';
    }

    return formatRemainingSeconds(
      Math.max(0, Math.floor((new Date(book.currentDraw.closesAt).getTime() - nowMs) / 1000)),
    );
  }, [book?.currentDraw, nowMs]);

  const handlePlaceBet = useCallback(async () => {
    if (!book) {
      return;
    }

    if (parsedAmount < BICHO_MIN_BET || parsedAmount > BICHO_MAX_BET) {
      setErrorMessage(
        `A banca aceita apostas entre ${formatCurrency(BICHO_MIN_BET)} e ${formatCurrency(BICHO_MAX_BET)}.`,
      );
      return;
    }

    if (selectedMode === 'dezena' && parsedDozen === null) {
      setErrorMessage('Informe uma dezena valida entre 00 e 99.');
      return;
    }

    if ((selectedMode === 'grupo' || selectedMode === 'cabeca') && !selectedAnimal) {
      setErrorMessage('Escolha um animal antes de confirmar a aposta.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await bichoApi.placeBet({
        amount: parsedAmount,
        animalNumber: selectedMode === 'dezena' ? undefined : selectedAnimal?.number,
        dozen: selectedMode === 'dezena' ? (parsedDozen ?? undefined) : undefined,
        mode: selectedMode,
      });
      setResult(response);
      setFeedbackMessage(
        `${selectedModeDefinition.label} registrada. Sorteio #${response.currentDraw.sequence} fecha em ${formatDateTime(response.currentDraw.closesAt)}.`,
      );
      setBootstrapStatus(`${selectedModeDefinition.label} registrada na banca do bicho.`);
      await Promise.all([loadBook(), refreshPlayerProfile()]);
    } catch (error) {
      const message = formatApiError(error).message;
      setErrorMessage(message);
      setBootstrapStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    book,
    loadBook,
    parsedAmount,
    parsedDozen,
    refreshPlayerProfile,
    selectedAnimal,
    selectedMode,
    selectedModeDefinition.label,
    setBootstrapStatus,
  ]);

  return (
    <>
      <InGameScreenLayout
        subtitle="Mini-game manual de aposta. Veja o sorteio atual, escolha grupo, cabeça ou dezena e confirme ali mesmo na card da jogada, sem vínculo com facção ou patrimônio."
        title="Jogo do Bicho"
      >
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Caixa"
            tone={colors.warning}
            value={formatCurrency(player?.resources.money ?? 0)}
          />
          <SummaryCard
            label="Sorteio"
            tone={colors.accent}
            value={book ? `#${book.currentDraw.sequence}` : '--'}
          />
          <SummaryCard label="Fecha em" tone={colors.info} value={timeUntilCloseLabel} />
          <SummaryCard label="Pendentes" tone={colors.success} value={`${pendingBets.length}`} />
        </View>

        {errorMessage ? <Banner copy={errorMessage} tone="danger" /> : null}
        {feedbackMessage ? <Banner copy={feedbackMessage} tone="neutral" /> : null}
        {isLoading && !book ? (
          <Banner copy="Carregando banca, sorteio e histórico..." tone="neutral" />
        ) : null}

        {book ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rodada aberta</Text>
              <View style={styles.card}>
                <View style={styles.drawHeader}>
                  <View style={styles.drawCopy}>
                    <Text style={styles.drawTitle}>Extração #{book.currentDraw.sequence}</Text>
                    <Text style={styles.drawDescription}>
                      Janela de {BICHO_DRAW_INTERVAL_MINUTES} minutos. A banca fecha em{' '}
                      {formatDateTime(book.currentDraw.closesAt)}.
                    </Text>
                  </View>
                  <View style={styles.stateBadge}>
                    <Text style={styles.stateBadgeLabel}>{timeUntilCloseLabel}</Text>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <MetricPill label="Abriu" value={formatTimeOnly(book.currentDraw.opensAt)} />
                  <MetricPill label="Fecha" value={formatTimeOnly(book.currentDraw.closesAt)} />
                  <MetricPill label="Min." value={formatCurrency(BICHO_MIN_BET)} />
                  <MetricPill label="Max." value={formatCurrency(BICHO_MAX_BET)} />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Escolha a jogada</Text>
              <View style={styles.listColumn}>
                {BET_MODES.map((mode) => {
                  const isSelected = mode.id === selectedMode;

                  return (
                    <Pressable
                      key={mode.id}
                      onPress={() => {
                        setSelectedMode(mode.id);
                        setFeedbackMessage(`${mode.label} pronta para confirmar.`);
                        setErrorMessage(null);
                      }}
                      style={({ pressed }) => [
                        styles.betModeCard,
                        isSelected ? styles.betModeCardSelected : null,
                        pressed ? styles.buttonPressed : null,
                      ]}
                    >
                      <View style={styles.betModeHeader}>
                        <View style={styles.betModeCopy}>
                          <Text style={styles.betModeTitle}>{mode.label}</Text>
                          <Text style={styles.betModeDescription}>{mode.description}</Text>
                        </View>
                        <View style={styles.modeBadge}>
                          <Text style={styles.modeBadgeLabel}>
                            {BICHO_PAYOUT_MULTIPLIERS[mode.id]}x
                          </Text>
                        </View>
                      </View>

                      {isSelected ? (
                        <View style={styles.inlinePanel}>
                          {mode.id === 'dezena' ? (
                            <View style={styles.inlineBlock}>
                              <Text style={styles.inlineLabel}>Dezena</Text>
                              <TextInput
                                keyboardType="number-pad"
                                maxLength={2}
                                onChangeText={(value) => {
                                  setDozenInput(value.replace(/[^0-9]/g, '').slice(0, 2));
                                }}
                                placeholder="00"
                                placeholderTextColor={colors.muted}
                                style={styles.numericInput}
                                value={dozenInput}
                              />
                            </View>
                          ) : (
                            <View style={styles.inlineBlock}>
                              <Text style={styles.inlineLabel}>Animal</Text>
                              <View style={styles.animalGrid}>
                                {book.animals.map((animal) => (
                                  <Pressable
                                    key={animal.number}
                                    onPress={() => {
                                      setSelectedAnimalNumber(animal.number);
                                    }}
                                    style={({ pressed }) => [
                                      styles.animalChip,
                                      selectedAnimal?.number === animal.number
                                        ? styles.animalChipSelected
                                        : null,
                                      pressed ? styles.buttonPressed : null,
                                    ]}
                                  >
                                    <Text style={styles.animalChipTitle}>
                                      {animal.number}. {animal.label}
                                    </Text>
                                    <Text style={styles.animalChipMeta}>
                                      {animal.groupNumbers.join('-')}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          )}

                          <View style={styles.inlineBlock}>
                            <Text style={styles.inlineLabel}>Valor da aposta</Text>
                            <TextInput
                              keyboardType="number-pad"
                              onChangeText={(value) => {
                                setAmountInput(value.replace(/[^0-9]/g, ''));
                              }}
                              placeholder="100"
                              placeholderTextColor={colors.muted}
                              style={styles.numericInput}
                              value={amountInput}
                            />
                            <View style={styles.suggestionRow}>
                              {BET_AMOUNT_SUGGESTIONS.map((value) => (
                                <Pressable
                                  key={value}
                                  onPress={() => {
                                    setAmountInput(String(value));
                                  }}
                                  style={({ pressed }) => [
                                    styles.suggestionChip,
                                    parsedAmount === value ? styles.suggestionChipSelected : null,
                                    pressed ? styles.buttonPressed : null,
                                  ]}
                                >
                                  <Text style={styles.suggestionChipLabel}>
                                    {formatCurrency(value)}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>

                          <View style={styles.metricRow}>
                            <MetricPill
                              label="Seleção"
                              value={
                                mode.id === 'dezena'
                                  ? `Dezena ${parsedDozen === null ? '--' : formatDozen(parsedDozen)}`
                                  : selectedAnimal
                                    ? `${selectedAnimal.label}`
                                    : '--'
                              }
                            />
                            <MetricPill
                              label="Retorno brut."
                              value={formatCurrency(expectedPayout)}
                            />
                            <MetricPill label="Fecha" value={timeUntilCloseLabel} />
                          </View>

                          <Text style={styles.inlineHint}>
                            {mode.id === 'dezena'
                              ? 'Dezena é a jogada mais arriscada da banca. O retorno sobe, mas a chance cai.'
                              : mode.id === 'cabeca'
                                ? 'Cabeça mira o animal que fecha o sorteio no topo da rodada.'
                                : 'Grupo aposta no animal vencedor da rodada aberta agora.'}
                          </Text>

                          <Pressable
                            disabled={isSubmitting}
                            onPress={() => {
                              void handlePlaceBet();
                            }}
                            style={({ pressed }) => [
                              styles.primaryButton,
                              isSubmitting ? styles.buttonDisabled : null,
                              pressed ? styles.buttonPressed : null,
                            ]}
                          >
                            {isSubmitting ? (
                              <View style={styles.buttonContent}>
                                <ActivityIndicator color={colors.background} size="small" />
                                <Text style={styles.primaryButtonLabel}>Registrando aposta...</Text>
                              </View>
                            ) : (
                              <Text style={styles.primaryButtonLabel}>Confirmar aposta</Text>
                            )}
                          </Pressable>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Minhas apostas</Text>
              {book.bets.length > 0 ? (
                <View style={styles.listColumn}>
                  {book.bets.slice(0, 6).map((bet) => (
                    <View key={bet.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyTitle}>
                          {formatBetMode(bet.mode)} ·{' '}
                          {bet.mode === 'dezena'
                            ? `Dezena ${formatDozen(bet.dozen ?? 0)}`
                            : resolveAnimalLabel(book.animals, bet.animalNumber)}
                        </Text>
                        <Text
                          style={[
                            styles.historyStatus,
                            bet.status === 'won'
                              ? styles.historyWon
                              : bet.status === 'lost'
                                ? styles.historyLost
                                : styles.historyPending,
                          ]}
                        >
                          {bet.status === 'pending'
                            ? 'Aberta'
                            : bet.status === 'won'
                              ? 'Bateu'
                              : 'Perdeu'}
                        </Text>
                      </View>
                      <Text style={styles.historyCopy}>
                        {formatCurrency(bet.amount)} · retorno {formatCurrency(bet.payout)} ·
                        sorteio #
                        {book.recentDraws.find((draw) => draw.id === bet.drawId)?.sequence ??
                          book.currentDraw.sequence}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState copy="Nenhuma aposta aberta ainda. Escolha a jogada acima e registre a primeira banca do personagem." />
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Últimos resultados</Text>
              {book.recentDraws.length > 0 ? (
                <View style={styles.listColumn}>
                  {book.recentDraws.slice(0, 5).map((draw) => (
                    <View key={draw.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyTitle}>Sorteio #{draw.sequence}</Text>
                        <Text style={styles.historyMeta}>{formatDateTime(draw.settledAt)}</Text>
                      </View>
                      <Text style={styles.historyCopy}>
                        Grupo {draw.winningAnimalNumber} · Dezena {formatDozen(draw.winningDozen)}
                      </Text>
                      <Text style={styles.historyCopy}>
                        Entrou {formatCurrency(draw.totalBetAmount)} · saiu{' '}
                        {formatCurrency(draw.totalPayoutAmount)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState copy="Ainda não há resultado recente carregado nesta rodada." />
              )}
            </View>
          </>
        ) : null}
      </InGameScreenLayout>

      <BichoResultModal
        result={result}
        selectedAnimal={selectedAnimal}
        selectedMode={selectedMode}
        onClose={() => {
          setResult(null);
        }}
      />
    </>
  );
}
