import {
  buildAmbushParticipantOptions,
  buildCombatResultHighlights,
  buildCombatTargets,
  canLeadAmbush,
  formatCombatCurrency,
  formatCombatCooldown,
  resolveCombatTierLabel,
  resolveCombatTierTone,
} from '@cs-rio/ui/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Badge, Button, Card } from '../components/ui';
import type { CombatNavigationState } from '../router/navigationIntents';
import { factionApi, pvpApi } from '../services/api';
import { colyseusService } from '../services/realtime';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

type CombatMode = 'ambush' | 'assault';

export function CombatScreen(): JSX.Element {
  const location = useLocation();
  const player = useAuthStore((state) => state.player);
  const token = useAuthStore((state) => state.token);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [snapshot, setSnapshot] = useState(colyseusService.getSnapshot());
  const [membersBook, setMembersBook] = useState<Awaited<ReturnType<typeof factionApi.getMembers>> | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Awaited<ReturnType<typeof pvpApi.assault>> | Awaited<ReturnType<typeof pvpApi.ambush>> | null>(null);

  useEffect(() => colyseusService.subscribe(setSnapshot), []);

  useEffect(() => {
    if (!player?.hasCharacter || !token) {
      return;
    }

    void colyseusService.connectToRegionRoom({
      accessToken: token,
      regionId: player.regionId,
    });
  }, [player?.hasCharacter, player?.regionId, token]);

  const loadMembers = useCallback(async (factionId?: string | null): Promise<void> => {
    if (!factionId) {
      setMembersBook(null);
      return;
    }

    setIsLoadingMembers(true);
    setError(null);

    try {
      const response = await factionApi.getMembers(factionId);
      setMembersBook(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a faccao.');
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers(player?.faction?.id);
  }, [loadMembers, player?.faction?.id]);

  const ownFactionMemberIds = useMemo(
    () => membersBook?.members.map((member) => member.id) ?? [],
    [membersBook?.members],
  );
  const targetOptions = useMemo(
    () =>
      buildCombatTargets({
        currentPlayerId: player?.id,
        ownFactionMemberIds,
        realtimePlayers: snapshot.players,
      }),
    [ownFactionMemberIds, player?.id, snapshot.players],
  );
  const selectedTarget = useMemo(
    () => targetOptions.find((target) => target.id === selectedTargetId) ?? targetOptions[0] ?? null,
    [selectedTargetId, targetOptions],
  );
  const participantOptions = useMemo(
    () =>
      buildAmbushParticipantOptions({
        currentPlayerId: player?.id,
        members: membersBook?.members ?? [],
      }),
    [membersBook?.members, player?.id],
  );
  const canRunAmbush =
    canLeadAmbush(player?.faction?.rank ?? null) &&
    Boolean(selectedTarget) &&
    selectedParticipantIds.length >= 1 &&
    selectedParticipantIds.length <= 4;
  const requestedTargetId = (location.state as CombatNavigationState | null)?.preselectedTargetId ?? null;

  useEffect(() => {
    if (!selectedTarget && targetOptions.length > 0) {
      const nextTargetId = targetOptions[0]?.id;

      if (nextTargetId) {
        setSelectedTargetId(nextTargetId);
      }
    }
  }, [selectedTarget, targetOptions]);

  useEffect(() => {
    if (!requestedTargetId) {
      return;
    }

    if (targetOptions.some((target) => target.id === requestedTargetId)) {
      setSelectedTargetId(requestedTargetId);
    }
  }, [requestedTargetId, targetOptions]);

  async function handleCombat(mode: CombatMode): Promise<void> {
    if (!selectedTarget) {
      setError('Selecione um alvo online antes de confirmar o combate.');
      return;
    }

    if (selectedTarget.disabledReason) {
      setError(selectedTarget.disabledReason);
      return;
    }

    if (mode === 'ambush' && !canRunAmbush) {
      setError('Emboscada exige entre 2 e 5 membros no total, incluindo voce.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response =
        mode === 'assault'
          ? await pvpApi.assault(selectedTarget.id)
          : await pvpApi.ambush(selectedTarget.id, selectedParticipantIds);
      setLastResult(response);
      await refreshPlayerProfile();
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao executar o combate.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadMembers(player?.faction?.id)} variant="secondary">
            {isLoadingMembers ? 'Sincronizando...' : 'Atualizar bonde'}
          </Button>
        }
        badges={[
          { label: snapshot.status, tone: snapshot.status === 'connected' ? 'success' : 'warning' },
          { label: `${targetOptions.length} alvos`, tone: 'info' },
          { label: `${participantOptions.length} membros`, tone: 'neutral' },
        ]}
        description="Combate PvP com alvos vindos do realtime regional, membros reais da faccao e execucao de assalto ou emboscada pelo backend."
        title="Combate"
      />

      {feedback ? <FeedbackCard message={feedback} title="Combate sincronizado" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha no combate" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Realtime" tone={snapshot.status === 'connected' ? 'success' : 'warning'} value={snapshot.status} />
        <MetricCard label="Jogadores" tone="info" value={`${snapshot.players.length}`} />
        <MetricCard label="Alvo" tone="warning" value={selectedTarget?.nickname ?? '--'} />
        <MetricCard label="Emboscada" tone={canRunAmbush ? 'success' : 'danger'} value={canRunAmbush ? 'Pronta' : 'Travada'} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Alvos online</h3>
            <Badge tone="neutral">{snapshot.roomName ?? 'offline'}</Badge>
          </div>
          <div className="desktop-scroll-list">
            {targetOptions.map((target) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedTarget?.id === target.id ? 'desktop-list-row--active' : ''}`}
                key={target.id}
                onClick={() => setSelectedTargetId(target.id)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{target.nickname}</strong>
                  <Badge tone={target.disabledReason ? 'danger' : 'success'}>
                    {target.disabledReason ?? 'Livre'}
                  </Badge>
                </div>
                <small>{target.subtitle}</small>
              </button>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <div>
                <h3>{selectedTarget?.nickname ?? 'Selecione um alvo'}</h3>
                <p>{selectedTarget?.subtitle ?? 'O alvo escolhido aparece aqui com o estado do ataque.'}</p>
              </div>
              <Badge tone={selectedTarget?.disabledReason ? 'danger' : 'info'}>
                {selectedTarget?.disabledReason ?? 'Alvo valido'}
              </Badge>
            </div>
            <div className="desktop-inline-actions">
              <Button data-desktop-primary-action="true" disabled={isMutating || !selectedTarget || Boolean(selectedTarget?.disabledReason)} onClick={() => void handleCombat('assault')} variant="primary">
                {isMutating ? 'Processando...' : 'Executar assalto'}
              </Button>
              <Button disabled={isMutating || !canRunAmbush} onClick={() => void handleCombat('ambush')} variant="secondary">
                {isMutating ? 'Processando...' : 'Executar emboscada'}
              </Button>
            </div>
            <div className="desktop-detail-list">
              <div>
                <strong>Cooldown esperado</strong>
                <small>{lastResult ? formatCombatCooldown(lastResult.targetCooldownSeconds) : 'Aguardando ultimo combate.'}</small>
              </div>
              <div>
                <strong>Lideranca</strong>
                <small>{canLeadAmbush(player?.faction?.rank ?? null) ? 'Voce pode liderar emboscada.' : 'Sua patente nao lidera emboscada.'}</small>
              </div>
            </div>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Participantes da emboscada</h3>
              <Badge tone="warning">{selectedParticipantIds.length + 1} no total</Badge>
            </div>
            <div className="desktop-scroll-list">
              {participantOptions.map((member) => {
                const isSelected = selectedParticipantIds.includes(member.id);

                return (
                  <button
                    className={`desktop-list-row desktop-list-row--clickable ${isSelected ? 'desktop-list-row--active' : ''}`}
                    disabled={!member.isEligible}
                    key={member.id}
                    onClick={() => {
                      setSelectedParticipantIds((current) => {
                        if (current.includes(member.id)) {
                          return current.filter((id) => id !== member.id);
                        }

                        if (current.length >= 4) {
                          return current;
                        }

                        return [...current, member.id];
                      });
                    }}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{member.nickname}</strong>
                      <Badge tone={member.isEligible ? 'success' : 'danger'}>{member.title}</Badge>
                    </div>
                    <small>{member.disabledReason ?? 'Apto a entrar na emboscada.'}</small>
                  </button>
                );
              })}
            </div>
          </Card>

          {lastResult ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <h3>{resolveCombatTierLabel(lastResult.tier)}</h3>
                <Badge tone={resolveCombatTierTone(lastResult.tier)}>
                  {lastResult.success ? 'Sucesso' : 'Falha'}
                </Badge>
              </div>
              <div className="desktop-grid-3">
                <MetricCard label="Razao de poder" tone="info" value={lastResult.powerRatio.toFixed(2)} />
                <MetricCard label="Cooldown alvo" tone="warning" value={formatCombatCooldown(lastResult.targetCooldownSeconds)} />
                <MetricCard label="Loot" tone="success" value={formatCombatCurrency(lastResult.loot?.amount ?? 0)} />
              </div>
              <div className="desktop-detail-list">
                {buildCombatResultHighlights(lastResult).map((line) => (
                  <div key={line}>
                    <strong>Leitura</strong>
                    <small>{line}</small>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}
