import { Text, TextInput, View } from 'react-native';

import {
  resolveFactionLedgerDisplayedAmount,
  resolveFactionLedgerEntryLabel,
  resolveFactionRankLabel,
  formatFactionCurrency,
} from '../features/faction';
import { colors } from '../theme/colors';
import {
  ActionButton,
  Banner,
  EmptyState,
  Field,
  MiniButton,
  SectionCard,
  styles,
  SummaryCard,
  Tag,
} from './FactionScreen.parts';
import type { FactionScreenController } from './useFactionScreenController';
import { formatDateTimeLabel } from './factionScreenSupport';

export function FactionScreenMembersSection({
  controller,
}: {
  controller: FactionScreenController;
}): JSX.Element {
  const {
    canModerateMembers,
    canRecruitMembers,
    handleMemberAction,
    handleRecruitMember,
    isMutating,
    onlinePlayerIds,
    player,
    recruitNickname,
    setRecruitNickname,
    sortedMembers,
  } = controller;

  return (
    <>
      {canRecruitMembers ? (
        <SectionCard
          subtitle="Recrutamento por nickname do jogador. A hierarquia da facção continua valendo para evitar abuso."
          title="Recrutar membro"
        >
          <Field label="Nickname">
            <TextInput
              autoCapitalize="none"
              onChangeText={setRecruitNickname}
              placeholder="Nickname do alvo"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={recruitNickname}
            />
          </Field>
          <ActionButton
            disabled={isMutating}
            label="Recrutar"
            onPress={() => {
              void handleRecruitMember();
            }}
          />
        </SectionCard>
      ) : null}

      <SectionCard
        subtitle="Lista unificada com quem está no bonde, quem está online e como a hierarquia está distribuída."
        title="Membros e presença"
      >
        {sortedMembers.length > 0 ? (
          <View style={styles.listColumn}>
            {sortedMembers.map((member) => {
              const isOnline = onlinePlayerIds.includes(member.id);

              return (
                <View key={member.id} style={styles.listCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.flexCopy}>
                      <Text style={styles.cardTitle}>
                        {member.nickname}
                        {member.id === player?.id ? ' · você' : ''}
                      </Text>
                      <Text style={styles.cardCopy}>
                        {resolveFactionRankLabel(member.rank)} · nível {member.level ?? '--'} · {member.vocation ?? 'sem vocação'}
                      </Text>
                    </View>
                    <Tag label={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'success' : 'neutral'} />
                  </View>
                  <Text style={styles.cardCopy}>
                    Entrou em {formatDateTimeLabel(member.joinedAt)}
                    {member.isLeader ? ' · líder atual' : ''}
                    {member.isNpc ? ' · NPC' : ''}
                  </Text>
                  {canModerateMembers && !member.isLeader && !member.isNpc && member.id !== player?.id ? (
                    <View style={styles.inlineRow}>
                      <MiniButton
                        disabled={isMutating}
                        label="Promover"
                        onPress={() => {
                          void handleMemberAction('promote', member);
                        }}
                        tone="success"
                      />
                      <MiniButton
                        disabled={isMutating}
                        label="Rebaixar"
                        onPress={() => {
                          void handleMemberAction('demote', member);
                        }}
                        tone="warning"
                      />
                      <MiniButton
                        disabled={isMutating}
                        label="Expulsar"
                        onPress={() => {
                          void handleMemberAction('expel', member);
                        }}
                        tone="danger"
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState copy="Nenhum membro disponível. Crie a facção ou sincronize a lista." />
        )}
      </SectionCard>
    </>
  );
}

export function FactionScreenBankSection({
  controller,
}: {
  controller: FactionScreenController;
}): JSX.Element {
  const {
    bankBook,
    bankLedgerSummary,
    depositAmount,
    handleDeposit,
    handleWithdraw,
    isMutating,
    setDepositAmount,
    setWithdrawAmount,
    withdrawAmount,
  } = controller;

  return (
    <>
      <SectionCard
        subtitle="Depósitos, saques por cargo e entradas automáticas dos negócios. O caixa coletivo agora mostra claramente como entra e sai dinheiro da facção."
        title="Banco da facção"
      >
        {!bankBook ? (
          <EmptyState copy="Seu cargo não pode acessar o banco da facção." />
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <SummaryCard label="Saldo" tone={colors.warning} value={formatFactionCurrency(bankBook.faction.bankMoney)} />
              <SummaryCard label="Auto." tone={colors.success} value={formatFactionCurrency(bankLedgerSummary.automaticIncome)} />
              <SummaryCard label="Depósitos" tone={colors.info} value={formatFactionCurrency(bankLedgerSummary.manualDeposits)} />
              <SummaryCard label="Saídas" tone={colors.danger} value={formatFactionCurrency(bankLedgerSummary.manualWithdrawals)} />
              <SummaryCard label="Upgrades" tone={colors.accent} value={formatFactionCurrency(bankLedgerSummary.upgradeSpend)} />
              <SummaryCard label="Ledger" tone={colors.info} value={`${bankBook.ledger.length}`} />
            </View>
            <Banner
              copy={`Permissões atuais · Depositar: ${bankBook.permissions.canDeposit ? 'sim' : 'não'} · Sacar: ${bankBook.permissions.canWithdraw ? 'sim' : 'não'}.`}
              tone="info"
            />
            <View style={styles.formGrid}>
              <Field label="Depósito">
                <TextInput
                  keyboardType="numeric"
                  onChangeText={setDepositAmount}
                  placeholder="5000"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={depositAmount}
                />
              </Field>
              <ActionButton
                disabled={isMutating || !bankBook.permissions.canDeposit}
                label="Depositar"
                onPress={() => {
                  void handleDeposit();
                }}
              />
            </View>
            <View style={styles.formGrid}>
              <Field label="Saque">
                <TextInput
                  keyboardType="numeric"
                  onChangeText={setWithdrawAmount}
                  placeholder="10000"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={withdrawAmount}
                />
              </Field>
              <ActionButton
                disabled={isMutating || !bankBook.permissions.canWithdraw}
                label="Sacar"
                onPress={() => {
                  void handleWithdraw();
                }}
                tone="warning"
              />
            </View>
          </>
        )}
      </SectionCard>

      <SectionCard
        subtitle="Histórico financeiro da facção. Comissões de boca, rave, puteiro, fachada e maquininha caem aqui automaticamente, junto com gastos de upgrade."
        title="Ledger"
      >
        {!bankBook ? (
          <EmptyState copy="Ledger indisponível para o seu cargo nesta fase." />
        ) : bankBook.ledger.length ? (
          <View style={styles.listColumn}>
            {bankBook.ledger.map((entry) => (
              <View key={entry.id} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.flexCopy}>
                    <Text style={styles.cardTitle}>{resolveFactionLedgerEntryLabel(entry)}</Text>
                    <Text style={styles.cardCopy}>{entry.description}</Text>
                  </View>
                  <Text
                    style={[
                      styles.metricValue,
                      entry.entryType === 'withdrawal' ? styles.metricValueDanger : styles.metricValueSuccess,
                    ]}
                  >
                    {entry.entryType === 'withdrawal' ? '-' : '+'}
                    {formatFactionCurrency(resolveFactionLedgerDisplayedAmount(entry))}
                  </Text>
                </View>
                <Text style={styles.cardCopy}>
                  Saldo após {formatFactionCurrency(entry.balanceAfter)} · {formatDateTimeLabel(entry.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Sem movimentações ainda. As primeiras entradas aparecem quando os negócios lucrativos começarem a render." />
        )}
      </SectionCard>
    </>
  );
}
