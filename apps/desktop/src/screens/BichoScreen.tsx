import {
  BICHO_MAX_BET,
  BICHO_MIN_BET,
  BICHO_PAYOUT_MULTIPLIERS,
  type BichoAnimalSummary,
  type BichoBetMode,
} from '@cs-rio/shared';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card } from '../components/ui';
import { bichoApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
  formatMoney,
} from './shared/DesktopScreenPrimitives';

const BET_MODES: Array<{
  description: string;
  id: BichoBetMode;
  label: string;
}> = [
  {
    description: 'Aposta no grupo vencedor do sorteio. Mais direta, retorno medio.',
    id: 'grupo',
    label: 'Grupo',
  },
  {
    description: 'Aposta no animal que sai na cabeca do sorteio. Mais risco, retorno maior.',
    id: 'cabeca',
    label: 'Cabeca',
  },
  {
    description: 'Aposta na dezena vencedora. Mais arriscada e com multiplicador mais alto.',
    id: 'dezena',
    label: 'Dezena',
  },
];

export function BichoScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [book, setBook] = useState<Awaited<ReturnType<typeof bichoApi.getState>> | null>(null);
  const [selectedMode, setSelectedMode] = useState<BichoBetMode>('grupo');
  const [selectedAnimalNumber, setSelectedAnimalNumber] = useState<number | null>(1);
  const [dozenInput, setDozenInput] = useState('');
  const [amountInput, setAmountInput] = useState(String(BICHO_MIN_BET));

  const selectedAnimal = useMemo(
    () => book?.animals.find((animal) => animal.number === selectedAnimalNumber) ?? null,
    [book?.animals, selectedAnimalNumber],
  );
  const parsedAmount = useMemo(() => sanitizeInteger(amountInput), [amountInput]);
  const parsedDozen = useMemo(() => sanitizeDozen(dozenInput), [dozenInput]);
  const expectedPayout = useMemo(
    () => parsedAmount * BICHO_PAYOUT_MULTIPLIERS[selectedMode],
    [parsedAmount, selectedMode],
  );
  const timeUntilCloseLabel = useMemo(() => {
    if (!book?.currentDraw) {
      return '--';
    }

    return formatRemainingSeconds(
      Math.max(0, Math.floor((new Date(book.currentDraw.closesAt).getTime() - nowMs) / 1000)),
    );
  }, [book?.currentDraw, nowMs]);

  useEffect(() => {
    void loadBook();
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  async function loadBook(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await bichoApi.getState();
      setBook(response);
      setSelectedAnimalNumber((current) => current ?? response.animals[0]?.number ?? 1);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a banca do bicho.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePlaceBet(): Promise<void> {
    if (!book) {
      return;
    }

    if (parsedAmount < BICHO_MIN_BET || parsedAmount > BICHO_MAX_BET) {
      setError(`A banca aceita apostas entre ${formatMoney(BICHO_MIN_BET)} e ${formatMoney(BICHO_MAX_BET)}.`);
      return;
    }

    if (selectedMode === 'dezena' && parsedDozen === null) {
      setError('Informe uma dezena valida entre 00 e 99.');
      return;
    }

    if ((selectedMode === 'grupo' || selectedMode === 'cabeca') && !selectedAnimal) {
      setError('Escolha um animal antes de confirmar a banca.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await bichoApi.placeBet({
        amount: parsedAmount,
        animalNumber: selectedMode === 'dezena' ? undefined : selectedAnimal?.number,
        dozen: selectedMode === 'dezena' ? parsedDozen ?? undefined : undefined,
        mode: selectedMode,
      });
      await Promise.all([loadBook(), refreshPlayerProfile()]);
      setFeedback(`${formatBetMode(response.bet.mode)} registrada no sorteio #${response.currentDraw.sequence}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao registrar a aposta.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadBook()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar banca'}
          </Button>
        }
        badges={[
          { label: formatMoney(player?.resources.money ?? 0), tone: 'warning' },
          { label: book ? `#${book.currentDraw.sequence}` : '--', tone: 'info' },
          { label: `${book?.bets.filter((bet) => bet.status === 'pending').length ?? 0} pendentes`, tone: 'success' },
        ]}
        description="Jogo do bicho manual com escolha de grupo, cabeca ou dezena, leitura do sorteio atual e historico das ultimas bancas."
        title="Jogo do Bicho"
      />

      {feedback ? <FeedbackCard message={feedback} title="Banca sincronizada" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha na banca" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Sorteio" tone="info" value={book ? `#${book.currentDraw.sequence}` : '--'} />
        <MetricCard label="Fecha em" tone="warning" value={timeUntilCloseLabel} />
        <MetricCard label="Retorno brut." tone="success" value={formatMoney(expectedPayout)} />
        <MetricCard label="Pendentes" tone="neutral" value={`${book?.bets.filter((bet) => bet.status === 'pending').length ?? 0}`} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Escolha da jogada</h3>
            <Badge tone="info">{book ? `fecha ${new Date(book.currentDraw.closesAt).toLocaleTimeString('pt-BR')}` : '--'}</Badge>
          </div>
          <div className="desktop-scroll-list">
            {BET_MODES.map((mode) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedMode === mode.id ? 'desktop-list-row--active' : ''}`}
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{mode.label}</strong>
                  <Badge tone="warning">{BICHO_PAYOUT_MULTIPLIERS[mode.id]}x</Badge>
                </div>
                <small>{mode.description}</small>
              </button>
            ))}
          </div>
          <div className="desktop-grid-2">
            {selectedMode === 'dezena' ? (
              <FormField label="Dezena">
                <input maxLength={2} onChange={(event) => setDozenInput(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))} value={dozenInput} />
              </FormField>
            ) : (
              <FormField label="Animal">
                <select onChange={(event) => setSelectedAnimalNumber(Number(event.target.value))} value={selectedAnimalNumber ?? undefined}>
                  {(book?.animals ?? []).map((animal) => (
                    <option key={animal.number} value={animal.number}>
                      {animal.number}. {animal.label}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="Valor da aposta">
              <input onChange={(event) => setAmountInput(event.target.value.replace(/[^0-9]/g, ''))} value={amountInput} />
            </FormField>
          </div>
          <Button disabled={isMutating} onClick={() => void handlePlaceBet()} variant="primary">
            {isMutating ? 'Processando...' : 'Confirmar aposta'}
          </Button>
        </Card>

        <div className="desktop-screen__stack">
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Minha selecao</h3>
              <Badge tone="warning">{selectedMode}</Badge>
            </div>
            <div className="desktop-detail-list">
              <div>
                <strong>Jogada</strong>
                <small>
                  {selectedMode === 'dezena'
                    ? `Dezena ${parsedDozen === null ? '--' : formatDozen(parsedDozen)}`
                    : selectedAnimal
                      ? `${selectedAnimal.label} · grupo ${selectedAnimal.groupNumbers.join('-')}`
                      : '--'}
                </small>
              </div>
              <div>
                <strong>Aposta</strong>
                <small>{formatMoney(parsedAmount)}</small>
              </div>
              <div>
                <strong>Retorno bruto</strong>
                <small>{formatMoney(expectedPayout)}</small>
              </div>
            </div>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Minhas apostas</h3>
              <Badge tone="info">{book?.bets.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(book?.bets ?? []).slice(0, 8).map((bet) => (
                <div className="desktop-list-row" key={bet.id}>
                  <div className="desktop-list-row__headline">
                    <strong>{formatBetMode(bet.mode)}</strong>
                    <Badge tone={bet.status === 'won' ? 'success' : bet.status === 'lost' ? 'danger' : 'warning'}>
                      {bet.status}
                    </Badge>
                  </div>
                  <small>
                    {bet.mode === 'dezena'
                      ? `Dezena ${formatDozen(bet.dozen ?? 0)}`
                      : resolveAnimalLabel(book?.animals ?? [], bet.animalNumber)}
                  </small>
                  <small>{formatMoney(bet.amount)} · retorno {formatMoney(bet.payout)}</small>
                </div>
              ))}
            </div>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Ultimos resultados</h3>
              <Badge tone="success">{book?.recentDraws.length ?? 0}</Badge>
            </div>
            <div className="desktop-scroll-list">
              {(book?.recentDraws ?? []).slice(0, 6).map((draw) => (
                <div className="desktop-list-row" key={draw.id}>
                  <div className="desktop-list-row__headline">
                    <strong>Sorteio #{draw.sequence}</strong>
                    <small>{new Date(draw.settledAt).toLocaleString('pt-BR')}</small>
                  </div>
                  <small>Grupo {draw.winningAnimalNumber} · Dezena {formatDozen(draw.winningDozen)}</small>
                  <small>Entrou {formatMoney(draw.totalBetAmount)} · saiu {formatMoney(draw.totalPayoutAmount)}</small>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function sanitizeInteger(value: string): number {
  return Math.max(0, Number.parseInt(value.replace(/\D/g, ''), 10) || 0);
}

function sanitizeDozen(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99) {
    return null;
  }

  return parsed;
}

function formatDozen(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatRemainingSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return 'Fechando';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatBetMode(mode: BichoBetMode): string {
  if (mode === 'grupo') {
    return 'Grupo';
  }

  if (mode === 'cabeca') {
    return 'Cabeca';
  }

  return 'Dezena';
}

function resolveAnimalLabel(animals: BichoAnimalSummary[], animalNumber: number | null): string {
  if (!animalNumber) {
    return '--';
  }

  const animal = animals.find((entry) => entry.number === animalNumber);
  return animal ? `${animal.number}. ${animal.label}` : `${animalNumber}`;
}
