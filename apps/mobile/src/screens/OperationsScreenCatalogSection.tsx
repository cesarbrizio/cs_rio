import { Pressable, Text, View } from 'react-native';

import {
  formatOperationsCurrency,
  resolvePropertyAssetClassLabel,
  resolvePropertyStockLabel,
  resolvePropertyTypeLabel,
  resolvePropertyUtilityLines,
} from '../features/operations';
import { EmptyState, MetricPill, styles } from './OperationsScreen.parts';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenCatalogSection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Catálogo de compra</Text>
        <Text style={styles.sectionMeta}>{controller.filteredCatalogProperties.length} opções</Text>
      </View>
      {controller.filteredCatalogProperties.length > 0 ? (
        <View style={styles.cardList}>
          {controller.filteredCatalogProperties.map((definition) => {
            const canAfford =
              (controller.player?.resources.money ?? 0) >= definition.basePrice;
            const hasStock =
              definition.stockAvailable === null || definition.stockAvailable > 0;
            const isOwned = controller.allProperties.some(
              (property) => property.type === definition.type,
            );
            const canPurchase =
              !isOwned &&
              canAfford &&
              hasStock &&
              (controller.player?.level ?? 0) >= definition.unlockLevel &&
              !controller.isSubmitting &&
              Boolean(controller.player?.regionId);

            return (
              <View key={definition.type} style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailTitleWrap}>
                    <Text style={styles.detailTitle}>{definition.label}</Text>
                    <Text style={styles.detailCopy}>
                      {resolvePropertyTypeLabel(definition.type)} ·{' '}
                      {resolvePropertyAssetClassLabel(definition)}
                    </Text>
                  </View>
                  <Text style={styles.detailMeta}>
                    {formatOperationsCurrency(definition.basePrice)}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <MetricPill
                    label="Renda/dia"
                    value={formatOperationsCurrency(definition.baseDailyIncome)}
                  />
                  <MetricPill
                    label="Custo/dia"
                    value={formatOperationsCurrency(definition.baseDailyMaintenanceCost)}
                  />
                  <MetricPill
                    label="Estoque"
                    value={resolvePropertyStockLabel(definition)}
                  />
                  <MetricPill label="Unlock" value={`${definition.unlockLevel}`} />
                </View>
                <Text style={styles.infoBlockCopy}>
                  {resolvePropertyUtilityLines(definition).join(' · ')}
                </Text>
                {!canAfford ? (
                  <Text style={styles.infoBlockCopy}>Fundos insuficientes.</Text>
                ) : null}
                {isOwned ? (
                  <Text style={styles.infoBlockCopy}>Você já possui esse tipo de ativo.</Text>
                ) : null}
                {!hasStock ? (
                  <Text style={styles.infoBlockCopy}>Sem slot livre ou estoque restante.</Text>
                ) : null}
                <Pressable
                  disabled={!canPurchase}
                  onPress={() => {
                    void controller.actions.handlePurchaseDefinition(definition);
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canPurchase ? styles.buttonDisabled : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {canPurchase ? 'Comprar ativo' : 'Compra indisponível'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState copy="Nenhum ativo elegível no catálogo desta aba." />
      )}
    </View>
  );
}
