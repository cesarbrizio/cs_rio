import type { FactionLeadershipElectionCandidateSummary } from '@cs-rio/shared';
import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { resolveFactionRankLabel } from '../features/faction';
import { styles } from './FactionScreen.styles';

export { styles } from './FactionScreen.styles';

export function ActionButton({
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'primary' | 'warning';
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === 'warning' ? styles.actionButtonWarning : null,
        tone === 'danger' ? styles.actionButtonDanger : null,
        disabled ? styles.buttonDisabled : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.actionButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function MiniButton({
  disabled = false,
  label,
  onPress,
  tone = 'info',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'info' | 'success' | 'warning';
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniButton,
        tone === 'danger' ? styles.miniButtonDanger : null,
        tone === 'success' ? styles.miniButtonSuccess : null,
        tone === 'warning' ? styles.miniButtonWarning : null,
        disabled ? styles.buttonDisabled : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.miniButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ copy, tone }: { copy: string; tone: 'danger' | 'info' }): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{copy}</Text>
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
            accessibilityLabel="Fechar resultado da facção"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.modalButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.modalButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function CandidateCard({
  candidate,
  canVote,
  isMutating,
  onVote,
}: {
  candidate: FactionLeadershipElectionCandidateSummary;
  canVote: boolean;
  isMutating: boolean;
  onVote: () => void;
}): JSX.Element {
  return (
    <View style={styles.listCard}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.flexCopy}>
          <Text style={styles.cardTitle}>{candidate.nickname}</Text>
          <Text style={styles.cardCopy}>
            {resolveFactionRankLabel(candidate.rank)} · nível {candidate.level}
          </Text>
        </View>
        <Tag label={`${candidate.votes} votos`} tone="accent" />
      </View>
      {canVote ? (
        <ActionButton disabled={isMutating} label="Votar neste nome" onPress={onVote} />
      ) : null}
    </View>
  );
}

export function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

export function Field({ children, label }: { children: ReactNode; label: string }): JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function SectionCard({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
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
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

export function Tag({
  label,
  tone,
}: {
  label: string;
  tone: 'accent' | 'info' | 'neutral' | 'success' | 'warning';
}): JSX.Element {
  return (
    <View
      style={[
        styles.tag,
        tone === 'accent' ? styles.tagAccent : null,
        tone === 'info' ? styles.tagInfo : null,
        tone === 'success' ? styles.tagSuccess : null,
        tone === 'warning' ? styles.tagWarning : null,
      ]}
    >
      <Text style={styles.tagLabel}>{label}</Text>
    </View>
  );
}
