import { Pressable, Text, View } from 'react-native';

import {
  formatOperationsCurrency,
  formatPercent,
  resolvePropertyAssetClassLabel,
  resolvePropertyRegionLabel,
  resolvePropertyUtilityLines,
} from '../features/operations';
import { colors } from '../theme/colors';
import { formatDateLabel } from './operationsScreenSupport';
import { MetricCard, styles } from './OperationsScreen.parts';
import { OperationsScreenPuteiroSection } from './OperationsScreenPuteiroSection';
import { OperationsScreenSlotMachineSection } from './OperationsScreenSlotMachineSection';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenPropertyPanelSection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element | null {
  if (!controller.selectedProperty) {
    return null;
  }

  const property = controller.selectedProperty;
  const selectedOperation = controller.selectedOperation;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Painel do ativo</Text>
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <View style={styles.detailTitleWrap}>
            <Text style={styles.detailTitle}>{property.definition.label}</Text>
            <Text style={styles.detailCopy}>
              {resolvePropertyRegionLabel(property.regionId)}
              {property.favelaId ? ` · Favela ${property.favelaId}` : ''}
            </Text>
          </View>
          <Text style={styles.detailMeta}>
            Nível {property.level}/{property.definition.maxLevel}
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            label="Renda/dia"
            tone={colors.success}
            value={formatOperationsCurrency(property.economics.dailyIncome)}
          />
          <MetricCard
            label="Custo/dia"
            tone={colors.warning}
            value={formatOperationsCurrency(property.economics.dailyExpense)}
          />
          <MetricCard
            label="Risco de invasão"
            tone={colors.danger}
            value={`${property.protection.invasionRisk}%`}
          />
          <MetricCard
            label="Risco de roubo"
            tone={colors.warning}
            value={`${property.protection.robberyRisk}%`}
          />
          <MetricCard
            label="Risco de tomada"
            tone={colors.info}
            value={`${property.protection.takeoverRisk}%`}
          />
          <MetricCard
            label="Facção"
            tone={colors.accent}
            value={property.protection.factionProtectionActive ? 'Protegendo' : 'Sem proteção'}
          />
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoBlockTitle}>Proteção e manutenção</Text>
          <Text style={styles.infoBlockCopy}>
            Defesa {Math.round(property.protection.defenseScore)} · Tier territorial{' '}
            {property.protection.territoryTier} · Controle regional{' '}
            {formatPercent(property.protection.territoryControlRatio)}
          </Text>
          <Text style={styles.infoBlockCopy}>
            Última manutenção: {formatDateLabel(property.maintenanceStatus.lastMaintenanceAt)} ·
            Débito na sincronização{' '}
            {formatOperationsCurrency(property.maintenanceStatus.moneySpentOnSync)}
          </Text>
          <Text style={styles.infoBlockCopy}>
            Upkeep diário {formatOperationsCurrency(property.economics.totalDailyUpkeep)} · Em
            atraso {property.maintenanceStatus.overdueDays} dia(s)
          </Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoBlockTitle}>Perfil e utilidade</Text>
          <Text style={styles.infoBlockCopy}>
            Classe {resolvePropertyAssetClassLabel(property.definition)} ·{' '}
            {property.definition.profitable
              ? 'gera caixa quando operado'
              : 'não gera caixa direto; sustenta sua base'}
          </Text>
          <Text style={styles.infoBlockCopy}>
            {property.definition.profitable
              ? `Capacidade de soldados: ${property.definition.soldierCapacity} · comissão faccional ${formatPercent(property.economics.effectiveFactionCommissionRate)}`
              : `Capacidade de soldados: ${property.definition.soldierCapacity} · foco em logística, proteção e utilidade permanente`}
          </Text>
          <Text style={styles.infoBlockCopy}>
            Slot vinculado: {property.slotId ?? 'não mapeado'}
          </Text>
          {resolvePropertyUtilityLines(property.definition).map((line) => (
            <Text key={line} style={styles.infoBlockCopy}>
              {line}
            </Text>
          ))}
        </View>

        {selectedOperation ? (
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockTitle}>Operação</Text>
            <Text style={styles.infoBlockCopy}>
              {selectedOperation.statusLabel} · Pronto: {selectedOperation.collectableLabel}
            </Text>
            <Text style={styles.infoBlockCopy}>
              Ritmo estimado: {selectedOperation.estimatedHourlyLabel} · Comissão faccional{' '}
              {formatPercent(property.economics.effectiveFactionCommissionRate)}
            </Text>
            {selectedOperation.detailLines.map((line) => (
              <Text key={line} style={styles.infoBlockCopy}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        <OperationsScreenPuteiroSection controller={controller} />
        <OperationsScreenSlotMachineSection controller={controller} />

        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => {
              void controller.actions.handleRefresh();
            }}
            style={({ pressed }) => [
              styles.secondaryButtonWide,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonLabel}>Sincronizar manutenção</Text>
          </Pressable>
          <Pressable
            disabled={!controller.canUpgrade}
            onPress={() => {
              void controller.actions.handleUpgrade();
            }}
            style={({ pressed }) => [
              styles.secondaryButtonWide,
              !controller.canUpgrade ? styles.buttonDisabled : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonLabel}>
              {property.level >= property.definition.maxLevel ? 'Nível máximo' : 'Melhorar ativo'}
            </Text>
          </Pressable>
          <Pressable
            disabled={!controller.canCollect}
            onPress={() => {
              void controller.actions.handleCollect();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              !controller.canCollect ? styles.buttonDisabled : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>
              {selectedOperation?.actionLabel ?? 'Sem coleta'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
