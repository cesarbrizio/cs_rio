import type { TerritoryFavelaSummary } from './types.js';

export interface TerritoryActionVisibility {
  canConquer: boolean;
  canDeclareWar: boolean;
  isAtWar: boolean;
  isControlledByPlayerFaction: boolean;
  isControlledByRivalFaction: boolean;
  isNeutral: boolean;
  isStateControlled: boolean;
  showBaile: boolean;
  showNegotiatePropina: boolean;
  showServices: boolean;
  showX9Desenrolo: boolean;
}

export function resolveTerritoryActionVisibility(input: {
  favela: TerritoryFavelaSummary | null;
  playerFactionId: string | null;
}): TerritoryActionVisibility {
  const controllingFactionId = input.favela?.controllingFaction?.id ?? null;
  const hasPlayerFaction = Boolean(input.playerFactionId);
  const isNeutral = input.favela?.state === 'neutral' && controllingFactionId === null;
  const isControlledByPlayerFaction =
    input.favela?.state === 'controlled' &&
    hasPlayerFaction &&
    controllingFactionId === input.playerFactionId;
  const isControlledByRivalFaction =
    input.favela?.state === 'controlled' &&
    controllingFactionId !== null &&
    controllingFactionId !== input.playerFactionId;
  const showOwnedFavelaActions = hasPlayerFaction && isControlledByPlayerFaction;

  return {
    canConquer: hasPlayerFaction && isNeutral,
    canDeclareWar: hasPlayerFaction && isControlledByRivalFaction,
    isAtWar: input.favela?.state === 'at_war',
    isControlledByPlayerFaction,
    isControlledByRivalFaction,
    isNeutral,
    isStateControlled: input.favela?.state === 'state',
    showBaile: showOwnedFavelaActions,
    showNegotiatePropina: showOwnedFavelaActions && input.favela?.propina?.canNegotiate === true,
    showServices: showOwnedFavelaActions,
    showX9Desenrolo:
      showOwnedFavelaActions && input.favela?.x9?.canAttemptDesenrolo === true,
  };
}
