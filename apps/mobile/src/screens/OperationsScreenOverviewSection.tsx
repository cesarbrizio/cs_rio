import { Pressable, Text, View } from 'react-native';

import {
  formatOperationsCurrency,
  resolveOperationsTabDescription,
  resolveOperationsTabLabel,
} from '../features/operations';
import { colors } from '../theme/colors';
import { Banner, SummaryCard, styles } from './OperationsScreen.parts';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenOverviewSection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element {
  return (
    <>
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Operações"
          tone={colors.accent}
          value={`${controller.summary.businessCount}`}
        />
        <SummaryCard
          label="Base"
          tone={colors.info}
          value={`${controller.summary.patrimonyCount}`}
        />
        <SummaryCard
          label="Custo/dia"
          tone={colors.success}
          value={formatOperationsCurrency(controller.summary.dailyUpkeep)}
        />
        <SummaryCard
          label="Caixa pronto"
          tone={colors.warning}
          value={formatOperationsCurrency(controller.summary.cashReady)}
        />
        <SummaryCard
          label="Coletas"
          tone={colors.accent}
          value={`${controller.summary.readyOperations}`}
        />
        <SummaryCard
          label="Alertas"
          tone={colors.danger}
          value={`${controller.summary.alerts}`}
        />
      </View>

      <View style={styles.tabRow}>
        {(['business', 'patrimony'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              controller.setActiveTab(tab);
              controller.setSelectedPropertyId(null);
            }}
            style={({ pressed }) => [
              styles.tabButton,
              controller.activeTab === tab ? styles.tabButtonSelected : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.tabButtonLabel}>{resolveOperationsTabLabel(tab)}</Text>
            <Text style={styles.tabButtonCopy}>{resolveOperationsTabDescription(tab)}</Text>
          </Pressable>
        ))}
      </View>

      {controller.error ? <Banner copy={controller.error} tone="danger" /> : null}
      {controller.feedback ? <Banner copy={controller.feedback} tone="neutral" /> : null}
    </>
  );
}
