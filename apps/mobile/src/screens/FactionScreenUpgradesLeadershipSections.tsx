import { Text, View } from 'react-native';

import {
  resolveFactionElectionStatusLabel,
  resolveFactionRankLabel,
  formatFactionCurrency,
} from '../features/faction';
import { colors } from '../theme/colors';
import {
  ActionButton,
  CandidateCard,
  EmptyState,
  InfoRow,
  SectionCard,
  styles,
  SummaryCard,
  Tag,
} from './FactionScreen.parts';
import type { FactionScreenController } from './useFactionScreenController';
import { formatDateTimeLabel } from './factionScreenSupport';

export function FactionScreenUpgradesSection({
  controller,
}: {
  controller: FactionScreenController;
}): JSX.Element {
  const { handleUnlockUpgrade, isMutating, upgradeBook } = controller;

  return (
    <>
      <SectionCard
        subtitle="Centro coletivo com desbloqueios persistentes pagos pelo caixa da facção e registrados no ledger."
        title="Centro de upgrades"
      >
        {upgradeBook ? (
          <View style={styles.summaryGrid}>
            <SummaryCard label="Caixa" tone={colors.warning} value={formatFactionCurrency(upgradeBook.availableBankMoney ?? 0)} />
            <SummaryCard label="Pontos" tone={colors.accent} value={`${upgradeBook.availablePoints ?? 0}`} />
            <SummaryCard label="Bônus attr." tone={colors.success} value={`${Math.round((upgradeBook.effects.attributeBonusMultiplier ?? 0) * 100)}%`} />
            <SummaryCard label="Mulas" tone={colors.info} value={`${upgradeBook.effects.muleDeliveryTier ?? 0}`} />
            <SummaryCard label="Soldados" tone={colors.warning} value={`${Math.round((upgradeBook.effects.soldierCapacityMultiplier ?? 1) * 100)}%`} />
          </View>
        ) : (
          <EmptyState copy="Seu cargo ainda não pode acessar o centro de upgrades." />
        )}
      </SectionCard>

      <SectionCard
        subtitle="Cada desbloqueio consome dinheiro do caixa coletivo. Pontos continuam existindo como métrica da facção, mas o custo agora sai da tesouraria."
        title="Catálogo coletivo"
      >
        {!upgradeBook ? (
          <EmptyState copy="Os upgrades ficam visíveis apenas para cargos autorizados." />
        ) : upgradeBook.upgrades.length ? (
          <View style={styles.listColumn}>
            {upgradeBook.upgrades.map((upgrade) => (
              <View key={upgrade.type} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.flexCopy}>
                    <Text style={styles.cardTitle}>{upgrade.label}</Text>
                    <Text style={styles.cardCopy}>{upgrade.effectSummary}</Text>
                    {!upgrade.isUnlocked ? (
                      <Text style={styles.cardCopy}>
                        Custo coletivo: {formatFactionCurrency(upgrade.bankMoneyCost)}
                      </Text>
                    ) : null}
                  </View>
                  <Tag
                    label={upgrade.isUnlocked ? 'Ativo' : formatFactionCurrency(upgrade.bankMoneyCost)}
                    tone={upgrade.isUnlocked ? 'success' : 'accent'}
                  />
                </View>
                {upgrade.prerequisiteUpgradeTypes.length > 0 ? (
                  <Text style={styles.cardCopy}>Pré-req.: {upgrade.prerequisiteUpgradeTypes.join(', ')}</Text>
                ) : null}
                {!upgrade.isUnlocked ? (
                  <ActionButton
                    disabled={isMutating || !upgrade.canUnlock}
                    label={upgrade.lockReason ?? 'Desbloquear upgrade'}
                    onPress={() => {
                      void handleUnlockUpgrade(upgrade.type);
                    }}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Nenhum upgrade carregado. Atualize o hub para sincronizar o centro coletivo." />
        )}
      </SectionCard>
    </>
  );
}

export function FactionScreenLeadershipSection({
  controller,
}: {
  controller: FactionScreenController;
}): JSX.Element {
  const {
    handleChallengeLeadership,
    handleSupportElection,
    handleVoteCandidate,
    isMutating,
    leadershipCenter,
  } = controller;
  const election = leadershipCenter?.election ?? null;

  return (
    <>
      <SectionCard
        subtitle="Painel político da facção com líder atual, eleição, apoios, votos e desafio direto."
        title="Candidatura e disputa"
      >
        <View style={styles.summaryGrid}>
          <SummaryCard label="Líder" tone={colors.accent} value={leadershipCenter?.leader.nickname ?? '--'} />
          <SummaryCard label="Cargo" tone={colors.info} value={resolveFactionRankLabel(leadershipCenter?.leader.rank ?? null)} />
          <SummaryCard label="NPC" tone={colors.warning} value={leadershipCenter?.leader.isNpc ? 'Sim' : 'Não'} />
          <SummaryCard label="Pode desafiar" tone={colors.danger} value={leadershipCenter?.challenge.canChallenge ? 'Sim' : 'Não'} />
        </View>
        <ActionButton
          disabled={isMutating || !leadershipCenter?.challenge.canChallenge}
          label={leadershipCenter?.challenge.lockReason ?? 'Desafiar liderança'}
          onPress={() => {
            void handleChallengeLeadership();
          }}
          tone="danger"
        />
      </SectionCard>

      <SectionCard
        subtitle="Apoiadores abrem a votação; quando a eleição estiver ativa, cada membro habilitado vota direto pelo celular."
        title="Eleição"
      >
        {election ? (
          <>
            <View style={styles.listColumn}>
              <InfoRow label="Status" value={resolveFactionElectionStatusLabel(election.status)} />
              <InfoRow label="Apoios" value={`${election.supportCount}/${election.supportThreshold}`} />
              <InfoRow label="Votos" value={`${election.totalVotes}`} />
              <InfoRow
                label="Cooldown"
                value={
                  election.cooldownEndsAt
                    ? formatDateTimeLabel(election.cooldownEndsAt)
                    : 'livre'
                }
              />
            </View>

            {!election.hasPlayerSupported && election.status === 'petitioning' ? (
              <ActionButton
                disabled={isMutating}
                label="Apoiar candidatura"
                onPress={() => {
                  void handleSupportElection();
                }}
              />
            ) : null}

            <View style={styles.listColumn}>
              {election.candidates.map((candidate) => (
                <CandidateCard
                  candidate={candidate}
                  canVote={
                    election.status === 'active' &&
                    !election.hasPlayerVoted
                  }
                  isMutating={isMutating}
                  key={candidate.playerId}
                  onVote={() => {
                    void handleVoteCandidate(candidate.playerId);
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <EmptyState copy="Nenhuma eleição aberta. O primeiro apoio abre o abaixo-assinado para disputa de liderança." />
            <ActionButton
              disabled={isMutating}
              label="Iniciar abaixo-assinado"
              onPress={() => {
                void handleSupportElection();
              }}
            />
          </>
        )}

        {leadershipCenter?.challenge.lastResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Último desafio</Text>
            <Text style={styles.resultCopy}>
              {leadershipCenter.challenge.lastResult.challengerWon
                ? `${leadershipCenter.challenge.lastResult.challengerNickname} venceu e tomou a liderança.`
                : `${leadershipCenter.challenge.lastResult.defenderNickname} segurou o cargo.`}
            </Text>
            <Text style={styles.resultCopy}>
              Chance {Math.round(leadershipCenter.challenge.lastResult.successChance * 100)}% · resolvido em {formatDateTimeLabel(leadershipCenter.challenge.lastResult.resolvedAt)}
            </Text>
          </View>
        ) : null}
      </SectionCard>
    </>
  );
}
