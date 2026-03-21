import {
  UNIVERSITY_EMPTY_PASSIVE_PROFILE,
  type PlayerAttributes,
  type PlayerVocationAvailability,
  type PlayerVocationOptionSummary,
  type PlayerVocationStatus,
  type UniversityVocationProgressionSummary,
  type VocationType,
} from '@cs-rio/shared';
import {
  buildVocationScopeLines,
  formatUniversityRemaining,
  formatUniversityVocation,
  summarizeUniversityPassives,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card } from '../components/ui';
import { playerApi, universityApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function VocationScreen(): JSX.Element {
  const navigate = useNavigate();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof playerApi.getVocationCenter>> | null>(null);
  const [universityCenter, setUniversityCenter] = useState<Awaited<ReturnType<typeof universityApi.getCenter>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [changingTo, setChangingTo] = useState<VocationType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentVocation = center?.status.currentVocation ?? player?.vocation ?? null;
  const currentVocationLabel =
    currentVocation ? formatUniversityVocation(currentVocation) : 'Sem vocacao definida';
  const progression = universityCenter?.progression ?? null;
  const passiveLines = useMemo(
    () => summarizeUniversityPassives(universityCenter?.passiveProfile ?? UNIVERSITY_EMPTY_PASSIVE_PROFILE),
    [universityCenter?.passiveProfile],
  );
  const impactLines = useMemo(
    () =>
      buildVocationImpactLines({
        passiveLines,
        progression,
      }),
    [passiveLines, progression],
  );
  const availabilityCopy = center
    ? buildVocationAvailabilityCopy({
        availability: center.availability,
        status: center.status,
      })
    : 'Carregando a central de vocacao.';
  const nextChangeLabel = center
    ? center.status.cooldownRemainingSeconds > 0
      ? formatUniversityRemaining(center.status.cooldownRemainingSeconds)
      : 'Agora'
    : '--';

  useEffect(() => {
    void loadCenters();
  }, []);

  async function loadCenters(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [nextCenter, nextUniversityCenter] = await Promise.all([
        playerApi.getVocationCenter(),
        universityApi.getCenter(),
      ]);
      setCenter(nextCenter);
      setUniversityCenter(nextUniversityCenter);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a central de vocacao.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChangeVocation(targetVocation: VocationType): Promise<void> {
    if (!center) {
      return;
    }

    const option = center.options.find((entry) => entry.id === targetVocation) ?? null;

    if (!option) {
      setError('Vocacao selecionada nao encontrada.');
      return;
    }

    if (option.isCurrent) {
      setError(`${option.label} ja esta ativa neste personagem.`);
      return;
    }

    if (!center.availability.available) {
      setError(center.availability.reason ?? 'A troca de vocacao nao esta disponivel agora.');
      return;
    }

    setChangingTo(targetVocation);
    setError(null);
    setFeedback(null);

    try {
      const response = await playerApi.changeVocation({
        vocation: targetVocation,
      });
      setCenter(response.center);
      await Promise.allSettled([universityApi.getCenter(), refreshPlayerProfile()]).then((results) => {
        const nextUniversityCenter = results[0];

        if (nextUniversityCenter.status === 'fulfilled') {
          setUniversityCenter(nextUniversityCenter.value);
        }
      });
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao trocar a vocacao.');
    } finally {
      setChangingTo(null);
    }
  }

  if (!player) {
    return <></>;
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <>
            <Button onClick={() => navigate('/university')} variant="secondary">
              Estudar
            </Button>
            <Button onClick={() => void loadCenters()} variant="ghost">
              {isLoading ? 'Sincronizando...' : 'Atualizar vocacao'}
            </Button>
          </>
        }
        badges={[
          { label: currentVocationLabel, tone: 'info' },
          { label: center ? formatVocationStateLabel(center.status) : 'Carregando', tone: 'warning' },
          { label: `${passiveLines.length} passivos`, tone: 'success' },
        ]}
        description="Veja a build ativa, o cooldown global de troca e o impacto real da trilha exclusiva ligada a sua vocacao."
        title="Gerir vocacao"
      />

      {feedback ? <FeedbackCard message={feedback} title="Vocacao atualizada" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha na vocacao" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Vocacao" tone="info" value={currentVocationLabel} />
        <MetricCard label="Estado" tone="warning" value={center ? formatVocationStateLabel(center.status) : '--'} />
        <MetricCard label="Creditos" tone="neutral" value={formatVocationCreditsCost(center?.player.credits ?? 0)} />
        <MetricCard label="Proxima troca" tone="success" value={nextChangeLabel} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Escopo atual</h3>
            <Badge tone="info">{currentVocationLabel}</Badge>
          </div>
          <div className="desktop-detail-list">
            {buildVocationScopeLines(currentVocationLabel).map((line) => (
              <div key={line}>
                <strong>Build</strong>
                <small>{line}</small>
              </div>
            ))}
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Janela de troca</h3>
            <Badge tone={center?.availability.available ? 'success' : 'warning'}>
              {center?.availability.available ? 'Liberada' : 'Travada'}
            </Badge>
          </div>
          <p>{availabilityCopy}</p>
          <div className="desktop-grid-3">
            <MetricCard label="Cooldown" tone="warning" value={center ? `${center.cooldownHours}h` : '--'} />
            <MetricCard label="Nivel" tone="neutral" value={center ? `${center.player.level}` : `${player.level}`} />
            <MetricCard label="Custo" tone="info" value={formatVocationCreditsCost(center?.availability.creditsCost ?? 0)} />
          </div>
          {center?.status.pendingVocation ? (
            <p>Proxima vocacao pendente: {formatUniversityVocation(center.status.pendingVocation)}.</p>
          ) : null}
        </Card>
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Impacto da trilha</h3>
            <Badge tone="warning">{progression ? formatVocationProgressStageLabel(progression) : 'Sem trilha lida'}</Badge>
          </div>
          <div className="desktop-detail-list">
            {impactLines.map((line) => (
              <div key={line}>
                <strong>Progressao</strong>
                <small>{line}</small>
              </div>
            ))}
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Passivos em jogo</h3>
            <Badge tone="success">{passiveLines.length}</Badge>
          </div>
          <div className="desktop-detail-list">
            {passiveLines.length > 0 ? (
              passiveLines.map((line) => (
                <div key={line}>
                  <strong>Perk</strong>
                  <small>{line}</small>
                </div>
              ))
            ) : (
              <div>
                <strong>Perk</strong>
                <small>Nenhum bonus permanente liberado ainda.</small>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="desktop-panel">
        <div className="desktop-panel__header">
          <h3>Builds disponiveis</h3>
          <Badge tone="neutral">{center?.options.length ?? 0} opcoes</Badge>
        </div>
        <div className="desktop-scroll-list">
          {(center?.options ?? []).map((option) => (
            <div className="desktop-list-row" key={option.id}>
              <div className="desktop-list-row__headline">
                <strong>{option.label}</strong>
                <Badge tone={option.isCurrent ? 'success' : 'info'}>
                  {option.isCurrent ? 'Ativa' : 'Disponivel'}
                </Badge>
              </div>
              <small>
                Foco {formatVocationOptionAttributePair(option)} · custo {formatVocationCreditsCost(center?.availability.creditsCost ?? 0)}
              </small>
              <small>
                Principal {formatVocationAttributeLabel(option.primaryAttribute)} · Secundario {formatVocationAttributeLabel(option.secondaryAttribute)}
              </small>
              <small>{resolveOptionStatusCopy(center, option)}</small>
              <Button
                disabled={
                  changingTo !== null ||
                  option.isCurrent ||
                  !Boolean(center?.availability.available)
                }
                onClick={() => void handleChangeVocation(option.id)}
                variant={option.isCurrent ? 'ghost' : 'secondary'}
              >
                {changingTo === option.id ? 'Processando...' : option.isCurrent ? 'Vocacao ativa' : `Trocar por ${formatVocationCreditsCost(center?.availability.creditsCost ?? 0)}`}
              </Button>
            </div>
          ))}
          {!center?.options.length ? <p>Nenhuma build foi carregada para troca agora.</p> : null}
        </div>
      </Card>
    </section>
  );
}

function formatVocationAttributeLabel(attribute: keyof PlayerAttributes): string {
  if (attribute === 'forca') {
    return 'Forca';
  }

  if (attribute === 'inteligencia') {
    return 'Inteligencia';
  }

  if (attribute === 'resistencia') {
    return 'Resistencia';
  }

  return 'Carisma';
}

function formatVocationOptionAttributePair(option: PlayerVocationOptionSummary): string {
  return `${formatVocationAttributeLabel(option.primaryAttribute)} + ${formatVocationAttributeLabel(option.secondaryAttribute)}`;
}

function formatVocationStateLabel(status: PlayerVocationStatus): string {
  if (status.state === 'transition') {
    return 'Transicao';
  }

  if (status.state === 'cooldown') {
    return 'Cooldown';
  }

  return 'Pronta';
}

function formatVocationProgressStageLabel(
  progression: UniversityVocationProgressionSummary,
): string {
  if (progression.stage === 'mastered') {
    return 'dominada';
  }

  if (progression.stage === 'developing') {
    return 'em evolucao';
  }

  return 'em abertura';
}

function formatVocationCreditsCost(cost: number): string {
  return `${cost.toLocaleString('pt-BR')} cr`;
}

function buildVocationAvailabilityCopy(input: {
  availability: PlayerVocationAvailability;
  status: PlayerVocationStatus;
}): string {
  const { availability, status } = input;

  if (availability.available) {
    return `Troca liberada agora por ${formatVocationCreditsCost(availability.creditsCost)} em creditos premium.`;
  }

  if (status.state === 'transition' && status.pendingVocation) {
    return `Transicao para ${formatUniversityVocation(status.pendingVocation)} em andamento. ${availability.reason ?? 'Aguarde a conclusao da mudanca.'}`;
  }

  if (status.cooldownRemainingSeconds > 0) {
    return `${availability.reason ?? 'A troca esta em cooldown.'} Falta ${formatUniversityRemaining(status.cooldownRemainingSeconds)}.`;
  }

  return availability.reason ?? 'A troca de vocacao nao esta disponivel agora.';
}

function buildVocationImpactLines(input: {
  passiveLines: string[];
  progression: UniversityVocationProgressionSummary | null;
}): string[] {
  const { passiveLines, progression } = input;

  if (!progression) {
    return passiveLines.length > 0
      ? passiveLines.slice(0, 4)
      : ['Sua build ainda nao desbloqueou perks permanentes.'];
  }

  const lines = [
    `Trilha ${formatVocationProgressStageLabel(progression)} · ${progression.completedPerks}/${progression.totalPerks} perks concluidos.`,
  ];

  if (progression.nextPerk) {
    lines.push(`Proxima vantagem: ${progression.nextPerk.label} - ${progression.nextPerk.effectSummary}`);
  } else {
    lines.push('Todas as vantagens exclusivas da sua vocacao ja foram liberadas.');
  }

  if (passiveLines.length === 0) {
    lines.push('Nenhum bonus permanente ativo ainda.');
  } else {
    lines.push(...passiveLines.slice(0, 3));
  }

  return lines;
}

function resolveOptionStatusCopy(
  center: Awaited<ReturnType<typeof playerApi.getVocationCenter>> | null,
  option: PlayerVocationOptionSummary,
): string {
  if (option.isCurrent) {
    return 'Essa e a build ativa neste momento.';
  }

  if (!center?.availability.available) {
    return center?.availability.reason ?? 'A troca global de vocacao esta travada agora.';
  }

  return 'Pronta para troca imediata.';
}
