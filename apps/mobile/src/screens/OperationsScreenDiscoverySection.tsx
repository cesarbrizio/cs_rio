import { Pressable, Text, View } from 'react-native';

import { SLOT_MACHINE_INSTALL_COST } from '@cs-rio/shared';

import { formatOperationsCurrency } from '../features/operations';
import { MetricPill, styles } from './OperationsScreen.parts';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenDiscoverySection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element | null {
  if (!controller.isSlotMachineDiscoveryActive && !controller.isPuteiroDiscoveryActive) {
    return null;
  }

  return (
    <>
      {controller.isSlotMachineDiscoveryActive ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radar da Maquininha</Text>
          <View style={styles.detailCard}>
            <Text style={styles.infoBlockCopy}>
              Maquininha é uma operação semi-passiva da sua base comercial. Você instala as
              máquinas, regula aposta mínima/máxima, margem da casa e jackpot, e depois coleta o
              caixa.
            </Text>
            <Text style={styles.infoBlockCopy}>
              Diferente do Jogo do Bicho, aqui não existe aposta manual do jogador: o foco é
              configurar a operação e rentabilizar o ponto.
            </Text>
            <View style={styles.metricRow}>
              <MetricPill
                label="Suas máquinas"
                value={`${controller.slotMachineAcquisition.ownedCount}`}
              />
              <MetricPill
                label="Preço base"
                value={
                  controller.slotMachineAcquisition.definition
                    ? formatOperationsCurrency(
                        controller.slotMachineAcquisition.definition.basePrice,
                      )
                    : '--'
                }
              />
              <MetricPill
                label="Instalação"
                value={formatOperationsCurrency(SLOT_MACHINE_INSTALL_COST)}
              />
              <MetricPill
                label="Unlock"
                value={`${controller.slotMachineAcquisition.definition?.unlockLevel ?? '--'}`}
              />
            </View>
            <View style={styles.metricRow}>
              <MetricPill
                label="Capacidade base"
                value={`${controller.slotMachineAcquisition.baseCapacity}`}
              />
              <MetricPill
                label="Ritmo inicial"
                value={formatOperationsCurrency(
                  controller.slotMachineAcquisition.estimatedHourlyRevenueAtBase,
                )}
              />
              <MetricPill
                label="Sala cheia"
                value={formatOperationsCurrency(
                  controller.slotMachineAcquisition.estimatedHourlyRevenueAtCapacity,
                )}
              />
              <MetricPill
                label="Defesa base"
                value={`${
                  controller.slotMachineAcquisition.definition?.baseProtectionScore ?? '--'
                }`}
              />
            </View>
            {!controller.slotMachineAcquisition.isOwned ? (
              <View style={styles.inlineManagementCard}>
                <Text style={styles.inlineManagementTitle}>Compra guiada</Text>
                <Text style={styles.inlineManagementCopy}>
                  O ponto entra direto na sua região atual
                  {controller.slotMachineAcquisition.currentRegionLabel
                    ? ` (${controller.slotMachineAcquisition.currentRegionLabel})`
                    : ''}
                  , com capacidade inicial para {controller.slotMachineAcquisition.baseCapacity}{' '}
                  máquinas e risco operacional moderado até você reforçar a proteção.
                </Text>
                <Text style={styles.inlineManagementCopy}>
                  Compra:{' '}
                  {controller.slotMachineAcquisition.definition
                    ? formatOperationsCurrency(
                        controller.slotMachineAcquisition.definition.basePrice,
                      )
                    : '--'}{' '}
                  · instalação por máquina {formatOperationsCurrency(SLOT_MACHINE_INSTALL_COST)}.
                </Text>
                <Text style={styles.inlineManagementCopy}>
                  Estimativa de giro:{' '}
                  {formatOperationsCurrency(
                    controller.slotMachineAcquisition.estimatedHourlyRevenueAtBase,
                  )}
                  /h com 1 máquina padrão ou{' '}
                  {formatOperationsCurrency(
                    controller.slotMachineAcquisition.estimatedHourlyRevenueAtCapacity,
                  )}
                  /h com a sala base lotada.
                </Text>
                <Text style={styles.infoBlockCopy}>
                  {controller.slotMachineAcquisition.blockerLabel ??
                    'Compra liberada. Depois da aquisição, o fluxo já cai em instalação e configuração.'}
                </Text>
                <Pressable
                  disabled={!controller.canPurchaseSlotMachine}
                  onPress={() => {
                    void controller.actions.handlePurchaseSlotMachine();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !controller.canPurchaseSlotMachine ? styles.buttonDisabled : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {controller.slotMachineAcquisition.canPurchase
                      ? 'Comprar maquininha'
                      : 'Compra indisponível'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {controller.isPuteiroDiscoveryActive ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radar do Puteiro</Text>
          <View style={styles.detailCard}>
            <Text style={styles.infoBlockCopy}>
              Puteiro é negócio operacional. O dinheiro gira pelo elenco ativo, pela manutenção em
              dia e pelo quanto você controla DST nas GPs, fugas e mortes dentro da casa.
            </Text>
            <Text style={styles.infoBlockCopy}>
              Não é ativo de base e não é mini-game. Você compra o ponto, contrata GPs, monitora
              risco sanitário e coleta o caixa da operação.
            </Text>
            <View style={styles.metricRow}>
              <MetricPill
                label="Seus puteiros"
                value={`${controller.puteiroAcquisition.ownedCount}`}
              />
              <MetricPill
                label="Preço base"
                value={
                  controller.puteiroAcquisition.definition
                    ? formatOperationsCurrency(
                        controller.puteiroAcquisition.definition.basePrice,
                      )
                    : '--'
                }
              />
              <MetricPill label="Capacidade" value={`${controller.puteiroAcquisition.capacity} GPs`} />
              <MetricPill
                label="Unlock"
                value={`${controller.puteiroAcquisition.definition?.unlockLevel ?? '--'}`}
              />
            </View>
            <View style={styles.metricRow}>
              <MetricPill
                label="Catálogo"
                value={`${controller.puteiroAcquisition.templatesCount} modelos`}
              />
              <MetricPill
                label="Entrada"
                value={
                  controller.puteiroAcquisition.entryTemplate
                    ? controller.puteiroAcquisition.entryTemplate.label
                    : '--'
                }
              />
              <MetricPill
                label="Custo inicial"
                value={
                  controller.puteiroAcquisition.entryTemplate
                    ? formatOperationsCurrency(
                        controller.puteiroAcquisition.entryTemplate.purchasePrice,
                      )
                    : '--'
                }
              />
              <MetricPill
                label="Ritmo base"
                value={formatOperationsCurrency(
                  controller.puteiroAcquisition.estimatedHourlyRevenueAtEntry,
                )}
              />
            </View>
            {!controller.puteiroAcquisition.isOwned ? (
              <View style={styles.inlineManagementCard}>
                <Text style={styles.inlineManagementTitle}>Compra guiada</Text>
                <Text style={styles.inlineManagementCopy}>
                  O ponto entra direto na sua região atual
                  {controller.puteiroAcquisition.currentRegionLabel
                    ? ` (${controller.puteiroAcquisition.currentRegionLabel})`
                    : ''}
                  . Depois da compra, o próximo passo é contratar o elenco para começar a girar
                  caixa.
                </Text>
                <Text style={styles.inlineManagementCopy}>
                  Compra:{' '}
                  {controller.puteiroAcquisition.definition
                    ? formatOperationsCurrency(
                        controller.puteiroAcquisition.definition.basePrice,
                      )
                    : '--'}{' '}
                  · primeira contratação sugerida:{' '}
                  {controller.puteiroAcquisition.entryTemplate
                    ? `${controller.puteiroAcquisition.entryTemplate.label} por ${formatOperationsCurrency(controller.puteiroAcquisition.entryTemplate.purchasePrice)}`
                    : '--'}
                  .
                </Text>
                <Text style={styles.inlineManagementCopy}>
                  Estimativa de giro:{' '}
                  {formatOperationsCurrency(
                    controller.puteiroAcquisition.estimatedHourlyRevenueAtEntry,
                  )}
                  /h para abrir o giro com 1 GP e até{' '}
                  {formatOperationsCurrency(
                    controller.puteiroAcquisition.estimatedHourlyRevenueAtCapacity,
                  )}
                  /h com a casa cheia no teto atual.
                </Text>
                <Text style={styles.infoBlockCopy}>
                  {controller.puteiroAcquisition.blockerLabel ??
                    'Compra liberada. Depois disso, a tela foca o ativo e abre o fluxo de contratação.'}
                </Text>
                <Pressable
                  disabled={!controller.canPurchasePuteiro}
                  onPress={() => {
                    void controller.actions.handlePurchasePuteiro();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !controller.canPurchasePuteiro ? styles.buttonDisabled : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {controller.puteiroAcquisition.canPurchase
                      ? 'Comprar puteiro'
                      : 'Compra indisponível'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );
}
