import { SLOT_MACHINE_INSTALL_COST } from '@cs-rio/shared';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatOperationsCurrency, formatPercent } from '../features/operations';
import { colors } from '../theme/colors';
import { sanitizeDecimalInput } from './operationsScreenSupport';
import { MetricPill, styles } from './OperationsScreen.parts';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenSlotMachineSection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element | null {
  if (
    controller.selectedProperty?.type !== 'slot_machine' ||
    !controller.selectedSlotMachine
  ) {
    return null;
  }

  const slotMachine = controller.selectedSlotMachine;

  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoBlockTitle}>Mesa da maquininha</Text>
      <Text style={styles.infoBlockCopy}>
        Operação semi-passiva da sua base comercial. Ajuste a casa, a faixa de aposta e o jackpot
        para puxar tráfego, depois colete o caixa.
      </Text>
      <View style={styles.metricRow}>
        <MetricPill
          label="Instaladas"
          value={`${slotMachine.economics.installedMachines}/${slotMachine.economics.capacity}`}
        />
        <MetricPill
          label="Faixa"
          value={`${formatOperationsCurrency(slotMachine.config.minBet)} → ${formatOperationsCurrency(slotMachine.config.maxBet)}`}
        />
        <MetricPill label="Casa" value={formatPercent(slotMachine.config.houseEdge)} />
        <MetricPill label="Jackpot" value={formatPercent(slotMachine.config.jackpotChance)} />
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          disabled={!controller.canInstallSlotMachine}
          onPress={() => {
            controller.setSlotMachineActionMode(
              controller.slotMachineActionMode === 'install' ? null : 'install',
            );
          }}
          style={({ pressed }) => [
            styles.secondaryButtonWide,
            !controller.canInstallSlotMachine ? styles.buttonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>Instalar</Text>
        </Pressable>
        <Pressable
          disabled={!controller.canConfigureSlotMachine}
          onPress={() => {
            controller.setSlotMachineActionMode(
              controller.slotMachineActionMode === 'configure' ? null : 'configure',
            );
          }}
          style={({ pressed }) => [
            styles.secondaryButtonWide,
            !controller.canConfigureSlotMachine ? styles.buttonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>Configurar</Text>
        </Pressable>
      </View>

      {controller.slotMachineActionMode === 'install' ? (
        <View style={styles.inlineManagementCard}>
          <Text style={styles.inlineManagementTitle}>Instalar novas máquinas</Text>
          <Text style={styles.inlineManagementCopy}>
            Cada unidade custa {formatOperationsCurrency(SLOT_MACHINE_INSTALL_COST)} e ocupa a
            capacidade do ativo.
          </Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => {
              controller.setSlotMachineInstallQuantityInput(value.replace(/[^0-9]/g, ''));
            }}
            placeholder="1"
            placeholderTextColor={colors.muted}
            style={styles.numericInput}
            value={controller.slotMachineInstallQuantityInput}
          />
          <Pressable
            disabled={!controller.canInstallSlotMachine}
            onPress={() => {
              void controller.actions.handleInstallSlotMachines();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              !controller.canInstallSlotMachine ? styles.buttonDisabled : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>Confirmar instalação</Text>
          </Pressable>
        </View>
      ) : null}

      {controller.slotMachineActionMode === 'configure' ? (
        <View style={styles.inlineManagementCard}>
          <Text style={styles.inlineManagementTitle}>Configurar operação</Text>
          <Text style={styles.inlineManagementCopy}>
            Ajuste o equilíbrio entre margem da casa, jackpot e faixa de aposta para definir o
            perfil do ponto.
          </Text>
          <View style={styles.metricRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Casa (%)</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  controller.setSlotMachineHouseEdgeInput(sanitizeDecimalInput(value));
                }}
                placeholder="22"
                placeholderTextColor={colors.muted}
                style={styles.numericInput}
                value={controller.slotMachineHouseEdgeInput}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Jackpot (%)</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  controller.setSlotMachineJackpotInput(sanitizeDecimalInput(value));
                }}
                placeholder="1"
                placeholderTextColor={colors.muted}
                style={styles.numericInput}
                value={controller.slotMachineJackpotInput}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Aposta mín.</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => {
                  controller.setSlotMachineMinBetInput(value.replace(/[^0-9]/g, ''));
                }}
                placeholder="100"
                placeholderTextColor={colors.muted}
                style={styles.numericInput}
                value={controller.slotMachineMinBetInput}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Aposta máx.</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => {
                  controller.setSlotMachineMaxBetInput(value.replace(/[^0-9]/g, ''));
                }}
                placeholder="1000"
                placeholderTextColor={colors.muted}
                style={styles.numericInput}
                value={controller.slotMachineMaxBetInput}
              />
            </View>
          </View>
          <Pressable
            disabled={!controller.canConfigureSlotMachine}
            onPress={() => {
              void controller.actions.handleConfigureSlotMachine();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              !controller.canConfigureSlotMachine ? styles.buttonDisabled : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>Salvar configuração</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
