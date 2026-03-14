import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildPrisonActionCopy,
  formatPrisonHeatTier,
  formatPrisonRemaining,
  getLivePrisonStatus,
  hasImmediatePrisonEscapeOptions,
} from '../features/prison';
import { formatApiError, prisonApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function PrisonScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof prisonApi.getCenter>> | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<'bail' | 'bribe' | 'escape' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadPrisonCenter = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await prisonApi.getCenter();
      setCenter(response);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPrisonCenter();
      return undefined;
    }, [loadPrisonCenter]),
  );

  useEffect(() => {
    setNowMs(Date.now());

    if (!center?.prison.isImprisoned) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [center?.prison.isImprisoned]);

  const livePrison = useMemo(
    () => getLivePrisonStatus(center?.prison ?? player?.prison ?? emptyPrisonState(), nowMs),
    [center?.prison, nowMs, player?.prison],
  );
  const canActNow = useMemo(() => hasImmediatePrisonEscapeOptions(center), [center]);

  const refreshEverything = useCallback(async () => {
    await Promise.all([loadPrisonCenter(), refreshPlayerProfile()]);
  }, [loadPrisonCenter, refreshPlayerProfile]);

  const handleAction = useCallback(
    async (actionId: 'bail' | 'bribe' | 'escape') => {
      setIsMutating(true);
      setFeedbackMessage(null);
      setPendingAction(actionId);
      setFeedbackMessage(
        actionId === 'bail'
          ? 'Enviando pedido de fiança...'
          : actionId === 'bribe'
            ? 'Tentando abrir caminho no suborno...'
            : 'Forçando uma rota de fuga...',
      );

      try {
        const response =
          actionId === 'bail'
            ? await prisonApi.bail()
            : actionId === 'bribe'
              ? await prisonApi.bribe()
              : await prisonApi.escape();

        await refreshEverything();
        setBootstrapStatus(response.message);
        setFeedbackMessage(response.message);
      } catch (error) {
        const message = formatApiError(error).message;
        setBootstrapStatus(message);
        setFeedbackMessage(message);
      } finally {
        setIsMutating(false);
        setPendingAction(null);
      }
    },
    [refreshEverything, setBootstrapStatus],
  );

  return (
    <InGameScreenLayout
      subtitle="Veja a pena em tempo real, leia o calor atual e tente as saídas liberadas pelo backend sem ficar adivinhando por que as outras ações estão travadas."
      title="Prisão"
    >
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Status"
          tone={livePrison.isImprisoned ? colors.danger : colors.success}
          value={livePrison.isImprisoned ? 'Preso' : 'Livre'}
        />
        <SummaryCard
          label="Restante"
          tone={colors.warning}
          value={formatPrisonRemaining(livePrison.remainingSeconds)}
        />
        <SummaryCard
          label="Calor"
          tone={colors.info}
          value={`${livePrison.heatScore}`}
        />
        <SummaryCard
          label="Faixa"
          tone={colors.accent}
          value={formatPrisonHeatTier(livePrison.heatTier)}
        />
      </View>

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Carregando centro prisional</Text>
          <Text style={styles.loadingCopy}>Sincronizando pena, calor da polícia e alternativas de soltura.</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <Banner
          actionLabel="Tentar de novo"
          message={errorMessage}
          tone="danger"
          onPress={() => {
            void loadPrisonCenter();
          }}
        />
      ) : null}

      {feedbackMessage ? (
        <Banner
          message={feedbackMessage}
          tone={feedbackMessage.toLowerCase().includes('falhou') ? 'danger' : 'info'}
        />
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Situação atual</Text>
        <Text style={styles.mainReason}>
          {livePrison.reason ?? 'Sem registro de prisão ativa.'}
        </Text>
        <Text style={styles.metaCopy}>
          Sentenciado em {livePrison.sentencedAt ? formatDateTime(livePrison.sentencedAt) : 'data indisponível'}.
        </Text>
        <Text style={styles.metaCopy}>
          Soltura prevista para {livePrison.endsAt ? formatDateTime(livePrison.endsAt) : 'agora'}.
        </Text>
        <Text style={styles.helperCopy}>
          {livePrison.isImprisoned
            ? canActNow
              ? 'Você ainda pode tentar sair agora usando uma das opções abaixo.'
              : 'Não há saída imediata liberada. Resta aguardar a pena ou depender de outro membro autorizado.'
            : 'Seu personagem está livre. Quando o backend registrar nova pena, esta tela passa a mostrar timer e opções reais.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saídas imediatas</Text>
        <ActionCard
          accent={colors.accent}
          availability={center?.actions.bail}
          disabled={isMutating || !center?.actions.bail.available}
          isPending={pendingAction === 'bail'}
          label="Fiança"
          meta={buildPrisonActionCopy(
            'bail',
            center?.actions.bail ?? unavailableAction(),
          )}
          onPress={() => {
            void handleAction('bail');
          }}
        />
        <ActionCard
          accent={colors.warning}
          availability={center?.actions.bribe}
          disabled={isMutating || !center?.actions.bribe.available}
          isPending={pendingAction === 'bribe'}
          label="Suborno"
          meta={buildPrisonActionCopy(
            'bribe',
            center?.actions.bribe ?? unavailableAction(),
          )}
          onPress={() => {
            void handleAction('bribe');
          }}
        />
        <ActionCard
          accent={colors.danger}
          availability={center?.actions.escape}
          disabled={isMutating || !center?.actions.escape.available}
          isPending={pendingAction === 'escape'}
          label="Fuga"
          meta={buildPrisonActionCopy(
            'escape',
            center?.actions.escape ?? unavailableAction(),
          )}
          onPress={() => {
            void handleAction('escape');
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resgate da facção</Text>
        <Text style={styles.mainReason}>
          {buildPrisonActionCopy(
            'factionRescue',
            center?.actions.factionRescue ?? unavailableAction(),
          )}
        </Text>
        <Text style={styles.helperCopy}>
          Nesta fase, o resgate precisa ser executado por outro membro autorizado da mesma facção. Esta tela mostra se você é um alvo elegível, mas não dispara o resgate sozinha.
        </Text>
      </View>

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
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryLabel, { color: tone }]}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

function ActionCard({
  accent,
  availability,
  disabled,
  isPending = false,
  label,
  meta,
  onPress,
}: {
  accent: string;
  availability:
    | Awaited<ReturnType<typeof prisonApi.getCenter>>['actions']['bail']
    | undefined;
  disabled: boolean;
  isPending?: boolean;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.actionCard}>
      <View style={styles.actionHeader}>
        <View style={styles.actionHeaderCopy}>
          <Text style={[styles.actionEyebrow, { color: accent }]}>
            {availability?.successChancePercent != null
              ? `${availability.successChancePercent}%`
              : '—'}
          </Text>
          <Text style={styles.actionTitle}>{label}</Text>
        </View>
        <View
          style={[
            styles.statusChip,
            disabled ? styles.statusChipMuted : styles.statusChipReady,
          ]}
        >
          <Text style={styles.statusChipLabel}>{disabled ? 'Indisponível' : 'Tentar'}</Text>
        </View>
      </View>

      <Text style={styles.actionMeta}>{meta}</Text>

      <View style={styles.costRow}>
        {availability?.moneyCost != null ? (
          <MetricPill label="Dinheiro" value={`R$ ${Math.round(availability.moneyCost)}`} />
        ) : null}
        {availability?.creditsCost != null ? (
          <MetricPill label="Créditos" value={`${availability.creditsCost}`} />
        ) : null}
        {availability?.factionBankCost != null ? (
          <MetricPill label="Banco facção" value={`R$ ${Math.round(availability.factionBankCost)}`} />
        ) : null}
      </View>

      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.secondaryButton,
          disabled ? styles.buttonDisabled : null,
          pressed ? styles.buttonPressed : null,
        ]}
      >
        {isPending ? (
          <View style={styles.secondaryButtonContent}>
            <ActivityIndicator color={colors.text} size="small" />
            <Text style={styles.secondaryButtonLabel}>Processando...</Text>
          </View>
        ) : (
          <Text style={styles.secondaryButtonLabel}>
            {disabled ? 'Não disponível' : `Tentar ${label.toLowerCase()}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function Banner({
  actionLabel,
  message,
  onPress,
  tone,
}: {
  actionLabel?: string;
  message: string;
  onPress?: () => void;
  tone: 'danger' | 'info';
}) {
  const borderColor = tone === 'danger' ? colors.danger : colors.info;

  return (
    <View style={[styles.banner, { borderColor }]}>
      <Text style={styles.bannerCopy}>{message}</Text>
      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.bannerButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.bannerButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}

function emptyPrisonState() {
  return {
    endsAt: null,
    heatScore: 0,
    heatTier: 'frio' as const,
    isImprisoned: false,
    reason: null,
    remainingSeconds: 0,
    sentencedAt: null,
  };
}

function unavailableAction() {
  return {
    available: false,
    creditsCost: null,
    factionBankCost: null,
    moneyCost: null,
    reason: 'Indisponível agora.',
    successChancePercent: null,
  };
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
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  mainReason: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  metaCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  helperCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  actionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionHeaderCopy: {
    flex: 1,
    gap: 2,
    marginRight: 10,
  },
  actionEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  actionMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  costRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    backgroundColor: colors.panelAlt,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.84,
  },
  buttonDisabled: {
    opacity: 0.48,
  },
  banner: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusChipReady: {
    backgroundColor: 'rgba(63, 163, 77, 0.18)',
  },
  statusChipMuted: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusChipLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
