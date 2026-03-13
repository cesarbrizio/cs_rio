import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type RootStackParamList } from '../../App';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function InventoryScreen(): JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = useAuthStore((state) => state.player);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const items = useMemo(() => player?.inventory ?? [], [player?.inventory]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id ?? null);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  return (
    <InGameScreenLayout
      subtitle="Grade de itens, detalhes do slot selecionado e ações rápidas para equipar, usar, vender ou descartar."
      title="Inventário"
    >
      <View style={styles.summaryRow}>
        <SummaryCard label="Slots ocupados" value={`${items.length}`} />
        <SummaryCard
          label="Equipamentos"
          value={`${items.filter((item) => item.itemType === 'weapon' || item.itemType === 'vest').length}`}
        />
        <SummaryCard
          label="Consumiveis"
          value={`${items.filter((item) => item.itemType === 'drug').length}`}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Grade de Itens</Text>
        {items.length > 0 ? (
          <View style={styles.grid}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSelectedItemId(item.id);
                }}
                style={({ pressed }) => [
                  styles.gridItem,
                  selectedItem?.id === item.id ? styles.gridItemSelected : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.gridItemType}>{item.itemType}</Text>
                <Text style={styles.gridItemName}>{item.itemName ?? 'Item sem nome'}</Text>
                <Text style={styles.gridItemMeta}>Qtd {item.quantity}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState copy="O personagem ainda não possui itens. Crimes, mercado negro e drops vão alimentar esta tela nas próximas fases." />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes do Item</Text>
        {selectedItem ? (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{selectedItem.itemName ?? 'Item sem nome'}</Text>
            <Text style={styles.detailCopy}>Tipo: {selectedItem.itemType}</Text>
            <Text style={styles.detailCopy}>Quantidade: {selectedItem.quantity}</Text>
            <Text style={styles.detailCopy}>
              Durabilidade: {selectedItem.durability ?? '--'} · Proficiência: {selectedItem.proficiency}
            </Text>

            <View style={styles.actionRow}>
              {[
                { id: 'equip', label: 'Equipar' },
                { id: 'use', label: 'Usar' },
                { id: 'sell', label: 'Vender' },
                { id: 'discard', label: 'Descartar' },
              ].map((action) => (
                <Pressable
                  key={action.id}
                  onPress={() => {
                    if (action.id === 'use' && selectedItem.itemType === 'drug') {
                      navigation.navigate('DrugUse', {
                        initialInventoryItemId: selectedItem.id,
                        initialVenue: 'rave',
                      });
                      return;
                    }

                    setBootstrapStatus(`${action.label}: ${selectedItem.itemName ?? selectedItem.itemType}`);
                  }}
                  style={({ pressed }) => [styles.actionButton, pressed ? styles.buttonPressed : null]}
                >
                  <Text style={styles.actionButtonLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <EmptyState copy="Selecione um slot para ver atributos, durabilidade, proficiência e ações disponíveis." />
        )}
      </View>
    </InGameScreenLayout>
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

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: '47%',
    padding: 14,
  },
  gridItemSelected: {
    borderColor: colors.accent,
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
  detailCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  detailCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  actionButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
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
