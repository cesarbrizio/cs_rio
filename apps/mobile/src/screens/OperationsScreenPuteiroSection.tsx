import { Pressable, Text, View } from 'react-native';

import {
  formatOperationsCurrency,
  formatPercent,
  resolvePuteiroWorkerStatusLabel,
} from '../features/operations';
import { MetricPill, styles } from './OperationsScreen.parts';
import type { OperationsScreenController } from './useOperationsScreenController';

export function OperationsScreenPuteiroSection({
  controller,
}: {
  controller: OperationsScreenController;
}): JSX.Element | null {
  if (
    controller.selectedProperty?.type !== 'puteiro' ||
    !controller.selectedPuteiro ||
    !controller.puteiroDashboardSnapshot
  ) {
    return null;
  }

  const puteiro = controller.selectedPuteiro;

  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoBlockTitle}>Casa e elenco</Text>
      <Text style={styles.infoBlockCopy}>
        {controller.puteiroDashboardSnapshot.operatingHeadline}
      </Text>
      <Text style={styles.infoBlockCopy}>{controller.puteiroDashboardSnapshot.nextStepCopy}</Text>
      <View style={styles.metricRow}>
        <MetricPill
          label="Ativas"
          value={`${puteiro.economics.activeGps}/${puteiro.economics.capacity}`}
        />
        <MetricPill label="Vagas" value={`${puteiro.economics.availableSlots}`} />
        <MetricPill
          label="Caixa"
          value={formatOperationsCurrency(puteiro.cashbox.availableToCollect)}
        />
        <MetricPill
          label="Receita/h"
          value={formatOperationsCurrency(puteiro.economics.estimatedHourlyGrossRevenue)}
        />
      </View>
      <View style={styles.metricRow}>
        <MetricPill
          label="Comissão"
          value={formatPercent(puteiro.economics.effectiveFactionCommissionRate)}
        />
        <MetricPill
          label="Carisma"
          value={`x${puteiro.economics.charismaMultiplier.toFixed(2)}`}
        />
        <MetricPill
          label="Local"
          value={`x${puteiro.economics.locationMultiplier.toFixed(2)}`}
        />
        <MetricPill label="Ciclo" value={`${puteiro.economics.cycleMinutes} min`} />
      </View>
      <Text style={styles.infoBlockCopy}>
        {controller.puteiroDashboardSnapshot.workerStatusSummary}
      </Text>
      <Text style={styles.infoBlockCopy}>{controller.puteiroDashboardSnapshot.incidentSummary}</Text>

      {puteiro.roster.length > 0 ? (
        <View style={styles.cardList}>
          {puteiro.roster.map((worker) => (
            <View key={worker.id} style={styles.rosterCard}>
              <Text style={styles.rosterTitle}>
                {worker.label} · {resolvePuteiroWorkerStatusLabel(worker)}
              </Text>
              <Text style={styles.rosterCopy}>
                Receita/h {formatOperationsCurrency(worker.hourlyGrossRevenueEstimate)} · compra{' '}
                {formatOperationsCurrency(worker.purchasePrice)} · recuperação{' '}
                {Math.round(worker.cansacoRestorePercent * 100)}%
              </Text>
              <Text style={styles.rosterCopy}>
                Risco ciclo: DST {formatPercent(worker.incidentRisk.dstChancePerCycle)} · fuga{' '}
                {formatPercent(worker.incidentRisk.escapeChancePerCycle)} · morte{' '}
                {formatPercent(worker.incidentRisk.deathChancePerCycle)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.infoBlockCopy}>
          Nenhuma GP ativa. Sem elenco, o caixa do puteiro não gira.
        </Text>
      )}

      <View style={styles.inlineManagementCard}>
        <Text style={styles.inlineManagementTitle}>Contratação de GPs</Text>
        <Text style={styles.inlineManagementCopy}>
          Escolha o perfil do elenco, a quantidade e feche a compra direto aqui. O risco sanitário
          e operacional acompanha a qualidade e a lotação da casa, sempre restrito às GPs.
        </Text>

        {(controller.dashboard?.puteiroBook.templates ?? []).length > 0 ? (
          <>
            <View style={styles.choiceRow}>
              {(controller.dashboard?.puteiroBook.templates ?? []).map((template) => (
                <Pressable
                  key={template.type}
                  onPress={() => {
                    controller.setSelectedGpType(template.type);
                  }}
                  style={({ pressed }) => [
                    styles.choiceChip,
                    controller.selectedGpTemplate?.type === template.type
                      ? styles.choiceChipSelected
                      : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text style={styles.choiceChipTitle}>{template.label}</Text>
                  <Text style={styles.choiceChipCopy}>
                    Compra {formatOperationsCurrency(template.purchasePrice)} · base/dia{' '}
                    {formatOperationsCurrency(template.baseDailyRevenue)}
                  </Text>
                  <Text style={styles.choiceChipCopy}>
                    Recuperação {Math.round(template.cansacoRestorePercent * 100)}% · giro/h{' '}
                    {formatOperationsCurrency(template.baseDailyRevenue / 24)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.quantityRow}>
              {[1, 3, 5].map((quantity) => {
                const quantityDisabled = quantity > (puteiro.economics.availableSlots || 0);

                return (
                  <Pressable
                    disabled={quantityDisabled}
                    key={quantity}
                    onPress={() => {
                      controller.setGpHireQuantity(quantity as 1 | 3 | 5);
                    }}
                    style={({ pressed }) => [
                      styles.quantityChip,
                      controller.gpHireQuantity === quantity
                        ? styles.quantityChipSelected
                        : null,
                      quantityDisabled ? styles.buttonDisabled : null,
                      pressed && !quantityDisabled ? styles.buttonPressed : null,
                    ]}
                  >
                    <Text style={styles.quantityChipLabel}>{quantity}x</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.infoBlockCopy}>
              {puteiro.economics.availableSlots > 0
                ? `Cabem mais ${puteiro.economics.availableSlots} GP(s) nessa casa.`
                : 'Lotação máxima atingida. O próximo foco é coleta, manutenção e controle de incidentes.'}
            </Text>

            <Pressable
              disabled={!controller.canHireGps}
              onPress={() => {
                void controller.actions.handleHireGps();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                !controller.canHireGps ? styles.buttonDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>
                Contratar {controller.gpHireQuantity}x {controller.selectedGpTemplate?.label ?? 'GP'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.infoBlockCopy}>
            O catálogo de GPs não foi carregado. Sincronize novamente para liberar a contratação.
          </Text>
        )}
      </View>
    </View>
  );
}
