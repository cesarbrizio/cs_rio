import { type CharacterAppearance, type HospitalStatItemCode } from '@cs-rio/shared';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { styles } from './HospitalScreen.styles';
export { styles } from './HospitalScreen.styles';

import { hospitalApi } from '../services/api';
import { colors } from '../theme/colors';
import { formatCurrency, HOSPITAL_SKIN_OPTIONS } from '../features/hospital';

type HospitalCenter = Awaited<ReturnType<typeof hospitalApi.getCenter>>;

export function buildSurgeryPayload(
  center: HospitalCenter | null,
  nicknameDraft: string,
  appearanceDraft: CharacterAppearance,
) {
  if (!center) {
    return {};
  }

  const payload: {
    appearance?: CharacterAppearance;
    nickname?: string;
  } = {};
  const nextNickname = nicknameDraft.trim();

  if (nextNickname.length > 0 && nextNickname !== center.player.nickname) {
    payload.nickname = nextNickname;
  }

  if (
    appearanceDraft.skin !== center.player.appearance.skin ||
    appearanceDraft.hair !== center.player.appearance.hair ||
    appearanceDraft.outfit !== center.player.appearance.outfit
  ) {
    payload.appearance = appearanceDraft;
  }

  return payload;
}

export function unavailableHospitalService() {
  return {
    available: false,
    creditsCost: null,
    moneyCost: null,
    reason: 'Indisponível agora.',
  };
}

export function emptyHospitalizationState() {
  return {
    endsAt: null,
    isHospitalized: false,
    reason: null,
    remainingSeconds: 0,
    startedAt: null,
    trigger: null,
  };
}

export function formatDateTime(dateValue: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateValue));
}

export function SummaryCard({
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

export function ActionCard({
  accent,
  availability,
  buttonLabel,
  disabled,
  isPending = false,
  label,
  meta,
  onPress,
}: {
  accent: string;
  availability?: {
    available: boolean;
    creditsCost: number | null;
    moneyCost: number | null;
    reason: string | null;
  };
  buttonLabel: string;
  disabled: boolean;
  isPending?: boolean;
  label: string;
  meta: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <View style={styles.actionCard}>
      <View style={styles.actionCopy}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionMeta}>{meta}</Text>
        <Text style={styles.actionCost}>
          {availability?.creditsCost
            ? `${availability.creditsCost} créditos`
            : availability?.moneyCost
              ? formatCurrency(availability.moneyCost)
              : 'Sem custo adicional'}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={buttonLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.inlineButton,
          { borderColor: accent },
          pressed || disabled ? styles.buttonPressed : null,
        ]}
      >
        {isPending ? (
          <View style={styles.inlineButtonContent}>
            <ActivityIndicator color={accent} size="small" />
            <Text style={[styles.inlineButtonLabel, { color: accent }]}>Processando...</Text>
          </View>
        ) : (
          <Text style={[styles.inlineButtonLabel, { color: accent }]}>{buttonLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

export function Banner({
  actionLabel,
  message,
  onPress,
  tone,
}: {
  actionLabel?: string;
  message: string;
  onPress?: () => void;
  tone: 'danger' | 'info';
}): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{message}</Text>
      {actionLabel && onPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.bannerButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.bannerButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MutationResultModal({
  message,
  onClose,
  tone,
  visible,
}: {
  message: string | null;
  onClose: () => void;
  tone: 'danger' | 'info';
  visible: boolean;
}): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            tone === 'danger' ? styles.modalCardDanger : styles.modalCardInfo,
          ]}
        >
          <Text style={styles.modalTitle}>
            {tone === 'danger' ? 'Ação falhou' : 'Ação executada'}
          </Text>
          <Text style={styles.modalCopy}>{message}</Text>
          <Pressable
            accessibilityLabel="Fechar resultado do hospital"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.primaryButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function ChoiceRow({
  onSelect,
  options,
  selectedId,
}: {
  onSelect: (id: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
  selectedId: string;
}): JSX.Element {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => (
        <Pressable
          accessibilityLabel={`Selecionar ${option.label}`}
          accessibilityRole="button"
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={({ pressed }) => [
            styles.choicePill,
            selectedId === option.id ? styles.choicePillSelected : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.choicePillLabel}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ToneRow({
  onSelect,
  selectedId,
}: {
  onSelect: (id: string) => void;
  selectedId: string;
}): JSX.Element {
  return (
    <View style={styles.toneRow}>
      {HOSPITAL_SKIN_OPTIONS.map((option) => {
        const isSelected = option.id === selectedId;

        return (
          <Pressable
            accessibilityLabel={`Selecionar tom de pele ${option.label}`}
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.toneOption,
              isSelected ? styles.toneOptionSelected : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <View style={[styles.toneSwatch, { backgroundColor: option.swatch }]} />
            <Text style={styles.toneLabel}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateCopy}>{copy}</Text>
    </View>
  );
}
