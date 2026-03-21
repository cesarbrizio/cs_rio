import type {
  MarketAuctionSummary,
  MarketOrderSummary,
  PlayerInventoryItem,
} from '@cs-rio/shared';
import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { styles } from './MarketScreen.styles';
export { styles } from './MarketScreen.styles';

import { formatMarketCurrency, type MarketItemTypeFilter } from '../features/market';

export function resolveItemTypeFilterLabel(filterId: MarketItemTypeFilter): string {
  if (filterId === 'all') {
    return 'Tudo';
  }

  if (filterId === 'weapon') {
    return 'Armas';
  }

  if (filterId === 'vest') {
    return 'Coletes';
  }

  return 'Drogas';
}

export function SummaryCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export function Banner({
  copy,
  tone,
}: {
  copy: string;
  tone: 'danger' | 'neutral' | 'success';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        tone === 'danger'
          ? styles.bannerDanger
          : tone === 'success'
            ? styles.bannerSuccess
            : styles.bannerNeutral,
      ]}
    >
      <Text style={styles.bannerCopy}>{copy}</Text>
    </View>
  );
}

export function SectionCard({
  children,
  eyebrow,
  subtitle,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  subtitle: string;
  title: string;
}): JSX.Element {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

export function AuctionCard({
  accent,
  auction,
  children,
  countdown,
  onPress,
}: {
  accent: boolean;
  auction: MarketAuctionSummary;
  children?: ReactNode;
  countdown: string;
  onPress?: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Selecionar leilão de ${auction.itemName}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listCard,
        accent ? styles.listCardActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardCopy}>
          <Text style={styles.listCardEyebrow}>{auction.itemType}</Text>
          <Text style={styles.listCardTitle}>{auction.itemName}</Text>
          <Text style={styles.listCardMeta}>
            Atual {formatMarketCurrency(auction.currentBid ?? auction.startingBid)} · próximo{' '}
            {formatMarketCurrency(auction.minNextBid)}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeLabel}>{countdown}</Text>
        </View>
      </View>
      {children}
    </Pressable>
  );
}

export function OrderCard({
  actionLabel,
  accent,
  children,
  onAction,
  onPress,
  order,
}: {
  actionLabel?: string;
  accent: boolean;
  children?: ReactNode;
  onAction?: () => void;
  onPress?: () => void;
  order: MarketOrderSummary;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Selecionar ordem de ${order.itemName}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listCard,
        accent ? styles.listCardActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardCopy}>
          <Text style={styles.listCardEyebrow}>{order.itemType}</Text>
          <Text style={styles.listCardTitle}>{order.itemName}</Text>
          <Text style={styles.listCardMeta}>
            {order.remainingQuantity}x restantes · {formatMarketCurrency(order.pricePerUnit)}
          </Text>
          <Text style={styles.listCardMetaMuted}>
            {order.sourceType === 'system'
              ? (order.sourceLabel ?? 'Fornecedor da rodada')
              : 'Anúncio de jogador'}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeLabel}>{order.status}</Text>
        </View>
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {children}
    </Pressable>
  );
}

export function InventoryItemCard({
  actionLabel,
  accent,
  children,
  item,
  onAction,
  onPress,
}: {
  actionLabel?: string;
  accent: boolean;
  children?: ReactNode;
  item: PlayerInventoryItem;
  onAction?: () => void;
  onPress?: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Selecionar item ${item.itemName ?? item.itemType}`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listCard,
        accent ? styles.listCardActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardCopy}>
          <Text style={styles.listCardEyebrow}>{item.itemType}</Text>
          <Text style={styles.listCardTitle}>{item.itemName ?? item.itemType}</Text>
          <Text style={styles.listCardMeta}>
            {item.quantity}x · durabilidade {item.durability ?? '--'}/{item.maxDurability ?? '--'} ·
            prof {item.proficiency}
          </Text>
        </View>
        {item.isEquipped ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeLabel}>equipado</Text>
          </View>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {children}
    </Pressable>
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
            accessibilityLabel="Fechar resultado do mercado"
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
