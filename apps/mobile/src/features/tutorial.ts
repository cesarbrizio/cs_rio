export const TUTORIAL_WINDOW_MS = 30 * 60 * 1000;

export type TutorialStepId = 'move' | 'crimes' | 'market' | 'territory';

export interface TutorialStepDefinition {
  actionId: 'crimes' | 'market' | 'territory' | null;
  ctaLabel: string;
  hint: string;
  id: TutorialStepId;
  npcName: string;
  npcRole: string;
  title: string;
}

export const TUTORIAL_STEPS: TutorialStepDefinition[] = [
  {
    actionId: null,
    ctaLabel: 'Marcar destino',
    hint: 'Toque no chão do mapa para marcar um destino e começar a andar.',
    id: 'move',
    npcName: 'Olheiro Naldo',
    npcRole: 'Guia da área',
    title: 'Primeiro passo: aprenda a se mover pelo mapa.',
  },
  {
    actionId: 'crimes',
    ctaLabel: 'Abrir crimes',
    hint: 'Seu primeiro corre vem daqui. Escolha um crime simples para começar a girar dinheiro e conceito.',
    id: 'crimes',
    npcName: 'Vapor Darlan',
    npcRole: 'Corre da rua',
    title: 'Agora faça seu primeiro corre.',
  },
  {
    actionId: 'market',
    ctaLabel: 'Abrir mercado',
    hint: 'No mercado você compra, vende e repara item. É o lugar para transformar loot em progressão.',
    id: 'market',
    npcName: 'Dona Jurema',
    npcRole: 'Contato do mercado',
    title: 'Aprenda onde gira o equipamento.',
  },
  {
    actionId: 'territory',
    ctaLabel: 'Abrir território',
    hint: 'Território é onde a facção cresce: favela, serviço, satisfação, X9, guerra e domínio regional.',
    id: 'territory',
    npcName: 'Antigão',
    npcRole: 'Leitura da rua',
    title: 'Entenda o jogo maior da cidade.',
  },
];

export function getCurrentTutorialStep(completedStepIds: TutorialStepId[]): TutorialStepDefinition | null {
  return TUTORIAL_STEPS.find((step) => !completedStepIds.includes(step.id)) ?? null;
}

export function getTutorialProgress(completedStepIds: TutorialStepId[]): {
  completed: number;
  current: number;
  total: number;
} {
  const completed = completedStepIds.length;
  const total = TUTORIAL_STEPS.length;

  return {
    completed,
    current: Math.min(completed + 1, total),
    total,
  };
}

export function getTutorialRemainingMinutes(startedAt: string | null, nowMs: number): number | null {
  if (!startedAt) {
    return null;
  }

  const startedAtMs = new Date(startedAt).getTime();

  if (Number.isNaN(startedAtMs)) {
    return null;
  }

  const remainingMs = Math.max(0, startedAtMs + TUTORIAL_WINDOW_MS - nowMs);
  return Math.max(0, Math.ceil(remainingMs / 60_000));
}

export function isTutorialStillActive(
  startedAt: string | null,
  completedStepIds: TutorialStepId[],
  dismissed: boolean,
  nowMs: number,
): boolean {
  if (dismissed || completedStepIds.length >= TUTORIAL_STEPS.length || !startedAt) {
    return false;
  }

  const startedAtMs = new Date(startedAt).getTime();

  if (Number.isNaN(startedAtMs)) {
    return false;
  }

  return nowMs <= startedAtMs + TUTORIAL_WINDOW_MS;
}
