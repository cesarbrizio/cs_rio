export const PROFILE_VISIBILITY_TITLE = 'Visibilidade atual';

export const PROFILE_VISIBILITY_COPY =
  'Esse é o recorte que já fica visível hoje no jogo. Perfil público dedicado entra no social MVP.';

export function buildVocationScopeLines(vocation: string | null | undefined): string[] {
  const vocationLine =
    vocation && vocation.trim().length > 0
      ? `${vocation} segue como a sua vocação ativa nesta rodada.`
      : 'Sua vocação ativa segue definida na criação do personagem.';

  return [
    vocationLine,
    'A Central de Vocação já permite trocar de build com custo em créditos premium e cooldown global de 24h.',
    'Use a Universidade do Crime para acompanhar a trilha exclusiva, os perks liberados e o próximo ganho da sua vocação.',
  ];
}

export function resolveUniversityScopeSubtitle(): string {
  return 'Veja cursos, perks exclusivos da sua vocação, passivos ativos e matrículas com timer real.';
}

export function resolveUniversityTrackTitle(): string {
  return 'Progressão da vocação';
}

export function resolveUniversityScopeNotice(vocationLabel: string): string {
  const scopedLabel =
    vocationLabel.trim().length > 0 ? vocationLabel : 'Sua vocação atual';

  return `${scopedLabel} define a trilha exclusiva que libera perks permanentes. Se quiser trocar a build, use a Central de Vocação.`;
}

export function resolveVocationCenterSubtitle(): string {
  return 'Veja a build ativa, o cooldown de troca e o impacto real da trilha exclusiva ligada à sua vocação.';
}
