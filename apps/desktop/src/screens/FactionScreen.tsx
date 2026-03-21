import { type FactionCoordinationKind } from '@cs-rio/shared';
import {
  FACTION_SCREEN_TABS,
  formatFactionCurrency,
  resolveFactionCoordinationLabel,
  resolveFactionElectionStatusLabel,
  resolveFactionLedgerDisplayedAmount,
  resolveFactionLedgerEntryLabel,
  resolveFactionNpcProgressionCopy,
  resolveFactionNpcProgressionHeadline,
  resolveFactionNpcProgressionMetrics,
  resolveFactionRankLabel,
  resolveFactionScreenTabLabel,
  useFactionController,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card, Tabs } from '../components/ui';
import {
  factionApi,
  factionCrimeApi,
} from '../services/api';
import { factionRealtimeService } from '../services/realtime';
import { useAuthStore } from '../stores/authStore';
import {
  EmptyStateCard,
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
  formatTimestamp,
} from './shared/DesktopScreenPrimitives';

const COORDINATION_KINDS: FactionCoordinationKind[] = ['attack', 'defend', 'gather', 'supply'];

export function FactionScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const token = useAuthStore((state) => state.token);
  const [activeTab, setActiveTab] = useState<(typeof FACTION_SCREEN_TABS)[number]>('overview');
  const [createName, setCreateName] = useState('');
  const [createAbbreviation, setCreateAbbreviation] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [depositAmount, setDepositAmount] = useState('5000');
  const [depositDescription, setDepositDescription] = useState('Caixa da rodada');
  const [withdrawAmount, setWithdrawAmount] = useState('3000');
  const [withdrawDescription, setWithdrawDescription] = useState('Operacao de rua');
  const [chatMessage, setChatMessage] = useState('');
  const [coordinationLabel, setCoordinationLabel] = useState('');
  const [coordinationKind, setCoordinationKind] = useState<FactionCoordinationKind>('attack');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const {
    bankBook,
    bankLedgerSummary,
    canManageFaction,
    createFaction,
    currentFaction,
    currentFactionId,
    depositBank,
    error,
    feedback,
    isLoading,
    isMutating,
    joinFaction,
    leadershipCenter,
    leaveFaction,
    realtimeSnapshot,
    sendCoordination,
    sendFactionChat,
    sortedFactions,
    sortedMembers,
    supportLeadership,
    unlockUpgrade,
    upgradeBook,
    voteLeadership,
    warCatalog,
    withdrawBank,
  } = useFactionController({
    factionApi,
    factionCrimeApi,
    player,
    realtimeService: factionRealtimeService,
    refreshPlayerProfile,
    token,
  });

  useEffect(() => {
    if (!currentFactionId && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [activeTab, currentFactionId]);

  useEffect(() => {
    const firstCandidateId = leadershipCenter?.election?.candidates[0]?.playerId ?? '';

    setSelectedCandidateId((current) => current || firstCandidateId);
  }, [leadershipCenter?.election?.candidates]);

  const tabs = FACTION_SCREEN_TABS.map((tab) => ({
    id: tab,
    label: resolveFactionScreenTabLabel(tab),
  }));
  const onlineCount = realtimeSnapshot.members.length;
  const latestChat = useMemo(
    () => [...realtimeSnapshot.chatMessages].reverse().slice(0, 4),
    [realtimeSnapshot.chatMessages],
  );
  const latestCoordination = useMemo(
    () => [...realtimeSnapshot.coordinationCalls].reverse().slice(0, 4),
    [realtimeSnapshot.coordinationCalls],
  );
  const npcMetrics = resolveFactionNpcProgressionMetrics(currentFaction?.npcProgression);

  if (!player) {
    return <></>;
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        badges={[
          { label: currentFaction ? currentFaction.abbreviation : 'Sem faccao', tone: currentFaction ? 'warning' : 'neutral' },
          { label: formatFactionRoomStatus(realtimeSnapshot.status), tone: realtimeSnapshot.status === 'connected' ? 'success' : 'warning' },
          { label: `${onlineCount} online`, tone: 'info' },
        ]}
        description="Comande membros, caixa, melhorias, recados e disputa de liderança sem sair da base da faccao."
        title="Falar com a faccao"
      />

      {feedback ? <FeedbackCard message={feedback} title="Faccao atualizada" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha na faccao" tone="danger" /> : null}

      {!currentFaction ? (
        <div className="desktop-grid-2">
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Criar faccao</h3>
              <Badge tone="warning">Sem afiliacao</Badge>
            </div>
            <div className="desktop-screen__stack">
              <FormField label="Nome">
                <input
                  onChange={(event) => setCreateName(event.target.value)}
                  value={createName}
                />
              </FormField>
              <FormField label="Sigla">
                <input
                  maxLength={6}
                  onChange={(event) => setCreateAbbreviation(event.target.value.toUpperCase())}
                  value={createAbbreviation}
                />
              </FormField>
              <FormField label="Descricao">
                <textarea
                  onChange={(event) => setCreateDescription(event.target.value)}
                  value={createDescription}
                />
              </FormField>
              <Button
                disabled={isMutating}
                onClick={() =>
                  void createFaction({
                    abbreviation: createAbbreviation,
                    description: createDescription,
                    name: createName,
                  })
                }
                variant="primary"
              >
                {isMutating ? 'Criando...' : 'Criar faccao'}
              </Button>
            </div>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Faccoes abertas</h3>
              <Badge tone={isLoading ? 'warning' : 'info'}>
                {isLoading ? 'Carregando' : `${sortedFactions.length} faccoes`}
              </Badge>
            </div>
            <div className="desktop-scroll-list">
              {sortedFactions.map((faction) => (
                <div className="desktop-list-row" key={faction.id}>
                  <div className="desktop-list-row__headline">
                    <strong>
                      {faction.abbreviation} · {faction.name}
                    </strong>
                    <Badge tone="neutral">{faction.memberCount} membros</Badge>
                  </div>
                  <small>
                    {faction.points} pts · {faction.description ?? 'Sem descricao publica'}
                  </small>
                  <small>
                    {faction.canSelfJoin
                      ? `Auto-join liberado${faction.availableJoinSlots !== null ? ` · ${faction.availableJoinSlots} vagas` : ''}`
                      : 'Entrada so por convite da faccao'}
                  </small>
                  <Button
                    disabled={!faction.canSelfJoin || isMutating}
                    onClick={() => void joinFaction(faction.id, faction.name)}
                    size="sm"
                    variant="secondary"
                  >
                    Entrar
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <>
          <div className="desktop-metric-grid">
            <MetricCard label="Pontos" tone="warning" value={`${currentFaction.points}`} />
            <MetricCard label="Banco" tone="info" value={formatFactionCurrency(currentFaction.bankMoney)} />
            <MetricCard label="Membros" tone="neutral" value={`${currentFaction.memberCount}`} />
            <MetricCard label="Seu cargo" tone="success" value={resolveFactionRankLabel(currentFaction.myRank)} />
          </div>

          <Card className="desktop-panel">
            <Tabs
              activeId={activeTab}
              items={tabs}
              onChange={(value) => setActiveTab(value as (typeof FACTION_SCREEN_TABS)[number])}
            />
          </Card>

          {activeTab === 'overview' ? (
            <div className="desktop-faction-grid">
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>{currentFaction.name}</h3>
                  <Badge tone="warning">{currentFaction.abbreviation}</Badge>
                </div>
                <p>{currentFaction.description ?? 'Sem descricao configurada.'}</p>
                <div className="desktop-detail-list">
                  <div>
                    <strong>Banco</strong>
                    <small>{formatFactionCurrency(currentFaction.bankMoney)}</small>
                  </div>
                  <div>
                    <strong>Satisfacao interna</strong>
                    <small>{currentFaction.internalSatisfaction}%</small>
                  </div>
                  <div>
                    <strong>Lider atual</strong>
                    <small>{leadershipCenter?.leader.nickname ?? 'Sem lideranca carregada'}</small>
                  </div>
                </div>
                <Button
                  disabled={isMutating}
                  onClick={() => void leaveFaction()}
                  variant="ghost"
                >
                  Sair da faccao
                </Button>
              </Card>

              <div className="desktop-screen__stack">
                <Card className="desktop-panel">
                  <div className="desktop-panel__header">
                    <h3>Progressao NPC</h3>
                    <Badge tone="info">
                      {resolveFactionNpcProgressionHeadline(currentFaction.npcProgression)}
                    </Badge>
                  </div>
                  <p>{resolveFactionNpcProgressionCopy(currentFaction.npcProgression)}</p>
                  <div className="desktop-grid-2">
                    {npcMetrics.map((metric) => (
                      <MetricCard key={metric.label} label={metric.label} value={metric.value} />
                    ))}
                  </div>
                </Card>

                <Card className="desktop-panel">
                  <div className="desktop-panel__header">
                    <h3>Sala em tempo real</h3>
                    <Badge tone="success">{onlineCount} online</Badge>
                  </div>
                  <div className="desktop-detail-list">
                    {latestChat.map((message) => (
                      <div key={message.id}>
                        <strong>{message.nickname}</strong>
                        <small>{message.message}</small>
                      </div>
                    ))}
                    {latestCoordination.map((call) => (
                      <div key={call.id}>
                        <strong>{resolveFactionCoordinationLabel(call.kind)}</strong>
                        <small>{call.label}</small>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {activeTab === 'members' ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <h3>Membros</h3>
                <Badge tone="info">{sortedMembers.length} no quadro</Badge>
              </div>
              <div className="desktop-scroll-list">
                {sortedMembers.map((member) => (
                  <div className="desktop-list-row" key={member.id}>
                    <div className="desktop-list-row__headline">
                      <strong>{member.nickname}</strong>
                      <Badge tone={realtimeSnapshot.members.some((entry) => entry.playerId === member.id) ? 'success' : 'neutral'}>
                        {realtimeSnapshot.members.some((entry) => entry.playerId === member.id) ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <small>
                      {resolveFactionRankLabel(member.rank)} · nivel {member.level ?? '--'} · entrou em {formatTimestamp(member.joinedAt)}
                    </small>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {activeTab === 'bank' ? (
            <div className="desktop-grid-2">
              <Card className="desktop-panel">
                <div className="desktop-grid-4">
                  <MetricCard label="Entradas auto" tone="success" value={formatFactionCurrency(bankLedgerSummary.automaticIncome)} />
                  <MetricCard label="Depositos" tone="info" value={formatFactionCurrency(bankLedgerSummary.manualDeposits)} />
                  <MetricCard label="Saques" tone="danger" value={formatFactionCurrency(bankLedgerSummary.manualWithdrawals)} />
                  <MetricCard label="Upgrades" tone="warning" value={formatFactionCurrency(bankLedgerSummary.upgradeSpend)} />
                </div>
                <div className="desktop-divider" />
                <div className="desktop-grid-2">
                  <div className="desktop-screen__stack">
                    <FormField label="Deposito">
                      <input
                        onChange={(event) => setDepositAmount(event.target.value)}
                        value={depositAmount}
                      />
                    </FormField>
                    <FormField label="Descricao">
                      <input
                        onChange={(event) => setDepositDescription(event.target.value)}
                        value={depositDescription}
                      />
                    </FormField>
                    <Button
                      disabled={!bankBook?.permissions.canDeposit || isMutating}
                      onClick={() =>
                        void depositBank(Number.parseInt(depositAmount, 10) || 0, depositDescription)
                      }
                      variant="primary"
                    >
                      Depositar
                    </Button>
                  </div>
                  <div className="desktop-screen__stack">
                    <FormField label="Saque">
                      <input
                        onChange={(event) => setWithdrawAmount(event.target.value)}
                        value={withdrawAmount}
                      />
                    </FormField>
                    <FormField label="Descricao">
                      <input
                        onChange={(event) => setWithdrawDescription(event.target.value)}
                        value={withdrawDescription}
                      />
                    </FormField>
                    <Button
                      disabled={!bankBook?.permissions.canWithdraw || isMutating}
                      onClick={() =>
                        void withdrawBank(Number.parseInt(withdrawAmount, 10) || 0, withdrawDescription)
                      }
                      variant="secondary"
                    >
                      Sacar
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="desktop-panel">
                <h3>Razao do banco</h3>
                <div className="desktop-scroll-list">
                  {(bankBook?.ledger ?? []).map((entry) => (
                    <div className="desktop-list-row" key={entry.id}>
                      <div className="desktop-list-row__headline">
                        <strong>{resolveFactionLedgerEntryLabel(entry)}</strong>
                        <Badge tone={entry.entryType === 'withdrawal' ? 'danger' : 'success'}>
                          {formatFactionCurrency(resolveFactionLedgerDisplayedAmount(entry))}
                        </Badge>
                      </div>
                      <small>
                        Saldo {formatFactionCurrency(entry.balanceAfter)} · {formatTimestamp(entry.createdAt)}
                      </small>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {activeTab === 'upgrades' ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <h3>Upgrades</h3>
                <Badge tone="warning">{upgradeBook?.availablePoints ?? 0} pts</Badge>
              </div>
              <div className="desktop-scroll-list">
                {(upgradeBook?.upgrades ?? []).map((upgrade) => (
                  <div className="desktop-list-row" key={upgrade.type}>
                    <div className="desktop-list-row__headline">
                      <strong>{upgrade.label}</strong>
                      <Badge tone={upgrade.isUnlocked ? 'success' : upgrade.canUnlock ? 'warning' : 'neutral'}>
                        {upgrade.isUnlocked ? 'Liberado' : upgrade.canUnlock ? 'Pronto' : 'Bloqueado'}
                      </Badge>
                    </div>
                    <small>{upgrade.effectSummary}</small>
                    <small>
                      Banco {formatFactionCurrency(upgrade.bankMoneyCost)} · pontos {upgrade.pointsCost}
                    </small>
                    <Button
                      disabled={!canManageFaction || !upgrade.canUnlock || isMutating}
                      onClick={() => void unlockUpgrade(upgrade.type)}
                      size="sm"
                      variant="secondary"
                    >
                      Liberar
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {activeTab === 'war' ? (
            <div className="desktop-grid-2">
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Sala de coordenacao</h3>
                  <Badge tone="info">{formatFactionRoomStatus(realtimeSnapshot.status)}</Badge>
                </div>
                <div className="desktop-grid-2">
                  <FormField label="Mensagem do chat">
                    <input
                      onChange={(event) => setChatMessage(event.target.value)}
                      value={chatMessage}
                    />
                  </FormField>
                  <div className="desktop-screen__stack">
                    <Button
                      onClick={() => {
                        sendFactionChat(chatMessage);
                        setChatMessage('');
                      }}
                      variant="primary"
                    >
                      Enviar chat
                    </Button>
                  </div>
                </div>
                <div className="desktop-grid-3">
                  <FormField label="Tipo">
                    <select
                      onChange={(event) => setCoordinationKind(event.target.value as FactionCoordinationKind)}
                      value={coordinationKind}
                    >
                      {COORDINATION_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {resolveFactionCoordinationLabel(kind)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Rotulo do chamado">
                    <input
                      onChange={(event) => setCoordinationLabel(event.target.value)}
                      value={coordinationLabel}
                    />
                  </FormField>
                  <div className="desktop-screen__stack">
                    <Button
                      onClick={() => {
                        sendCoordination(coordinationKind, coordinationLabel);
                        setCoordinationLabel('');
                      }}
                      variant="secondary"
                    >
                      Disparar coordenacao
                    </Button>
                  </div>
                </div>
                <div className="desktop-detail-list">
                  {latestCoordination.map((call) => (
                    <div key={call.id}>
                      <strong>{resolveFactionCoordinationLabel(call.kind)}</strong>
                      <small>{call.nickname} · {call.label}</small>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Crimes de faccao</h3>
                  <Badge tone="warning">
                    {warCatalog?.coordinatorCanStart ? 'Coordenador apto' : 'Somente leitura'}
                  </Badge>
                </div>
                <div className="desktop-scroll-list">
                  {(warCatalog?.crimes ?? []).map((crime) => (
                    <div className="desktop-list-row" key={crime.id}>
                      <div className="desktop-list-row__headline">
                        <strong>{crime.name}</strong>
                        <Badge tone={crime.isRunnable ? 'success' : 'warning'}>
                          {crime.isRunnable ? 'Pronto' : 'Travado'}
                        </Badge>
                      </div>
                      <small>
                        Crew {crime.minimumCrewSize}-{crime.maximumCrewSize} · cooldown {crime.cooldownRemainingSeconds}s
                      </small>
                      <small>{crime.lockReason ?? 'Sem bloqueio atual.'}</small>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {activeTab === 'leadership' ? (
            <div className="desktop-grid-2">
              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Lideranca</h3>
                  <Badge tone="warning">{leadershipCenter?.leader.nickname ?? '--'}</Badge>
                </div>
                <div className="desktop-detail-list">
                  <div>
                    <strong>Lider</strong>
                    <small>
                      {leadershipCenter?.leader.nickname ?? '--'} · {resolveFactionRankLabel(leadershipCenter?.leader.rank ?? null)}
                    </small>
                  </div>
                  <div>
                    <strong>Status eleitoral</strong>
                    <small>
                      {leadershipCenter?.election
                        ? resolveFactionElectionStatusLabel(leadershipCenter.election.status)
                        : 'Sem eleicao ativa'}
                    </small>
                  </div>
                  <div>
                    <strong>Abaixo-assinado</strong>
                    <small>
                      {leadershipCenter?.election
                        ? `${leadershipCenter.election.supportCount}/${leadershipCenter.election.supportThreshold}`
                        : 'Indisponivel'}
                    </small>
                  </div>
                </div>
                <Button
                  disabled={isMutating}
                  onClick={() => void supportLeadership()}
                  variant="secondary"
                >
                  Apoiar candidatura
                </Button>
              </Card>

              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <h3>Votacao</h3>
                  <Badge tone="info">
                    {leadershipCenter?.election ? `${leadershipCenter.election.totalVotes} votos` : 'Aguardando'}
                  </Badge>
                </div>
                {leadershipCenter?.election?.candidates.length ? (
                  <>
                    <FormField label="Candidato">
                      <select
                        onChange={(event) => setSelectedCandidateId(event.target.value)}
                        value={selectedCandidateId}
                      >
                        {leadershipCenter.election.candidates.map((candidate) => (
                          <option key={candidate.playerId} value={candidate.playerId}>
                            {candidate.nickname} · {resolveFactionRankLabel(candidate.rank)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <Button
                      disabled={!selectedCandidateId || isMutating}
                      onClick={() => void voteLeadership(selectedCandidateId)}
                      variant="primary"
                    >
                      Registrar voto
                    </Button>
                    <div className="desktop-scroll-list">
                      {leadershipCenter.election.candidates.map((candidate) => (
                        <div className="desktop-list-row" key={candidate.playerId}>
                          <div className="desktop-list-row__headline">
                            <strong>{candidate.nickname}</strong>
                            <Badge tone="warning">{candidate.votes} votos</Badge>
                          </div>
                          <small>{resolveFactionRankLabel(candidate.rank)} · nivel {candidate.level}</small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyStateCard
                    description="Quando a eleicao abrir ou houver abaixo-assinado suficiente, os candidatos aparecem aqui."
                    title="Sem candidatos carregados"
                  />
                )}
              </Card>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function formatFactionRoomStatus(status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'): string {
  if (status === 'connected') {
    return 'Sala aberta';
  }

  if (status === 'connecting') {
    return 'Abrindo sala';
  }

  if (status === 'reconnecting') {
    return 'Voltando';
  }

  return 'Offline';
}
