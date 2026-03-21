import { Pressable, Text, View } from 'react-native';

import {
  formatOperationsCurrency,
  resolvePropertyAssetClassLabel,
  resolvePropertyOperationSnapshot,
  resolvePropertyRegionLabel,
  resolvePropertyTypeLabel,
  resolvePropertyUtilityLines,
} from '../features/operations';
import { EmptyState, MetricPill, styles } from './OperationsScreen.parts';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenPortfolioSection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {controller.activeTab === 'business'
            ? 'Operações em carteira'
            : 'Base e logística do personagem'}
        </Text>
        <Pressable
          onPress={() => {
            void controller.actions.handleRefresh();
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>
            {controller.isLoading ? 'Sincronizando...' : 'Atualizar'}
          </Text>
        </Pressable>
      </View>

      {controller.filteredProperties.length > 0 ? (
        <View style={styles.cardList}>
          {controller.filteredProperties.map((property) => {
            const operation = controller.dashboard
              ? resolvePropertyOperationSnapshot(property, controller.dashboard)
              : null;
            const isSelected = property.id === controller.selectedProperty?.id;

            return (
              <Pressable
                key={property.id}
                onPress={() => {
                  controller.setSelectedPropertyId(property.id);
                }}
                style={({ pressed }) => [
                  styles.propertyCard,
                  isSelected ? styles.propertyCardSelected : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <View style={styles.propertyCardHeader}>
                  <View style={styles.propertyCardTitleWrap}>
                    <Text style={styles.propertyCardTitle}>{property.definition.label}</Text>
                    <Text style={styles.propertyCardMeta}>
                      {resolvePropertyRegionLabel(property.regionId)} ·{' '}
                      {resolvePropertyTypeLabel(property.type)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      property.status === 'maintenance_blocked'
                        ? styles.statusBadgeDanger
                        : styles.statusBadgeAccent,
                    ]}
                  >
                    <Text style={styles.statusBadgeLabel}>
                      {property.status === 'maintenance_blocked' ? 'Travado' : 'Ativo'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <MetricPill
                    label="Tipo"
                    value={resolvePropertyAssetClassLabel(property.definition)}
                  />
                  <MetricPill
                    label="Renda/dia"
                    value={formatOperationsCurrency(property.economics.dailyIncome)}
                  />
                  <MetricPill
                    label="Custo/dia"
                    value={formatOperationsCurrency(property.economics.totalDailyUpkeep)}
                  />
                </View>

                {property.type === 'puteiro' ? (
                  <Text style={styles.propertyCardCopy}>
                    {controller.selectedPuteiro?.id === property.id &&
                    controller.puteiroDashboardSnapshot
                      ? `${controller.puteiroDashboardSnapshot.operatingHeadline} Caixa ${formatOperationsCurrency(controller.selectedPuteiro.cashbox.availableToCollect)}.`
                      : `${operation?.statusLabel ?? 'Operação'} · negócio de elenco, risco sanitário e caixa.`}
                  </Text>
                ) : operation ? (
                  <Text style={styles.propertyCardCopy}>
                    {operation.statusLabel} · {operation.collectableLabel} prontos
                  </Text>
                ) : (
                  <Text style={styles.propertyCardCopy}>
                    {resolvePropertyUtilityLines(property.definition)[0] ??
                      'Ativo de base sem renda direta, voltado a mobilidade, proteção ou expansão do personagem.'}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState
          copy={
            controller.activeTab === 'business'
              ? controller.showSlotMachineOffer || controller.showPuteiroOffer
                ? 'Nenhum negócio ativo ainda. Use os radares acima para comprar um ativo operacional, abrir a operação e começar a girar caixa.'
                : 'Nenhum negócio ativo ainda. Compre ou provisione um ativo operacional para ver caixa e coleta.'
              : 'Nenhuma base comprada ainda. Imóveis, veículos e luxo entram aqui para ampliar mobilidade, slots, recuperação e proteção.'
          }
        />
      )}
    </View>
  );
}
