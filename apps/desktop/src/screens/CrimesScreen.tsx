import {
  formatCrimeChance,
  formatCrimeCooldown,
  formatCrimeCurrency,
  formatCrimeRewardReadLabel,
  resolveCrimeResultHeadline,
  resolveCrimeResultTone,
  useCrimesController,
} from '@cs-rio/ui/hooks';

import { Badge, Button, Card } from '../components/ui';
import { crimesApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function CrimesScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const {
    attemptSelectedCrime,
    error,
    feedback,
    groupedCrimes,
    isAttempting,
    isLoading,
    result,
    selectCrime,
    selectedCrime,
  } = useCrimesController({
    crimesApi,
    refreshPlayerProfile,
  });

  if (!player) {
    return <></>;
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        badges={[
          { label: `${player.level} LVL`, tone: 'neutral' },
          { label: `${player.resources.conceito} conceito`, tone: 'warning' },
          { label: `${player.resources.money} caixa`, tone: 'info' },
        ]}
        description="Crimes solo carregados do backend. A tela desktop agora trabalha com catalogo real, cooldown, poder minimo e retorno do crime executado."
        title="Crimes"
      />

      {feedback ? <FeedbackCard message={feedback} title="Loop criminal sincronizado" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha ao operar crimes" tone="danger" /> : null}

      <div className="desktop-crime-grid">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Catalogo</h3>
            <Badge tone={isLoading ? 'warning' : 'info'}>
              {isLoading ? 'Carregando' : `${groupedCrimes.length} grupos`}
            </Badge>
          </div>
          <div className="desktop-scroll-list">
            {groupedCrimes.map((group) => (
              <div className="desktop-panel" key={group.level}>
                <h4>{group.label}</h4>
                {group.crimes.map((crime) => (
                  <button
                    className={`desktop-list-row desktop-list-row--clickable ${selectedCrime?.id === crime.id ? 'desktop-list-row--active' : ''}`}
                    key={crime.id}
                    onClick={() => selectCrime(crime.id)}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{crime.name}</strong>
                      <Badge tone={crime.isRunnable ? 'success' : crime.isOnCooldown ? 'warning' : 'danger'}>
                        {crime.isRunnable ? 'Pronto' : crime.isOnCooldown ? 'Cooldown' : 'Travado'}
                      </Badge>
                    </div>
                    <small>
                      Poder {crime.playerPower}/{crime.minPower} · sucesso {formatCrimeChance(crime.estimatedSuccessChance)}
                    </small>
                    <small>
                      {formatCrimeCurrency(crime.rewardMin)} a {formatCrimeCurrency(crime.rewardMax)} · {formatCrimeRewardReadLabel(crime.rewardRead)}
                    </small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          {selectedCrime ? (
            <>
              <div className="desktop-metric-grid">
                <MetricCard label="Sucesso" tone="success" value={formatCrimeChance(selectedCrime.estimatedSuccessChance)} />
                <MetricCard label="Arresto" tone="danger" value={formatCrimeChance(selectedCrime.arrestChance)} />
                <MetricCard label="Poder minimo" tone="warning" value={`${selectedCrime.minPower}`} />
                <MetricCard label="Cooldown" tone="info" value={formatCrimeCooldown(selectedCrime.cooldownRemainingSeconds)} />
              </div>

              <Card className="desktop-panel">
                <div className="desktop-panel__header">
                  <div>
                    <h3>{selectedCrime.name}</h3>
                    <p>
                      Tipo {selectedCrime.type} · nivel {selectedCrime.levelRequired} · conceito +{selectedCrime.conceitoReward}
                    </p>
                  </div>
                  <Button
                    disabled={!selectedCrime.isRunnable || isAttempting}
                    onClick={() => void attemptSelectedCrime()}
                    variant={selectedCrime.isRunnable ? 'primary' : 'ghost'}
                  >
                    {isAttempting ? 'Executando...' : 'Executar crime'}
                  </Button>
                </div>
                <div className="desktop-detail-list">
                  <div>
                    <strong>Custo imediato</strong>
                    <small>
                      Disposicao {selectedCrime.disposicaoCost} · Cansaco {selectedCrime.cansacoCost}
                    </small>
                  </div>
                  <div>
                    <strong>Janela de retorno</strong>
                    <small>
                      {formatCrimeCurrency(selectedCrime.rewardMin)} a {formatCrimeCurrency(selectedCrime.rewardMax)} · {formatCrimeRewardReadLabel(selectedCrime.rewardRead)}
                    </small>
                  </div>
                  <div>
                    <strong>Status operacional</strong>
                    <small>{selectedCrime.lockReason ?? 'Crime liberado para rodar agora.'}</small>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card className="desktop-panel">
              <strong>Nenhum crime selecionado.</strong>
              <p>Escolha um item do catalogo para ver cooldown, chance real e retorno esperado.</p>
            </Card>
          )}

          {result ? (
            <Card className="desktop-panel">
              <div className="desktop-panel__header">
                <h3>{resolveCrimeResultHeadline(result)}</h3>
                <Badge tone={mapCrimeResultTone(resolveCrimeResultTone(result))}>
                  {result.success ? 'Sucesso' : result.arrested ? 'Preso' : 'Falhou'}
                </Badge>
              </div>
              <p>{result.message}</p>
              <div className="desktop-grid-3">
                <MetricCard label="Caixa" tone={result.moneyDelta >= 0 ? 'success' : 'danger'} value={formatCrimeCurrency(result.moneyDelta)} />
                <MetricCard label="Conceito" tone="warning" value={`${result.conceitoDelta >= 0 ? '+' : ''}${result.conceitoDelta}`} />
                <MetricCard label="Heat" tone="danger" value={`${result.heatBefore} → ${result.heatAfter}`} />
              </div>
              <div className="desktop-detail-list">
                <div>
                  <strong>Recursos apos a corrida</strong>
                  <small>
                    HP {result.resources.hp} · Disposicao {result.resources.disposicao} · Cansaco {result.resources.cansaco}
                  </small>
                </div>
                <div>
                  <strong>Drop</strong>
                  <small>
                    {result.drop
                      ? `${result.drop.itemName} x${result.drop.quantity}`
                      : 'Sem drop neste crime.'}
                  </small>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function mapCrimeResultTone(
  tone: 'danger' | 'success' | 'warning',
): 'danger' | 'success' | 'warning' {
  return tone;
}
