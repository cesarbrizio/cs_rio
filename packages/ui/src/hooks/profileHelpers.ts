import { LEVELS, type PlayerProfile } from '@cs-rio/shared';

export const PROFILE_VISIBILITY_TITLE = 'Visibilidade atual';

export const PROFILE_VISIBILITY_COPY =
  'Esse e o recorte que ja fica visivel hoje no jogo. Perfil publico dedicado entra no social MVP.';

export function buildVocationScopeLines(vocation: string | null | undefined): string[] {
  const vocationLine =
    vocation && vocation.trim().length > 0
      ? `${vocation} segue como a sua vocacao ativa nesta rodada.`
      : 'Sua vocacao ativa segue definida na criacao do personagem.';

  return [
    vocationLine,
    'A Central de Vocacao ja permite trocar de build com custo em creditos premium e cooldown global de 24h.',
    'Use a Universidade do Crime para acompanhar a trilha exclusiva, os perks liberados e o proximo ganho da sua vocacao.',
  ];
}

export function buildProfileProgression(player: PlayerProfile | null) {
  const currentLevel = player?.level ?? 1;
  const currentTitle = player?.title ?? '--';
  const nextLevel = LEVELS.find((entry) => entry.level === currentLevel + 1) ?? null;
  const conceito = player?.resources.conceito ?? 0;
  const nextTarget = nextLevel?.conceitoRequired ?? null;

  return {
    conceito,
    currentLevel,
    currentTitle,
    nextLevel,
    remainingConceito:
      nextTarget === null ? 0 : Math.max(nextTarget - conceito, 0),
  };
}
