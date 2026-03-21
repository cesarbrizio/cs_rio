import { RANKING_SCREEN_DESCRIPTION, useRankingController } from '@cs-rio/ui/hooks';
import { useEffect } from 'react';

import { Badge, Button, Card } from '../components/ui';
import { roundApi } from '../services/api';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
  formatTimestamp,
} from './shared/DesktopScreenPrimitives';

export function RankingScreen(): JSX.Element {
  const { center, error, isLoading, loadCenter } = useRankingController({
    roundApi,
  });

  useEffect(() => {
    void loadCenter().catch(() => undefined);
  }, [loadCenter]);

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadCenter().catch(() => undefined)} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar ranking'}
          </Button>
        }
        badges={[
          { label: `rodada #${center?.round.number ?? '--'}`, tone: 'warning' },
          { label: `${center?.leaderboard.length ?? 0} no topo`, tone: 'info' },
          { label: `${center?.topTenCreditReward ?? 0} creditos`, tone: 'success' },
        ]}
        description={RANKING_SCREEN_DESCRIPTION}
        title="Ranking"
      />

      {error ? <FeedbackCard message={error} title="Falha no ranking" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Rodada" tone="warning" value={`#${center?.round.number ?? '--'}`} />
        <MetricCard label="Dia atual" tone="info" value={`${center?.npcInflation.currentGameDay ?? 0}/${center?.round.totalGameDays ?? 0}`} />
        <MetricCard label="Fecha" tone="neutral" value={formatTimestamp(center?.round.endsAt)} />
        <MetricCard label="Premio top 10" tone="success" value={`${center?.topTenCreditReward ?? 0}`} />
      </div>

      <Card className="desktop-panel">
        <div className="desktop-panel__header">
          <h3>Leaderboard</h3>
          <Badge tone="neutral">{center?.round.status ?? '--'}</Badge>
        </div>
        <div className="desktop-table">
          {(center?.leaderboard ?? []).map((entry) => (
            <div className="desktop-table__row" key={entry.playerId}>
              <div className="desktop-table__row-header">
                <strong>#{entry.rank} · {entry.nickname}</strong>
                <Badge tone={entry.rank <= 3 ? 'warning' : 'neutral'}>
                  {entry.factionAbbreviation ?? 'Solo'}
                </Badge>
              </div>
              <small>Nivel {entry.level} · {entry.conceito} conceito</small>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
