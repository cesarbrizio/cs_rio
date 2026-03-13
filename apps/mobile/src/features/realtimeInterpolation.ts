import { REALTIME_REMOTE_INTERPOLATION_ALPHA } from '@cs-rio/shared';

import { type RealtimePlayerSnapshot } from '../services/colyseus';

export function stepInterpolatedPlayers(
  currentPlayers: RealtimePlayerSnapshot[],
  targetPlayers: RealtimePlayerSnapshot[],
  alpha = REALTIME_REMOTE_INTERPOLATION_ALPHA,
): RealtimePlayerSnapshot[] {
  const currentBySessionId = new Map(
    currentPlayers.map((player) => [player.sessionId, player] as const),
  );

  return targetPlayers.map((targetPlayer) => {
    const currentPlayer = currentBySessionId.get(targetPlayer.sessionId);

    if (!currentPlayer) {
      return { ...targetPlayer };
    }

    return {
      ...targetPlayer,
      x: interpolateAxis(currentPlayer.x, targetPlayer.x, alpha),
      y: interpolateAxis(currentPlayer.y, targetPlayer.y, alpha),
    };
  });
}

function interpolateAxis(current: number, target: number, alpha: number): number {
  if (Math.abs(target - current) <= 0.05) {
    return target;
  }

  return current + (target - current) * alpha;
}
