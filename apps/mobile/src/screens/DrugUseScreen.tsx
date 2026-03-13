import { useFocusEffect } from '@react-navigation/native';
import { type DrugConsumeResponse } from '@cs-rio/shared';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildDrugUseWarnings,
  filterConsumableDrugItems,
  formatRemainingSeconds,
  formatToleranceMultiplier,
  resolveDrugCatalogEntry,
  resolveDrugRiskLevel,
  resolveDrugVenue,
  type DrugVenue,
} from '../features/drugs';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

type DrugUseScreenProps = NativeStackScreenProps<RootStackParamList, 'DrugUse'>;

export function DrugUseScreen({ route }: DrugUseScreenProps): JSX.Element {
  const consumeDrugInventoryItem = useAuthStore((state) => state.consumeDrugInventoryItem);
  const isLoading = useAuthStore((state) => state.isLoading);
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [venue, setVenue] = useState<DrugVenue>(route.params?.initialVenue ?? 'rave');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(
    route.params?.initialInventoryItemId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DrugConsumeResponse | null>(null);
  const drugItems = useMemo(
    () => filterConsumableDrugItems(player?.inventory ?? []),
    [player?.inventory],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshPlayerProfile();
    }, [refreshPlayerProfile]),
  );

  useEffect(() => {
    if (route.params?.initialVenue) {
      setVenue(route.params.initialVenue);
    }

    if (route.params?.initialInventoryItemId) {
      setSelectedInventoryItemId(route.params.initialInventoryItemId);
    }
  }, [route.params?.initialInventoryItemId, route.params?.initialVenue]);

  const selectedDrug = useMemo(
    () =>
      drugItems.find((item) => item.id === selectedInventoryItemId) ??
      drugItems[0] ??
      null,
    [drugItems, selectedInventoryItemId],
  );
  const selectedDrugDefinition = useMemo(
    () => resolveDrugCatalogEntry(selectedDrug),
    [selectedDrug],
  );
  const venueDefinition = useMemo(() => resolveDrugVenue(venue), [venue]);
  const warnings = useMemo(
    () => buildDrugUseWarnings(player, selectedDrugDefinition),
    [player, selectedDrugDefinition],
  );
  const risk = useMemo(
    () => resolveDrugRiskLevel(player, selectedDrugDefinition),
    [player, selectedDrugDefinition],
  );

  useEffect(() => {
    if (!selectedDrug && drugItems.length > 0) {
      setSelectedInventoryItemId(drugItems[0]?.id ?? null);
      return;
    }

    if (selectedDrug && selectedDrug.id !== selectedInventoryItemId) {
      setSelectedInventoryItemId(selectedDrug.id);
      return;
    }

    if (drugItems.length === 0) {
      setSelectedInventoryItemId(null);
    }
  }, [drugItems, selectedDrug, selectedInventoryItemId]);

  const handleConsume = useCallback(async () => {
    if (!selectedDrug) {
      setError('Selecione uma droga para consumir.');
      return;
    }

    setError(null);

    try {
      const response = await consumeDrugInventoryItem(selectedDrug.id);
      setResult(response);
      setBootstrapStatus(
        response.overdose
          ? `Overdose em ${venueDefinition.label}: internado por ${formatRemainingSeconds(
              response.overdose.hospitalization.remainingSeconds,
            )}.`
          : `${response.drug.name} consumida em ${venueDefinition.label}. Moral +${response.effects.moraleRecovered}.`,
      );
      const nextDrugItems = filterConsumableDrugItems(response.player.inventory);
      setSelectedInventoryItemId((currentId) =>
        nextDrugItems.some((item) => item.id === currentId) ? currentId : nextDrugItems[0]?.id ?? null,
      );
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : 'Falha ao consumir droga.';
      setError(nextMessage);
    }
  }, [consumeDrugInventoryItem, selectedDrug, setBootstrapStatus, venueDefinition.label]);

  const consumeButtonDisabled =
    !selectedDrug || player?.hospitalization.isHospitalized || isLoading;

  return (
    <InGameScreenLayout
      subtitle="Tela dedicada para rave e baile, com seletor de droga, preview de efeitos e aviso de overdose antes do consumo real."
      title="Rave / Baile"
    >
      <View style={styles.summaryRow}>
        <SummaryCard label="Moral" value={`${player?.resources.morale ?? '--'}`} tone={colors.accent} />
        <SummaryCard label="Stamina" value={`${player?.resources.stamina ?? '--'}`} tone={colors.success} />
        <SummaryCard label="Vício" value={`${player?.resources.addiction ?? '--'}`} tone={colors.warning} />
        <SummaryCard
          label="Internação"
          value={
            player?.hospitalization.isHospitalized
              ? formatRemainingSeconds(player.hospitalization.remainingSeconds)
              : 'Livre'
          }
          tone={player?.hospitalization.isHospitalized ? colors.danger : colors.info}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ambiente</Text>
        <View style={styles.venueRow}>
          {(['rave', 'baile'] as const).map((venueOption) => {
            const definition = resolveDrugVenue(venueOption);
            const isSelected = venueOption === venue;

            return (
              <Pressable
                key={venueOption}
                onPress={() => {
                  setVenue(venueOption);
                }}
                style={({ pressed }) => [
                  styles.venueCard,
                  isSelected ? styles.venueCardSelected : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.venueEyebrow}>{definition.maxDrugsLabel}</Text>
                <Text style={styles.venueTitle}>{definition.label}</Text>
                <Text style={styles.venueCopy}>{definition.description}</Text>
                <Text style={styles.venueFoot}>{definition.crowdLabel}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Banner copy={error} tone="danger" /> : null}

      {player?.hospitalization.isHospitalized ? (
        <Banner
          copy={`Consumo bloqueado até o fim da internação. Restam ${formatRemainingSeconds(
            player.hospitalization.remainingSeconds,
          )}.`}
          tone="danger"
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cardápio disponível</Text>
        {drugItems.length > 0 ? (
          <View style={styles.drugList}>
            {drugItems.map((item) => {
              const definition = resolveDrugCatalogEntry(item);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setSelectedInventoryItemId(item.id);
                  }}
                  style={({ pressed }) => [
                    styles.drugCard,
                    selectedDrug?.id === item.id ? styles.drugCardSelected : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.drugCardType}>
                    {definition?.type ?? item.itemType} · qtd {item.quantity}
                  </Text>
                  <Text style={styles.drugCardTitle}>{item.itemName ?? 'Droga sem nome'}</Text>
                  <Text style={styles.drugCardMeta}>
                    +{definition?.staminaRecovery ?? 0} STA · +{definition?.moraleBoost ?? 0} MOR · +
                    {definition?.nerveBoost ?? 0} NRV
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState copy="Seu inventário não tem drogas disponíveis. Use crimes, fábricas ou mercado para abastecer a tela." />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prévia da dose</Text>
        {selectedDrug && selectedDrugDefinition ? (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewCopy}>
                <Text style={styles.previewEyebrow}>{venueDefinition.label}</Text>
                <Text style={styles.previewTitle}>{selectedDrug.itemName}</Text>
                <Text style={styles.previewDescription}>
                  {selectedDrugDefinition.estimatedUnitPrice} · risco {resolveRiskLabel(risk.level)}
                </Text>
              </View>
              <View style={[styles.riskChip, resolveRiskChipStyle(risk.level)]}>
                <Text style={styles.riskChipLabel}>{resolveRiskLabel(risk.level)}</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <InfoPill label="Estamina" value={`+${selectedDrugDefinition.staminaRecovery}`} />
              <InfoPill label="Moral" value={`+${selectedDrugDefinition.moraleBoost}`} />
              <InfoPill label="Nervos" value={`+${selectedDrugDefinition.nerveBoost}`} />
              <InfoPill label="Vício" value={`+${selectedDrugDefinition.addictionRate}`} />
            </View>

            <Text style={styles.riskCopy}>{risk.copy}</Text>

            <View style={styles.warningList}>
              {warnings.map((warning) => (
                <Text key={warning} style={styles.warningItem}>
                  • {warning}
                </Text>
              ))}
            </View>

            <Pressable
              disabled={consumeButtonDisabled}
              onPress={() => {
                void handleConsume();
              }}
              style={({ pressed }) => [
                styles.consumeButton,
                consumeButtonDisabled ? styles.consumeButtonDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.consumeButtonLabel}>
                {isLoading ? 'Consumindo...' : `Consumir em ${venueDefinition.label}`}
              </Text>
            </Pressable>
          </View>
        ) : (
          <EmptyState copy="Selecione uma droga do cardápio para ver efeitos, risco e o aviso de overdose." />
        )}
      </View>

      {result ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Último consumo</Text>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{result.drug.name} aplicada com sucesso</Text>
            <Text style={styles.resultCopy}>
              Efeitos: +{result.effects.staminaRecovered} STA · +{result.effects.moraleRecovered} MOR · +
              {result.effects.nerveRecovered} NRV · vício +{result.effects.addictionGained}
            </Text>
            <Text style={styles.resultCopy}>
              Tolerancia atual: {result.tolerance.current} · eficiencia{' '}
              {formatToleranceMultiplier(result.tolerance.effectivenessMultiplier)}
            </Text>

            {result.overdose ? (
              <View style={styles.overdoseCard}>
                <Text style={styles.overdoseTitle}>Overdose detectada</Text>
                <Text style={styles.overdoseCopy}>
                  Gatilho: {result.overdose.trigger} · internação por{' '}
                  {formatRemainingSeconds(result.overdose.hospitalization.remainingSeconds)}
                </Text>
                <Text style={styles.overdoseCopy}>
                  Conceito perdido: {result.overdose.penalties.conceitoLost} · contatos perdidos:{' '}
                  {result.overdose.knownContactsLost}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
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

function InfoPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillLabel}>{label}</Text>
      <Text style={styles.infoPillValue}>{value}</Text>
    </View>
  );
}

function Banner({
  copy,
  tone,
}: {
  copy: string;
  tone: 'danger' | 'neutral';
}): JSX.Element {
  return (
    <View
      style={[
        styles.banner,
        tone === 'danger' ? styles.bannerDanger : styles.bannerNeutral,
      ]}
    >
      <Text style={styles.bannerCopy}>{copy}</Text>
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

function resolveRiskChipStyle(level: 'blocked' | 'high' | 'medium' | 'low') {
  if (level === 'blocked' || level === 'high') {
    return styles.riskChipDanger;
  }

  if (level === 'medium') {
    return styles.riskChipWarning;
  }

  return styles.riskChipSafe;
}

function resolveRiskLabel(level: 'blocked' | 'high' | 'medium' | 'low'): string {
  if (level === 'blocked') {
    return 'Bloqueado';
  }

  if (level === 'high') {
    return 'Risco alto';
  }

  if (level === 'medium') {
    return 'Risco medio';
  }

  return 'Risco baixo';
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
    flexBasis: '47%',
    gap: 6,
    padding: 14,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  venueRow: {
    gap: 10,
  },
  venueCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  venueCardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#272016',
  },
  venueEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  venueTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  venueCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  venueFoot: {
    color: colors.text,
    fontSize: 12,
    opacity: 0.84,
  },
  banner: {
    borderRadius: 16,
    padding: 14,
  },
  bannerDanger: {
    backgroundColor: '#351a1a',
    borderColor: '#5f2d2d',
    borderWidth: 1,
  },
  bannerNeutral: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  drugList: {
    gap: 10,
  },
  drugCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  drugCardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#221c14',
  },
  drugCardType: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  drugCardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  drugCardMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  previewCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 22,
    gap: 12,
    padding: 16,
  },
  previewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  previewEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  previewTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  previewDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  riskChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  riskChipDanger: {
    backgroundColor: '#5d2626',
  },
  riskChipWarning: {
    backgroundColor: '#5d4318',
  },
  riskChipSafe: {
    backgroundColor: '#1d4325',
  },
  riskChipLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoPill: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoPillLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoPillValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  riskCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  warningList: {
    gap: 6,
  },
  warningItem: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  consumeButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  consumeButtonDisabled: {
    opacity: 0.45,
  },
  consumeButtonLabel: {
    color: '#1b150c',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  resultCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  resultCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  overdoseCard: {
    backgroundColor: '#341c1c',
    borderRadius: 16,
    gap: 4,
    marginTop: 4,
    padding: 14,
  },
  overdoseTitle: {
    color: colors.warning,
    fontSize: 15,
    fontWeight: '800',
  },
  overdoseCopy: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
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
