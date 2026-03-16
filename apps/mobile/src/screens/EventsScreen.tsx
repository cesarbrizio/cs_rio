import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildEventFeed,
  resolveEventDestinationLabel,
  resolveEventNotificationAccent,
  resolveEventNotificationTimeLabel,
} from '../features/events';
import {
  formatEventResultResolvedLabel,
  resolveEventResultDestinationLabel,
} from '../features/event-results';
import { eventApi, formatApiError } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function EventsScreen(): JSX.Element {
  const eventNotifications = useAppStore((state) => state.eventNotifications);
  const eventResultHistory = useAppStore((state) => state.eventResultHistory);
  const lastEventSyncAt = useAppStore((state) => state.lastEventSyncAt);
  const lastEventResultSyncAt = useAppStore((state) => state.lastEventResultSyncAt);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const setEventFeed = useAppStore((state) => state.setEventFeed);
  const setEventResultFeed = useAppStore((state) => state.setEventResultFeed);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [docks, police, seasonal, results] = await Promise.all([
        eventApi.getDocksStatus(),
        eventApi.getPoliceStatus(),
        eventApi.getSeasonalStatus(),
        eventApi.getResults(),
      ]);
      setEventFeed(
        buildEventFeed({
          docks,
          police,
          seasonal,
        }),
      );
      setEventResultFeed(results);
      setBootstrapStatus('Central de eventos sincronizada com ativos e resultados recentes.');
    } catch (error) {
      const message = formatApiError(error).message;
      setErrorMessage(message);
      setBootstrapStatus(message);
    } finally {
      setIsLoading(false);
    }
  }, [setBootstrapStatus, setEventFeed, setEventResultFeed]);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
      return undefined;
    }, [loadEvents]),
  );

  return (
    <InGameScreenLayout
      subtitle="Acompanhe eventos em andamento, confira o desfecho dos eventos encerrados e revise o histórico recente quando voltar offline."
      title="Eventos"
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Ativos agora</Text>
            <Text style={styles.sectionMeta}>
              {lastEventSyncAt ? `Sincronizado ${formatEventResultResolvedLabel(lastEventSyncAt)}` : 'Sem sincronização ainda'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void loadEvents();
            }}
            style={({ pressed }) => [styles.refreshButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.refreshButtonLabel}>Atualizar</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.loadingCopy}>Sincronizando eventos e resultados...</Text>
          </View>
        ) : null}

        {errorMessage ? <EmptyState copy={errorMessage} /> : null}

        {!isLoading && !errorMessage && eventNotifications.length > 0 ? (
          <View style={styles.listColumn}>
            {eventNotifications.map((notification) => {
              const accent = resolveEventNotificationAccent(notification.severity);

              return (
                <View key={notification.id} style={[styles.card, { borderColor: `${accent}44` }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardEyebrow, { color: accent }]}>Evento ativo</Text>
                    <Text style={styles.cardMeta}>
                      {resolveEventNotificationTimeLabel(notification.remainingSeconds)}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{notification.title}</Text>
                  <Text style={styles.cardCopy}>{notification.body}</Text>
                  <View style={styles.metricRow}>
                    <MetricPill label="Região" value={notification.regionLabel} />
                    <MetricPill
                      label="Destino"
                      value={resolveEventDestinationLabel(notification.destination)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {!isLoading && !errorMessage && eventNotifications.length === 0 ? (
          <EmptyState copy="Nenhum evento ativo no momento. Quando algo estiver rolando no mapa, aparece aqui." />
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Resultados recentes</Text>
            <Text style={styles.sectionMeta}>
              {lastEventResultSyncAt
                ? `Histórico sincronizado ${formatEventResultResolvedLabel(lastEventResultSyncAt)}`
                : 'Sem histórico sincronizado ainda'}
            </Text>
          </View>
        </View>

        {eventResultHistory.length > 0 ? (
          <View style={styles.listColumn}>
            {eventResultHistory.map((result) => {
              const accent = resolveEventNotificationAccent(result.severity);

              return (
                <View key={result.id} style={[styles.card, { borderColor: `${accent}44` }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardEyebrow, { color: accent }]}>Evento encerrado</Text>
                    <Text style={styles.cardMeta}>
                      {formatEventResultResolvedLabel(result.resolvedAt)}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{result.title}</Text>
                  <Text style={styles.cardCopy}>{result.headline}</Text>
                  <Text style={styles.cardOutcome}>{result.body}</Text>
                  <Text style={styles.cardImpact}>{result.impactSummary}</Text>

                  {result.metrics.length > 0 ? (
                    <View style={styles.metricRow}>
                      {result.metrics.slice(0, 4).map((metric) => (
                        <MetricPill key={`${result.id}:${metric.label}`} label={metric.label} value={metric.value} />
                      ))}
                    </View>
                  ) : null}

                  <Text style={styles.destinationHint}>
                    {resolveEventResultDestinationLabel(result.destination)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState copy="Nenhum resultado recente de evento foi sincronizado ainda." />
        )}
      </View>
    </InGameScreenLayout>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.84,
  },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  cardCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardImpact: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  cardOutcome: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  destinationHint: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyStateCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  listColumn: {
    gap: 12,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metricPill: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    gap: 4,
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  refreshButton: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
});
