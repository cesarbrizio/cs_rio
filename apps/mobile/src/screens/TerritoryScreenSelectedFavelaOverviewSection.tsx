import { ActivityIndicator, Text, View } from 'react-native';

import { buildFavelaForceSummaryLines, resolveFavelaStateLabel, resolvePropinaStatusLabel, resolveSatisfactionTierLabel } from '../features/territory';
import { colors } from '../theme/colors';
import { StatusTag, styles, SummaryCard } from './TerritoryScreen.parts';
import { type TerritoryScreenController } from './useTerritoryScreenController';
import {
  resolveSatisfactionColor,
  resolveStateColor,
} from './territoryScreenSupport';
import { formatTerritoryTimestamp, resolveRegionLabel } from '../features/territory';

export function TerritoryScreenSelectedFavelaOverviewSection({
  controller,
}: {
  controller: TerritoryScreenController;
}): JSX.Element | null {
  const {
    isDetailLoading,
    selectedAlerts,
    selectedFavela,
  } = controller;

  if (!selectedFavela) {
    return null;
  }

  return (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>{selectedFavela.name}</Text>
            <Text style={styles.sectionSubtitle}>
              {resolveRegionLabel(selectedFavela.regionId)} · {selectedFavela.controllingFaction?.name ?? 'Sem controle faccional'}
            </Text>
          </View>
          {isDetailLoading ? <ActivityIndicator color={colors.accent} /> : null}
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Estado"
            tone={resolveStateColor(selectedFavela.state)}
            value={resolveFavelaStateLabel(selectedFavela.state)}
          />
          <SummaryCard
            label="Satisfação"
            tone={resolveSatisfactionColor(selectedFavela.satisfactionProfile.tier)}
            value={`${selectedFavela.satisfaction}`}
          />
          <SummaryCard
            label="Moradores"
            tone={colors.info}
            value={selectedFavela.population.toLocaleString('pt-BR')}
          />
          <SummaryCard
            label="Propina"
            tone={selectedFavela.propina ? colors.warning : colors.muted}
            value={selectedFavela.propina ? resolvePropinaStatusLabel(selectedFavela.propina.status) : '--'}
          />
          <SummaryCard
            label="Soldados"
            tone={colors.accent}
            value={`${selectedFavela.soldiers.active}/${selectedFavela.soldiers.max}`}
          />
          <SummaryCard
            label="Bandidos"
            tone={colors.danger}
            value={`${selectedFavela.bandits.active}/${selectedFavela.bandits.targetActive}`}
          />
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Leitura operacional</Text>
          <Text style={styles.detailCopy}>
            Controlador: {selectedFavela.controllingFaction?.name ?? '--'} · Contestação: {selectedFavela.contestingFaction?.name ?? '--'} · Dificuldade {selectedFavela.difficulty}
          </Text>
          {buildFavelaForceSummaryLines(selectedFavela).map((line) => (
            <Text key={`selected-${selectedFavela.id}-${line}`} style={styles.detailCopy}>
              {line}
            </Text>
          ))}
          <Text style={styles.detailCopy}>
            Receita x{selectedFavela.satisfactionProfile.revenueMultiplier.toFixed(2)} · Pressão populacional {selectedFavela.satisfactionProfile.populationPressurePercentPerDay.toFixed(1)}%/dia · X9 {selectedFavela.satisfactionProfile.dailyX9RiskPercent.toFixed(1)}%/dia
          </Text>
          <Text style={styles.detailCopy}>
            Estabilização até {formatTerritoryTimestamp(selectedFavela.stabilizationEndsAt)} · Guerra declarada {formatTerritoryTimestamp(selectedFavela.warDeclaredAt)}
          </Text>
        </View>

        {selectedAlerts.length > 0 ? (
          <View style={styles.alertList}>
            {selectedAlerts.map((alert) => (
              <Text key={alert} style={styles.alertItem}>
                • {alert}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Clima local</Text>
            <Text style={styles.detailCopy}>
              Sem alertas críticos neste momento. A favela está com sinais controlados e leitura previsível.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Satisfação da favela</Text>
        <Text style={styles.sectionSubtitle}>
          Tier {resolveSatisfactionTierLabel(selectedFavela.satisfactionProfile.tier)} · delta diário {selectedFavela.satisfactionProfile.dailyDeltaEstimate.toFixed(1)}
        </Text>

        <View style={styles.factorList}>
          {selectedFavela.satisfactionProfile.factors.map((factor) => (
            <View key={factor.code} style={styles.factorCard}>
              <Text style={styles.factorTitle}>{factor.label}</Text>
              <Text style={styles.factorValue}>
                {factor.dailyDelta >= 0 ? '+' : ''}
                {factor.dailyDelta.toFixed(1)}/dia
              </Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}
