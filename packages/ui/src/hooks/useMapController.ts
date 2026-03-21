import { REGIONS, type PlayerProfile } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { estimateMacroRegionTravel } from './mapPresentation';

interface UseMapControllerInput {
  player: PlayerProfile | null;
  travelToRegion: (regionId: PlayerProfile['regionId']) => Promise<unknown>;
}

export function useMapController({ player, travelToRegion }: UseMapControllerInput) {
  const [selectedRegionId, setSelectedRegionId] = useState<PlayerProfile['regionId']>(
    player?.regionId ?? REGIONS[0]?.id ?? 'centro',
  );
  const [isTraveling, setIsTraveling] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentRegionId = player?.regionId ?? REGIONS[0]?.id ?? 'centro';
  const currentRegion = useMemo(
    () => REGIONS.find((region) => region.id === currentRegionId) ?? REGIONS[0],
    [currentRegionId],
  );
  const selectedRegion = useMemo(
    () => REGIONS.find((region) => region.id === selectedRegionId) ?? REGIONS[0],
    [selectedRegionId],
  );
  const routeEstimate = useMemo(
    () => estimateMacroRegionTravel(currentRegionId, selectedRegionId),
    [currentRegionId, selectedRegionId],
  );

  useEffect(() => {
    if (player?.regionId) {
      setSelectedRegionId(player.regionId);
    }
  }, [player?.regionId]);

  const travel = useCallback(async () => {
    if (!player) {
      setError('Perfil indisponivel para viajar agora.');
      return false;
    }

    if (selectedRegionId === player.regionId) {
      setFeedback(`Voce ja esta em ${selectedRegion?.label}.`);
      return false;
    }

    try {
      setError(null);
      setIsTraveling(true);
      await travelToRegion(selectedRegionId);
      setFeedback(`Voce chegou em ${selectedRegion?.label}.`);
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao viajar de regiao.');
      return false;
    } finally {
      setIsTraveling(false);
    }
  }, [player, selectedRegion?.label, selectedRegionId, travelToRegion]);

  return {
    currentRegion,
    currentRegionId,
    error,
    feedback,
    isTraveling,
    routeEstimate,
    selectedRegion,
    selectedRegionId,
    setSelectedRegionId,
    travel,
  };
}
