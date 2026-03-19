import { type PlayerCreationInput, VocationType } from '@cs-rio/shared';
import { type CSSProperties, useMemo, useState } from 'react';

import { Badge, Button, Card, useToast } from '../components/ui';
import {
  hairOptions,
  outfitOptions,
  skinOptions,
  vocationOptions,
} from '../features/character/characterOptions';
import { useAuthStore } from '../stores/authStore';

export function CharacterCreationScreen(): JSX.Element {
  const createCharacter = useAuthStore((state) => state.createCharacter);
  const player = useAuthStore((state) => state.player);
  const isLoading = useAuthStore((state) => state.isLoading);
  const { pushToast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vocation, setVocation] = useState<VocationType>(VocationType.Cria);
  const [skin, setSkin] = useState('pele_media');
  const [hair, setHair] = useState('corte_curto');
  const [outfit, setOutfit] = useState('camisa_branca');

  const selectedVocation = useMemo(
    () => vocationOptions.find((option) => option.id === vocation) ?? vocationOptions[0],
    [vocation],
  );

  const handleSubmit = async () => {
    const payload: PlayerCreationInput = {
      appearance: {
        hair,
        outfit,
        skin,
      },
      vocation,
    };

    try {
      setErrorMessage(null);
      await createCharacter(payload);
      pushToast({
        description: 'Personagem persistido. O guard ja pode liberar as rotas de gameplay.',
        title: 'Personagem criado',
        tone: 'success',
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Falha inesperada ao criar o personagem.',
      );
    }
  };

  return (
    <section className="character-screen">
      <div className="character-screen__summary">
        <Badge tone="warning">/create-char</Badge>
        <h2>Entrada no jogo</h2>
        <p>
          A conta <strong>{player?.nickname ?? 'autenticada'}</strong> ja existe. Falta definir a
          vocacao inicial e a aparencia basica para o mapa liberar o gameplay.
        </p>

        <Card className="character-screen__preview">
          <div className="character-screen__avatar">
            <span style={{ backgroundColor: skinOptions.find((option) => option.id === skin)?.swatch }} />
          </div>
          <div className="character-screen__preview-copy">
            <strong>{selectedVocation.label}</strong>
            <span>{selectedVocation.summary}</span>
            <small>{selectedVocation.stats}</small>
          </div>
        </Card>
      </div>

      <div className="character-screen__builder">
        <Card className="character-screen__section">
          <h3>Vocacao</h3>
          <div className="character-screen__grid">
            {vocationOptions.map((option) => (
              <ChoiceCard
                description={option.summary}
                isSelected={vocation === option.id}
                key={option.id}
                label={option.label}
                meta={option.stats}
                onClick={() => setVocation(option.id)}
              />
            ))}
          </div>
        </Card>

        <Card className="character-screen__section">
          <h3>Pele</h3>
          <div className="character-screen__tones">
            {skinOptions.map((option) => (
              <button
                className={`character-screen__tone ${skin === option.id ? 'character-screen__tone--active' : ''}`}
                key={option.id}
                onClick={() => setSkin(option.id)}
                style={{ '--tone': option.swatch } as CSSProperties}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="character-screen__section">
          <h3>Cabelo</h3>
          <div className="character-screen__pills">
            {hairOptions.map((option) => (
              <ChoicePill
                isSelected={hair === option.id}
                key={option.id}
                label={option.label}
                onClick={() => setHair(option.id)}
              />
            ))}
          </div>
        </Card>

        <Card className="character-screen__section">
          <h3>Roupa</h3>
          <div className="character-screen__pills">
            {outfitOptions.map((option) => (
              <ChoicePill
                isSelected={outfit === option.id}
                key={option.id}
                label={option.label}
                onClick={() => setOutfit(option.id)}
              />
            ))}
          </div>
        </Card>

        {errorMessage ? <p className="auth-screen__error">{errorMessage}</p> : null}

        <div className="character-screen__actions">
          <Button isBusy={isLoading} onClick={() => void handleSubmit()} size="lg">
            Confirmar e entrar no jogo
          </Button>
        </div>
      </div>
    </section>
  );
}

function ChoiceCard({
  description,
  isSelected,
  label,
  meta,
  onClick,
}: {
  description: string;
  isSelected: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={`character-screen__choice-card ${isSelected ? 'character-screen__choice-card--active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <strong>{label}</strong>
      <span>{meta}</span>
      <small>{description}</small>
    </button>
  );
}

function ChoicePill({
  isSelected,
  label,
  onClick,
}: {
  isSelected: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={`character-screen__pill ${isSelected ? 'character-screen__pill--active' : ''}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
