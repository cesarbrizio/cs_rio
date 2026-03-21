import { type RoundCenterResponse } from '@cs-rio/shared';
import { useCallback, useState } from 'react';

export const RANKING_SCREEN_DESCRIPTION =
  'Veja quem esta puxando conceito, quanto tempo falta na rodada e o premio reservado para o top 10.';

interface UseRankingControllerInput {
  roundApi: {
    getCenter: () => Promise<RoundCenterResponse>;
  };
}

export function useRankingController({ roundApi }: UseRankingControllerInput) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<RoundCenterResponse | null>(null);

  const loadCenter = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await roundApi.getCenter();
      setCenter(response);
      return response;
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : 'Falha ao carregar o ranking da rodada.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [roundApi]);

  return {
    center,
    error,
    isLoading,
    loadCenter,
  };
}
