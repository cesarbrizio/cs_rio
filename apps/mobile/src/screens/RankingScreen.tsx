import { useFocusEffect } from '@react-navigation/native';
import { RANKING_SCREEN_DESCRIPTION, useRankingController } from '@cs-rio/ui/hooks';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { roundApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function RankingScreen(): JSX.Element {
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const { center, error, isLoading, loadCenter } = useRankingController({
    roundApi,
  });

  const syncRanking = useCallback(async () => {
    try {
      const response = await loadCenter();
      setBootstrapStatus(
        `Ranking carregado para a rodada #${response.round.number}.`,
      );
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : 'Falha ao carregar o ranking da rodada.';
      setBootstrapStatus(message);
    }
  }, [loadCenter, setBootstrapStatus]);

  useFocusEffect(
    useCallback(() => {
      void syncRanking();
      return undefined;
    }, [syncRanking]),
  );

  return (
    <InGameScreenLayout
      subtitle={RANKING_SCREEN_DESCRIPTION}
      title="Ranking"
    >
      <View style={styles.summaryRow}>
        <SummaryCard
          label="Rodada"
          tone={colors.warning}
          value={`#${center?.round.number ?? '--'}`}
        />
        <SummaryCard
          label="Dia atual"
          tone={colors.info}
          value={`${center?.npcInflation.currentGameDay ?? 0}/${center?.round.totalGameDays ?? 0}`}
        />
        <SummaryCard
          label="Fecha"
          tone={colors.muted}
          value={formatTimestamp(center?.round.endsAt)}
        />
        <SummaryCard
          label="Prêmio top 10"
          tone={colors.success}
          value={`${center?.topTenCreditReward ?? 0}`}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            <Text style={styles.sectionMeta}>
              {center
                ? `${center.leaderboard.length} nomes no topo da rodada atual.`
                : 'Carregando os nomes que puxam conceito nesta rodada.'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void syncRanking();
            }}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.refreshButtonLabel}>
              {isLoading ? 'Sincronizando...' : 'Atualizar'}
            </Text>
          </Pressable>
        </View>

        {error ? <EmptyState copy={error} /> : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.loadingCopy}>Puxando o ranking da rodada...</Text>
          </View>
        ) : null}

        {!isLoading && !error && (center?.leaderboard.length ?? 0) > 0 ? (
          <View style={styles.listColumn}>
            {center!.leaderboard.map((entry) => {
              const accent =
                entry.rank === 1
                  ? colors.warning
                  : entry.rank <= 3
                    ? colors.accent
                    : colors.line;

              return (
                <View key={entry.playerId} style={[styles.card, { borderColor: `${accent}55` }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardEyebrow, { color: accent }]}>
                      {entry.rank <= 3 ? 'Topo da rodada' : 'No ranking'}
                    </Text>
                    <FactionBadge label={entry.factionAbbreviation ?? 'Solo'} />
                  </View>
                  <Text style={styles.cardTitle}>
                    #{entry.rank} · {entry.nickname}
                  </Text>
                  <View style={styles.metricRow}>
                    <MetricPill label="Nível" value={`${entry.level}`} />
                    <MetricPill label="Conceito" value={`${entry.conceito}`} />
                    <MetricPill
                      label="Status"
                      value={entry.rank <= 10 ? 'Top 10' : 'Na disputa'}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {!isLoading && !error && (center?.leaderboard.length ?? 0) === 0 ? (
          <EmptyState copy="O ranking ainda nao tem jogadores suficientes para formar o leaderboard desta rodada." />
        ) : null}
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
}): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
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

function FactionBadge({ label }: { label: string }): JSX.Element {
  return (
    <View style={styles.factionBadge}>
      <Text style={styles.factionBadgeLabel}>{label}</Text>
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

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.84,
  },
  card: {
    backgroundColor: colors.panelAlt,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  emptyState: {
    backgroundColor: colors.panel,
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
  factionBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  factionBadgeLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  listColumn: {
    gap: 10,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  loadingCopy: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  metricPill: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: '30%',
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
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  refreshButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  section: {
    gap: 10,
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
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: '47%',
    padding: 14,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
});
