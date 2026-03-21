import {
  INVENTORY_EXPANSION_HINT,
  INVENTORY_SCREEN_DESCRIPTION,
  resolveInventoryItemTypeLabel,
  type InventoryResolvedAction,
  type InventoryStatusTone,
  useInventoryController,
} from '@cs-rio/ui/hooks';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { colors } from '../theme/colors';

interface InventoryResultState {
  message: string;
  title: string;
  tone: 'danger' | 'info';
}

export function InventoryScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const inventoryActions = useInventoryStore();
  const [resultState, setResultState] = useState<InventoryResultState | null>(null);
  const lastFeedbackRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const {
    buildInventoryBenefitLines,
    equippedCount,
    error,
    feedback,
    items,
    repairableCount,
    resolveInventoryItemPresentation,
    runAction,
    selectedItemId,
    setSelectedItemId,
    submittingItemId,
  } = useInventoryController({
    actions: inventoryActions,
    player,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshPlayerProfile();
    }, [refreshPlayerProfile]),
  );

  useEffect(() => {
    if (feedback && feedback !== lastFeedbackRef.current) {
      lastFeedbackRef.current = feedback;
      setResultState({
        message: feedback,
        title: 'Inventario atualizado',
        tone: 'info',
      });
      setBootstrapStatus(feedback);
    }
  }, [feedback, setBootstrapStatus]);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      setResultState({
        message: error,
        title: 'Acao nao concluida',
        tone: 'danger',
      });
    }
  }, [error]);

  const handleActionPress = useCallback(
    (action: InventoryResolvedAction, item: { id: string; itemName: string | null; itemType: string }) => {
      if (action.disabledReason) {
        setResultState({
          message: action.disabledReason,
          title: 'Acao indisponivel',
          tone: 'danger',
        });
        return;
      }

      void runAction(action.kind, item.id, item.itemName ?? item.itemType);
    },
    [runAction],
  );

  return (
    <InGameScreenLayout
      subtitle={INVENTORY_SCREEN_DESCRIPTION}
      title="Equipar"
    >
      <View style={styles.summaryRow}>
        <SummaryCard label="Slots ocupados" value={`${items.length}`} />
        <SummaryCard label="Equipados" value={`${equippedCount}`} />
        <SummaryCard label="Pedindo reparo" value={`${repairableCount}`} />
        <SummaryCard
          label="Caixa atual"
          value={formatCurrency(player?.resources.money ?? 0)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Grade de Itens</Text>
        <Text style={styles.sectionCopy}>{INVENTORY_EXPANSION_HINT}</Text>
        {items.length > 0 ? (
          <View style={styles.grid}>
            {items.map((item) => {
              const presentation = resolveInventoryItemPresentation(item, player?.level ?? 1);
              const benefits = buildInventoryBenefitLines(item);
              const isSelected = selectedItemId === item.id;
              const isSubmittingThisItem = submittingItemId === item.id;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.gridItemShell,
                    isSelected ? styles.gridItemShellSelected : null,
                    item.isEquipped ? styles.gridItemEquipped : null,
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      setSelectedItemId((current) => (current === item.id ? null : item.id));
                    }}
                    style={({ pressed }) => [
                      styles.gridItemPressable,
                      pressed ? styles.buttonPressed : null,
                    ]}
                  >
                    <View style={styles.gridItemTopRow}>
                      <Text style={styles.gridItemType}>{resolveInventoryItemTypeLabel(item)}</Text>
                      <StatusBadge
                        label={presentation.statusLabel}
                        tone={presentation.statusTone}
                      />
                    </View>
                    <Text style={styles.gridItemName}>{item.itemName ?? 'Item sem nome'}</Text>
                    <Text style={styles.gridItemMeta}>
                      Qtd {item.quantity} · {resolveDurabilityLabel(item)}
                    </Text>
                    <Text style={styles.expandHint}>
                      {isSelected ? 'Toque para recolher' : 'Toque para abrir ações'}
                    </Text>
                  </Pressable>

                  {isSelected ? (
                    <View style={styles.gridItemExpanded}>
                      <View style={styles.metricRow}>
                        <MetricPill label="Durabilidade" value={resolveDurabilityValue(item)} />
                        <MetricPill label="Proficiência" value={`${item.proficiency}`} />
                        <MetricPill
                          label="Nível"
                          value={item.levelRequired !== null ? `${item.levelRequired}` : 'Livre'}
                        />
                      </View>

                      {item.equipment?.slot === 'weapon' && typeof item.equipment.power === 'number' ? (
                        <View style={styles.metricRow}>
                          <MetricPill label="Poder" value={`+${item.equipment.power}`} />
                          <MetricPill label="Crime/Guerra" value={`+${item.equipment.power}`} />
                          <MetricPill label="Combate" value={`+${item.equipment.power}`} />
                        </View>
                      ) : null}

                      {item.equipment?.slot === 'vest' && typeof item.equipment.defense === 'number' ? (
                        <View style={styles.metricRow}>
                          <MetricPill label="Defesa" value={`+${item.equipment.defense}`} />
                          <MetricPill label="Crime/Guerra" value={`+${item.equipment.defense * 6}`} />
                          <MetricPill label="Combate" value={`+${item.equipment.defense}`} />
                        </View>
                      ) : null}

                      {benefits.length > 0 ? (
                        <View style={styles.benefitCard}>
                          <Text style={styles.benefitTitle}>Benefício real no jogo</Text>
                          {benefits.map((benefit) => (
                            <Text key={benefit} style={styles.benefitCopy}>
                              {benefit}
                            </Text>
                          ))}
                        </View>
                      ) : null}

                      {presentation.primaryAction?.disabledReason ? (
                        <Text style={styles.warningCopy}>{presentation.primaryAction.disabledReason}</Text>
                      ) : null}

                      <View style={styles.actionRow}>
                        {presentation.primaryAction ? (
                          <ActionButton
                            disabled={Boolean(presentation.primaryAction.disabledReason) || Boolean(submittingItemId)}
                            label={presentation.primaryAction.label}
                            onPress={() => {
                              handleActionPress(presentation.primaryAction!, item);
                            }}
                            tone={presentation.statusTone}
                          />
                        ) : null}

                        {presentation.secondaryAction ? (
                          <ActionButton
                            disabled={Boolean(submittingItemId)}
                            label={presentation.secondaryAction.label}
                            onPress={() => {
                              handleActionPress(presentation.secondaryAction!, item);
                            }}
                            tone="warning"
                          />
                        ) : null}

                        <ActionButton
                          disabled={Boolean(submittingItemId)}
                          label="Abrir mercado"
                          onPress={() => {
                            navigation.navigate('Market', {
                              initialTab:
                                item.itemType === 'weapon' || item.itemType === 'vest'
                                  ? 'repair'
                                  : 'sell',
                            });
                          }}
                          tone="muted"
                        />
                      </View>

                      {isSubmittingThisItem ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator color={colors.accent} />
                          <Text style={styles.loadingCopy}>Atualizando seu inventário...</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState copy="O personagem ainda nao possui itens. Crimes, mercado negro e drops vao alimentar esta tela." />
        )}
      </View>
      <InventoryResultModal
        message={resultState?.message ?? null}
        onClose={() => {
          setResultState(null);
        }}
        title={resultState?.title ?? 'Inventário atualizado'}
        tone={resultState?.tone ?? 'info'}
      />
    </InGameScreenLayout>
  );
}

function ActionButton(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone: InventoryStatusTone;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { borderColor: resolveToneColor(props.tone) },
        props.disabled ? styles.actionButtonDisabled : null,
        pressed && !props.disabled ? styles.buttonPressed : null,
      ]}
    >
      <Text style={[styles.actionButtonLabel, props.disabled ? styles.actionButtonLabelDisabled : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function MetricPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillValue}>{value}</Text>
      <Text style={styles.metricPillLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: InventoryStatusTone }): JSX.Element {
  return (
    <View style={[styles.statusBadge, { borderColor: resolveToneColor(tone) }]}>
      <Text style={[styles.statusBadgeLabel, { color: resolveToneColor(tone) }]}>{label}</Text>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

function InventoryResultModal(props: {
  message: string | null;
  onClose: () => void;
  title: string;
  tone: 'danger' | 'info';
}): JSX.Element {
  return (
    <Modal animationType="fade" transparent visible={Boolean(props.message)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, props.tone === 'danger' ? styles.modalCardDanger : styles.modalCardInfo]}>
          <Text style={styles.modalEyebrow}>
            {props.tone === 'danger' ? 'Ação bloqueada' : 'Ação concluída'}
          </Text>
          <Text style={styles.modalTitle}>{props.title}</Text>
          <Text style={styles.modalCopy}>{props.message}</Text>
          <Pressable
            onPress={props.onClose}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function resolveDurabilityLabel(item: {
  durability: number | null;
  maxDurability: number | null;
}): string {
  if (item.durability === null || item.maxDurability === null) {
    return 'sem desgaste';
  }

  return `${item.durability}/${item.maxDurability}`;
}

function resolveDurabilityValue(item: {
  durability: number | null;
  maxDurability: number | null;
}): string {
  if (item.durability === null || item.maxDurability === null) {
    return 'Estavel';
  }

  return `${item.durability}/${item.maxDurability}`;
}

function resolveToneColor(tone: InventoryStatusTone): string {
  switch (tone) {
    case 'danger':
      return colors.danger;
    case 'info':
      return colors.info;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'muted':
      return colors.muted;
    case 'accent':
      return colors.accent;
  }
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
    flex: 1,
    gap: 6,
    minWidth: '47%',
    padding: 14,
  },
  summaryValue: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItemShell: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: '47%',
    overflow: 'hidden',
  },
  gridItemShellSelected: {
    borderColor: colors.accent,
  },
  gridItemPressable: {
    gap: 6,
    padding: 14,
  },
  gridItemExpanded: {
    backgroundColor: colors.panelAlt,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 12,
    minWidth: '47%',
    padding: 14,
  },
  gridItemEquipped: {
    backgroundColor: colors.panelAlt,
  },
  gridItemTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  gridItemType: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gridItemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  gridItemMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  expandHint: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricPillValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  metricPillLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  benefitCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  benefitTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  benefitCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  warningCopy: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    backgroundColor: colors.panel,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonDisabled: {
    borderColor: colors.line,
    opacity: 0.55,
  },
  actionButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionButtonLabelDisabled: {
    color: colors.muted,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonLabel: {
    color: '#17120a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 8, 7, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 22,
    gap: 12,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  modalCardDanger: {
    backgroundColor: '#2a1719',
    borderColor: 'rgba(217, 108, 108, 0.35)',
    borderWidth: 1,
  },
  modalCardInfo: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderWidth: 1,
  },
  modalEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  emptyState: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
