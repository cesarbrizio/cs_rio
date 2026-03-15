import { type NpcInflationSummary } from '@cs-rio/shared';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  buildNpcInflationBody,
  buildNpcInflationDecisionHint,
  buildNpcInflationHeadline,
  formatNpcInflationAffectedServices,
  formatNpcInflationMultiplier,
  formatNpcInflationRelativeDays,
  formatNpcInflationScheduleEntry,
  formatNpcInflationSurcharge,
} from '../features/inflation';
import { colors } from '../theme/colors';

interface NpcInflationPanelProps {
  summary: NpcInflationSummary | null;
}

export function NpcInflationPanel({ summary }: NpcInflationPanelProps): JSX.Element | null {
  const [isScheduleVisible, setIsScheduleVisible] = useState(false);

  const scheduleRows = useMemo(() => summary?.schedule ?? [], [summary?.schedule]);

  if (!summary) {
    return null;
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>INFLAÇÃO NPC</Text>
        <Text style={styles.title}>{buildNpcInflationHeadline(summary)}</Text>
        <Text style={styles.copy}>{buildNpcInflationBody(summary)}</Text>

        <View style={styles.metricRow}>
          <MetricCard
            label="Agora"
            value={`${formatNpcInflationMultiplier(summary.currentMultiplier)} · ${formatNpcInflationSurcharge(summary.currentSurchargePercent)}`}
          />
          <MetricCard
            label="Próximo aumento"
            value={
              summary.nextIncreaseInDays === null || summary.nextMultiplier === null
                ? 'No teto'
                : `${formatNpcInflationRelativeDays(summary.nextIncreaseInDays)} · ${formatNpcInflationMultiplier(summary.nextMultiplier)}`
            }
          />
        </View>

        <Text style={styles.metaLine}>Afeta: {formatNpcInflationAffectedServices(summary)}</Text>
        <Text style={styles.metaLine}>
          1 dia de rodada = {summary.gameDayDurationHours}h reais · reinicia só na próxima rodada
        </Text>
        <Text style={styles.hint}>{buildNpcInflationDecisionHint(summary)}</Text>

        <Pressable
          onPress={() => {
            setIsScheduleVisible(true);
          }}
          style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.buttonLabel}>Ver tabela completa</Text>
        </Pressable>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          setIsScheduleVisible(false);
        }}
        transparent
        visible={isScheduleVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tabela completa da inflação</Text>
            <Text style={styles.modalCopy}>
              Cada linha mostra o multiplicador aplicado aos preços-base dos serviços de NPC ao longo da rodada.
            </Text>

            <ScrollView contentContainerStyle={styles.scheduleList} style={styles.scheduleScroller}>
              {scheduleRows.map((entry) => (
                <View key={`inflation-day-${entry.gameDay}`} style={styles.scheduleRow}>
                  <Text style={styles.scheduleRowLabel}>{formatNpcInflationScheduleEntry(entry)}</Text>
                </View>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => {
                setIsScheduleVisible(false);
              }}
              style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
            >
              <Text style={styles.buttonLabel}>Fechar tabela</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.86,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  hint: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  metaLine: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  metricCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 6, 9, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    maxHeight: '78%',
    padding: 20,
    width: '100%',
  },
  modalCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  scheduleList: {
    gap: 8,
    paddingBottom: 8,
  },
  scheduleRow: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scheduleRowLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleScroller: {
    maxHeight: 320,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
});
