import { Text, TextInput, View } from 'react-native';

import {
  formatTerritoryCountdown,
  formatTerritoryCurrency,
  formatTerritoryTimestamp,
  resolvePropinaStatusLabel,
  resolveRoundOutcomeLabel,
  resolveWarSideLabel,
  resolveWarStatusLabel,
  resolveX9StatusLabel,
} from '../features/territory';
import { colors } from '../theme/colors';
import { ActionButton, styles } from './TerritoryScreen.parts';
import { type TerritoryScreenController } from './useTerritoryScreenController';

export function TerritoryScreenConflictSection({
  controller,
}: {
  controller: TerritoryScreenController;
}): JSX.Element | null {
  const {
    canAdvanceSelectedWarRound,
    canPrepareSelectedWar,
    handleAdvanceWarRound,
    handlePrepareWar,
    isMutating,
    nowMs,
    selectedFavela,
    selectedWar,
    selectedWarResultCue,
    selectedWarSide,
    setWarBudgetInput,
    setWarSoldierCommitmentInput,
    warBudgetInput,
    warSoldierCommitmentInput,
  } = controller;

  if (!selectedFavela) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Pressao e conflito</Text>
      <Text style={styles.sectionSubtitle}>
        Arrego, X9 e guerra convivem aqui. O objetivo e responder cedo, antes que a favela desmonte.
      </Text>

      <View style={styles.pressureGrid}>
        <View style={styles.pressureCard}>
          <Text style={styles.pressureTitle}>Propina</Text>
          <Text style={styles.pressureValue}>
            {selectedFavela.propina ? resolvePropinaStatusLabel(selectedFavela.propina.status) : '--'}
          </Text>
          <Text style={styles.pressureCopy}>
            Atual {formatTerritoryCurrency(selectedFavela.propina?.currentAmount ?? selectedFavela.propinaValue)}
          </Text>
          <Text style={styles.pressureCopy}>
            Vence {formatTerritoryTimestamp(selectedFavela.propina?.dueAt ?? null)}
          </Text>
        </View>

        <View style={styles.pressureCard}>
          <Text style={styles.pressureTitle}>X9</Text>
          <Text style={styles.pressureValue}>
            {selectedFavela.x9 ? resolveX9StatusLabel(selectedFavela.x9.status) : 'Sem evento'}
          </Text>
          <Text style={styles.pressureCopy}>
            Risco atual {selectedFavela.x9?.currentRiskPercent.toFixed(1) ?? selectedFavela.satisfactionProfile.dailyX9RiskPercent.toFixed(1)}%
          </Text>
          <Text style={styles.pressureCopy}>
            Janela {formatTerritoryCountdown(selectedFavela.x9?.warningEndsAt ?? null, nowMs) ?? '--'}
          </Text>
        </View>

        <View style={styles.pressureCard}>
          <Text style={styles.pressureTitle}>Guerra</Text>
          <Text style={styles.pressureValue}>
            {selectedWar ? resolveWarStatusLabel(selectedWar.status) : 'Sem guerra'}
          </Text>
          <Text style={styles.pressureCopy}>
            Score {selectedWar ? `${selectedWar.attackerScore} x ${selectedWar.defenderScore}` : '--'}
          </Text>
          <Text style={styles.pressureCopy}>
            Próximo passo {selectedWar ? (formatTerritoryCountdown(selectedWar.nextRoundAt ?? selectedWar.preparationEndsAt, nowMs) ?? '--') : '--'}
          </Text>
        </View>
      </View>

      {selectedWar ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedWarResultCue ? 'Desfecho da guerra' : 'Teatro de guerra'}</Text>
          <Text style={styles.detailCopy}>
            {selectedWar.attackerFaction.abbreviation} x {selectedWar.defenderFaction.abbreviation} · seu lado {selectedWarSide ? resolveWarSideLabel(selectedWarSide) : 'Fora do conflito'} · rounds {selectedWar.roundsResolved}/{selectedWar.roundsTotal}
          </Text>
          <Text style={styles.detailCopy}>
            Preparação até {formatTerritoryTimestamp(selectedWar.preparationEndsAt)} · cooldown até {formatTerritoryTimestamp(selectedWar.cooldownEndsAt)}
          </Text>
          <Text style={styles.detailCopy}>
            Espólio {formatTerritoryCurrency(selectedWar.lootMoney)} · vencedor {selectedWar.winnerFactionId ?? '--'}
          </Text>

          {selectedWarResultCue ? (
            <>
              <Text style={styles.detailCopy}>{selectedWarResultCue.territorialImpact}</Text>
              <Text style={styles.detailCopy}>{selectedWarResultCue.personalImpact.label}</Text>
              {selectedWarResultCue.personalImpact.directParticipation ? (
                <Text style={styles.detailCopy}>
                  Conceito {selectedWarResultCue.personalImpact.conceitoDelta >= 0 ? '+' : ''}
                  {selectedWarResultCue.personalImpact.conceitoDelta} · HP -{selectedWarResultCue.personalImpact.hpLoss} · DIS -{selectedWarResultCue.personalImpact.disposicaoLoss} · CAN -{selectedWarResultCue.personalImpact.cansacoLoss}
                </Text>
              ) : null}
            </>
          ) : null}

          {selectedWar.rounds.length > 0 ? (
            <View style={styles.roundList}>
              {selectedWar.rounds
                .slice()
                .reverse()
                .map((round) => (
                  <View key={`${round.roundNumber}-${round.resolvedAt}`} style={styles.roundCard}>
                    <Text style={styles.roundTitle}>
                      Round {round.roundNumber} · {resolveRoundOutcomeLabel(round.outcome)}
                    </Text>
                    <Text style={styles.roundCopy}>
                      Poder {Math.round(round.attackerPower)} x {Math.round(round.defenderPower)} · perdas HP {round.attackerHpLoss}/{round.defenderHpLoss}
                    </Text>
                    <Text style={styles.roundCopy}>{round.message}</Text>
                  </View>
                ))}
            </View>
          ) : null}

          {canPrepareSelectedWar ? (
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Budget de guerra</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setWarBudgetInput}
                placeholder="25000"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={warBudgetInput}
              />
              <Text style={styles.formLabel}>Comprometimento de soldados</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setWarSoldierCommitmentInput}
                placeholder="6"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={warSoldierCommitmentInput}
              />
              <View style={styles.actionRow}>
                <ActionButton
                  disabled={isMutating}
                  label="Preparar lado"
                  onPress={() => {
                    void handlePrepareWar();
                  }}
                  tone="danger"
                />
              </View>
            </View>
          ) : null}

          {canAdvanceSelectedWarRound ? (
            <View style={styles.actionRow}>
              <ActionButton
                disabled={isMutating}
                label="Resolver round"
                onPress={() => {
                  void handleAdvanceWarRound();
                }}
                tone="danger"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
