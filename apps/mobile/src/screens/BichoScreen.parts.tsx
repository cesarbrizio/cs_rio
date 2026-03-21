import {
  type BichoAnimalSummary,
  type BichoBetMode,
  type BichoPlaceBetResponse,
} from '@cs-rio/shared';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { styles } from './BichoScreen.styles';
export { styles } from './BichoScreen.styles';

import { colors } from '../theme/colors';

export function BichoResultModal(props: {
  onClose: () => void;
  result: BichoPlaceBetResponse | null;
  selectedAnimal: BichoAnimalSummary | null;
  selectedMode: BichoBetMode;
}): JSX.Element {
  return (
    <Modal animationType="fade" transparent visible={Boolean(props.result)}>
      <View style={styles.modalRoot}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalEyebrow}>Banca confirmada</Text>
            <Text style={styles.modalTitle}>
              {props.result ? formatBetMode(props.result.bet.mode) : ''}
            </Text>
            <Text style={styles.modalCopy}>
              {props.result
                ? props.result.bet.mode === 'dezena'
                  ? `Dezena ${formatDozen(props.result.bet.dozen ?? 0)} registrada com sucesso.`
                  : `${props.selectedAnimal?.label ?? 'Animal'} entrou na banca do sorteio #${props.result.currentDraw.sequence}.`
                : ''}
            </Text>
          </View>

          {props.result ? (
            <View style={styles.modalMetrics}>
              <MetricCard
                label="Valor"
                tone={colors.warning}
                value={formatCurrency(props.result.bet.amount)}
              />
              <MetricCard
                label="Retorno"
                tone={colors.success}
                value={formatCurrency(props.result.bet.payout)}
              />
              <MetricCard
                label="Fecha"
                tone={colors.info}
                value={formatTimeOnly(props.result.currentDraw.closesAt)}
              />
              <MetricCard
                label="Caixa"
                tone={colors.accent}
                value={formatCurrency(props.result.playerMoneyAfterBet)}
              />
            </View>
          ) : null}

          <Pressable
            onPress={props.onClose}
            style={({ pressed }) => [styles.modalButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.modalButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function SummaryCard(props: { label: string; tone: string; value: string }): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color: props.tone }]}>{props.value}</Text>
      <Text style={styles.summaryLabel}>{props.label}</Text>
    </View>
  );
}

export function MetricCard(props: { label: string; tone: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricCardValue, { color: props.tone }]}>{props.value}</Text>
      <Text style={styles.metricCardLabel}>{props.label}</Text>
    </View>
  );
}

export function MetricPill(props: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{props.label}</Text>
      <Text style={styles.metricPillValue}>{props.value}</Text>
    </View>
  );
}

export function Banner(props: { copy: string; tone: 'danger' | 'neutral' }): JSX.Element {
  return (
    <View
      style={[styles.banner, props.tone === 'danger' ? styles.bannerDanger : styles.bannerNeutral]}
    >
      <Text style={styles.bannerCopy}>{props.copy}</Text>
    </View>
  );
}

export function EmptyState(props: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateCopy}>{props.copy}</Text>
    </View>
  );
}

export function sanitizeInteger(value: string): number {
  const normalized = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function sanitizeDozen(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const normalized = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);

  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 99) {
    return null;
  }

  return normalized;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function formatTimeOnly(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatRemainingSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function formatDozen(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatBetMode(mode: BichoBetMode): string {
  return mode === 'grupo' ? 'Grupo' : mode === 'cabeca' ? 'Cabeça' : 'Dezena';
}

export function resolveAnimalLabel(
  animals: BichoAnimalSummary[],
  animalNumber: number | null,
): string {
  if (!animalNumber) {
    return 'Animal';
  }

  const animal = animals.find((entry) => entry.number === animalNumber);
  return animal ? `${animal.number}. ${animal.label}` : `Grupo ${animalNumber}`;
}
