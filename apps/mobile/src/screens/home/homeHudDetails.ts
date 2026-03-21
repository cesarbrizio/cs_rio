import type { NpcInflationSummary, PlayerProfile, RoundSummary } from '@cs-rio/shared';

import {
  buildNpcInflationBody,
  buildNpcInflationDecisionHint,
  buildNpcInflationHeadline,
  formatNpcInflationMultiplier,
} from '../../features/inflation';
import { buildFavelaOwnerLabel, describeFavelaContext } from './homeHelpers';
import type {
  ProjectedFavela,
  RoundPressure,
  RegionClimateSummary,
} from './homeTypes';
import type { EventNotificationItem } from '../../features/events';
import type { HomeInfoCardContent } from './HomeHudOverlay';

type TutorialStep = ReturnType<typeof import('../../features/tutorial').getCurrentTutorialStep>;

export function buildCompactRoundLabel(roundSummary: RoundSummary | null): string {
  if (!roundSummary) {
    return 'Rodada carregando...';
  }

  return `Rodada #${roundSummary.number} · Dia ${roundSummary.currentGameDay}/${roundSummary.totalGameDays}`;
}

export function buildRoundPressure(
  roundSummary: RoundSummary | null,
  roundInflation: NpcInflationSummary | null,
): RoundPressure | null {
  if (!roundSummary || !roundInflation) {
    return null;
  }

  return {
    detail: `${buildNpcInflationBody(roundInflation)} ${buildNpcInflationDecisionHint(roundInflation)}`,
    headline: buildNpcInflationHeadline(roundInflation),
    labels: [
      `Inflacao ${formatNpcInflationMultiplier(roundInflation.currentMultiplier)}`,
      roundInflation.nextIncreaseInDays === null || roundInflation.nextMultiplier === null
        ? 'Teto da rodada'
        : `Sobe em ${roundInflation.nextIncreaseInDays}d`,
    ],
  };
}

export function buildRoundDetail(
  compactRoundLabel: string,
  roundPressure: RoundPressure | null,
  roundSummary: RoundSummary | null,
): HomeInfoCardContent {
  if (!roundSummary) {
    return {
      detail: 'A rodada ainda esta abrindo. Assim que ela firmar, o tempo e a pressao aparecem aqui.',
      headline: 'Rodada ativa carregando...',
    };
  }

  return {
    detail: roundPressure
      ? `${roundPressure.headline} ${roundPressure.detail}`
      : 'A rodada esta ativa e o ranking segue correndo em tempo real.',
    headline: compactRoundLabel,
  };
}

export function buildFocusChipLabel(
  player: PlayerProfile | null,
  tutorialActive: boolean,
  tutorialStep: TutorialStep,
): string {
  if (player?.prison.isImprisoned) {
    return 'Foco: prisao';
  }

  if (player?.hospitalization.isHospitalized) {
    return 'Foco: hospital';
  }

  if (tutorialActive && tutorialStep) {
    return `Foco: ${tutorialStep.title}`;
  }

  if (!player?.faction) {
    return 'Foco: primeiro corre';
  }

  return 'Foco: seguir no corre';
}

export function buildFocusDetail(
  player: PlayerProfile | null,
  tutorialActive: boolean,
  tutorialStep: TutorialStep,
): HomeInfoCardContent {
  if (player?.prison.isImprisoned) {
    return {
      detail: 'Enquanto preso, quase todo o corre trava. A proxima decisao util esta na tela da prisao.',
      headline: 'Seu foco agora e sair da prisao.',
    };
  }

  if (player?.hospitalization.isHospitalized) {
    return {
      detail: 'Internado, seu ritmo cai. Resolver o hospital acelera sua volta para a rua.',
      headline: 'Seu foco agora e fechar a internacao.',
    };
  }

  if (tutorialActive && tutorialStep) {
    return {
      detail: 'Feche esse passo para completar o loop basico entre mapa, acao e retorno.',
      headline: tutorialStep.hint,
    };
  }

  if (!player?.faction) {
    return {
      detail: 'Dinheiro, conceito e territorio aceleram sua entrada real na rodada.',
      headline: 'Faca um crime simples, treine e olhe territorio.',
    };
  }

  return {
    detail: 'Crime, negocio e territorio seguem empurrando seu ranking e sua presenca na cidade.',
    headline: 'Seu foco agora e seguir no corre.',
  };
}

export function buildWorldDetail({
  eventBanner,
  nearestWorldSpot,
  player,
  regionClimate,
  regionLabel,
  selectedProjectedFavela,
}: {
  eventBanner: EventNotificationItem | null;
  nearestWorldSpot: { distance: number; title: string } | null;
  player: PlayerProfile | null;
  regionClimate: RegionClimateSummary;
  regionLabel: string;
  selectedProjectedFavela: ProjectedFavela | null;
}): HomeInfoCardContent {
  if (selectedProjectedFavela) {
    return {
      detail: describeFavelaContext(selectedProjectedFavela.favela, player?.faction?.id ?? null),
      headline: `${selectedProjectedFavela.favela.name} · ${buildFavelaOwnerLabel(selectedProjectedFavela.favela)}`,
    };
  }

  const nearbyDetail = nearestWorldSpot
    ? nearestWorldSpot.distance <= 6
      ? `${nearestWorldSpot.title} esta logo ao alcance.`
      : `${nearestWorldSpot.title} e o ponto mais proximo do seu corre agora.`
    : 'Ainda falta um ponto forte proximo para puxar sua proxima acao.';
  const factionDetail = player?.faction
    ? `Voce esta sob a bandeira ${player.faction.abbreviation}.`
    : 'Voce ainda esta sem protecao de faccao.';
  const eventDetail = eventBanner
    ? `${eventBanner.title} esta mudando o clima dessa regiao.`
    : `${regionClimate.pressureLabel}. ${factionDetail}`;

  return {
    detail: `${nearbyDetail} ${eventDetail}`,
    headline: `Na rua · ${regionLabel}`,
  };
}

export function buildConnectionLabel(
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting',
): string | null {
  if (status === 'connected') return null;
  if (status === 'disconnected') return 'Offline - modo solo';
  if (status === 'reconnecting') return 'Reconectando...';
  return 'Conectando...';
}
