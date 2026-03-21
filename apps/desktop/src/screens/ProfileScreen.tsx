import { type PlayerPublicProfile } from '@cs-rio/shared';
import { useProfileOverview } from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Badge, Button, Card, ProgressBar } from '../components/ui';
import {
  getRegionLabel,
  getVocationLabel,
} from '../features/character/characterOptions';
import type {
  MessagesNavigationState,
  ProfileNavigationState,
} from '../router/navigationIntents';
import { playerApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function ProfileScreen(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const player = useAuthStore((state) => state.player);
  const [publicProfile, setPublicProfile] = useState<PlayerPublicProfile | null>(null);
  const [publicProfileError, setPublicProfileError] = useState<string | null>(null);
  const [isLoadingPublicProfile, setIsLoadingPublicProfile] = useState(false);
  const publicNickname =
    (location.state as ProfileNavigationState | null)?.publicNickname?.trim() ?? '';
  const showPublicProfile = Boolean(publicNickname && publicNickname !== player?.nickname);
  const {
    profileVisibilityCopy,
    profileVisibilityTitle,
    progression,
    vocationScopeLines,
  } = useProfileOverview(player);

  useEffect(() => {
    if (!showPublicProfile) {
      setPublicProfile(null);
      setPublicProfileError(null);
      return;
    }

    let isMounted = true;

    const loadPublicProfile = async () => {
      setIsLoadingPublicProfile(true);
      setPublicProfileError(null);

      try {
        const response = await playerApi.getPublicProfile(publicNickname);

        if (isMounted) {
          setPublicProfile(response);
        }
      } catch (error) {
        if (isMounted) {
          setPublicProfileError(
            error instanceof Error ? error.message : 'Falha ao carregar o perfil publico.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPublicProfile(false);
        }
      }
    };

    void loadPublicProfile();

    return () => {
      isMounted = false;
    };
  }, [publicNickname, showPublicProfile]);

  if (!player) {
    return <></>;
  }

  if (showPublicProfile) {
    return (
      <PublicProfileView
        error={publicProfileError}
        isLoading={isLoadingPublicProfile}
        nickname={publicNickname}
        profile={publicProfile}
        onBack={() => navigate('/profile', { replace: true, state: null })}
        onMessage={() =>
          navigate('/messages', {
            state: {
              prefillContactNickname: publicNickname,
            } satisfies MessagesNavigationState,
          })
        }
      />
    );
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => navigate('/vocation')} variant="secondary">
            Gerir vocacao
          </Button>
        }
        badges={[
          { label: getRegionLabel(player.regionId), tone: 'success' },
          { label: player.title, tone: 'warning' },
          { label: player.faction ? player.faction.abbreviation : 'Sem faccao', tone: 'neutral' },
        ]}
        description={`${getVocationLabel(player.vocation)} em ${getRegionLabel(player.regionId)}. Veja seus recursos, atributos e o peso atual da sua reputacao na rua.`}
        title="Ver perfil"
      />

      <div className="desktop-metric-grid">
        <MetricCard label="Nivel atual" tone="warning" value={`${progression.currentLevel}`} />
        <MetricCard label="Conceito" tone="info" value={`${progression.conceito}`} />
        <MetricCard label="Proximo nivel" tone="success" value={progression.nextLevel ? `${progression.nextLevel.level}` : 'Max'} />
        <MetricCard label="Faltando" tone="danger" value={`${progression.remainingConceito}`} />
      </div>

      <div className="desktop-profile-grid">
        <Card className="desktop-panel">
          <h3>Recursos</h3>
          <div className="desktop-resource-bars">
            <ProgressBar label="HP" tone="danger" value={player.resources.hp} />
            <ProgressBar label="Disposicao" tone="success" value={player.resources.disposicao} />
            <ProgressBar label="Cansaco" tone="warning" value={player.resources.cansaco} />
            <ProgressBar label="Brisa" tone="info" value={player.resources.brisa} />
            <ProgressBar label="Vicio" tone="danger" value={player.resources.addiction} />
          </div>
          <div className="desktop-grid-2">
            <MetricCard label="Caixa" tone="warning" value={`${player.resources.money}`} />
            <MetricCard label="Banco" tone="info" value={`${player.resources.bankMoney}`} />
          </div>
        </Card>

        <Card className="desktop-panel">
          <h3>Atributos</h3>
          <div className="desktop-detail-list">
            <div>
              <strong>Forca</strong>
              <small>{player.attributes.forca}</small>
            </div>
            <div>
              <strong>Inteligencia</strong>
              <small>{player.attributes.inteligencia}</small>
            </div>
            <div>
              <strong>Resistencia</strong>
              <small>{player.attributes.resistencia}</small>
            </div>
            <div>
              <strong>Carisma</strong>
              <small>{player.attributes.carisma}</small>
            </div>
          </div>
        </Card>
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>{profileVisibilityTitle}</h3>
            <Badge tone="info">Social MVP</Badge>
          </div>
          <p>{profileVisibilityCopy}</p>
          <div className="desktop-detail-list">
            <div>
              <strong>Inventario</strong>
              <small>{player.inventory.length} itens</small>
            </div>
            <div>
              <strong>Propriedades</strong>
              <small>{player.properties.length}</small>
            </div>
            <div>
              <strong>Prisao</strong>
              <small>{player.prison.isImprisoned ? 'Preso' : 'Livre'}</small>
            </div>
            <div>
              <strong>Hospital</strong>
              <small>{player.hospitalization.isHospitalized ? 'Internado' : 'Operante'}</small>
            </div>
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Escopo da vocacao</h3>
            <Badge tone="warning">{getVocationLabel(player.vocation)}</Badge>
          </div>
          <div className="desktop-detail-list">
            {vocationScopeLines.map((line) => (
              <div key={line}>
                <strong>Corpo da build</strong>
                <small>{line}</small>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

interface PublicProfileViewProps {
  error: string | null;
  isLoading: boolean;
  nickname: string;
  onBack: () => void;
  onMessage: () => void;
  profile: PlayerPublicProfile | null;
}

function PublicProfileView({
  error,
  isLoading,
  nickname,
  onBack,
  onMessage,
  profile,
}: PublicProfileViewProps): JSX.Element {
  const rankingLabel = useMemo(() => {
    if (!profile) {
      return '--';
    }

    return `#${profile.ranking.currentRank} / ${profile.ranking.totalPlayers}`;
  }, [profile]);

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <>
            <Button onClick={onBack} variant="secondary">
              Voltar ao meu perfil
            </Button>
            <Button data-desktop-primary-action="true" disabled={!profile} onClick={onMessage} variant="ghost">
              Abrir contatos
            </Button>
          </>
        }
        badges={[
          { label: profile ? getRegionLabel(profile.regionId) : 'Carregando', tone: 'success' },
          { label: profile?.title ?? 'Sem titulo', tone: 'warning' },
          { label: profile?.faction ? profile.faction.abbreviation : 'Sem faccao', tone: 'neutral' },
        ]}
        description="Ficha publica do alvo selecionado para leitura rapida antes de decidir contato ou abordagem."
        title="Ver perfil"
      />

      {isLoading ? <FeedbackCard message="Puxando a ficha publica do alvo." title="Carregando perfil" tone="info" /> : null}
      {error ? <FeedbackCard message={error} title="Falha no perfil" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Nivel" tone="warning" value={profile ? `${profile.level}` : '--'} />
        <MetricCard label="Conceito" tone="info" value={profile ? `${profile.conceito}` : '--'} />
        <MetricCard label="Ranking" tone="success" value={rankingLabel} />
        <MetricCard label="Vocacao" tone="neutral" value={profile ? getVocationLabel(profile.vocation) : '--'} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <h3>Resumo publico</h3>
          <div className="desktop-detail-list">
            <div>
              <strong>Faccao</strong>
              <small>{profile?.faction ? `${profile.faction.abbreviation} · ${profile.faction.name}` : 'Sem faccao visivel'}</small>
            </div>
            <div>
              <strong>Regiao</strong>
              <small>{profile ? getRegionLabel(profile.regionId) : '--'}</small>
            </div>
            <div>
              <strong>Localizacao</strong>
              <small>
                {profile
                  ? profile.visibility.preciseLocationVisible
                    ? `${profile.location.positionX}, ${profile.location.positionY}`
                    : 'Oculta pelo nivel de visibilidade'
                  : '--'}
              </small>
            </div>
          </div>
        </Card>

        <Card className="desktop-panel">
          <h3>Visibilidade</h3>
          <div className="desktop-detail-list">
            <div>
              <strong>Inventario exposto</strong>
              <small>{profile ? `${profile.visibility.inventoryItemCount} itens` : '--'}</small>
            </div>
            <div>
              <strong>Patrimonio exposto</strong>
              <small>{profile ? `${profile.visibility.propertyCount} ativos` : '--'}</small>
            </div>
            <div>
              <strong>Precisao</strong>
              <small>{profile?.visibility.preciseLocationVisible ? 'Posicao precisa liberada' : 'Somente regiao publica'}</small>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
