import { type CrimeAttemptResponse, type CrimeCatalogItem } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { groupCrimesByLevel } from './crimesHelpers';

interface UseCrimesControllerInput {
  crimesApi: {
    attempt: (crimeId: string) => Promise<CrimeAttemptResponse>;
    list: () => Promise<{
      crimes: CrimeCatalogItem[];
    }>;
  };
  refreshPlayerProfile: () => Promise<unknown>;
}

export function useCrimesController({
  crimesApi,
  refreshPlayerProfile,
}: UseCrimesControllerInput) {
  const [catalog, setCatalog] = useState<CrimeCatalogItem[]>([]);
  const [selectedCrimeId, setSelectedCrimeId] = useState<string | null>(null);
  const [result, setResult] = useState<CrimeAttemptResponse | null>(null);
  const [isAttempting, setIsAttempting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedCrime = useMemo(
    () => catalog.find((crime) => crime.id === selectedCrimeId) ?? catalog[0] ?? null,
    [catalog, selectedCrimeId],
  );
  const groupedCrimes = useMemo(() => groupCrimesByLevel(catalog), [catalog]);

  const loadCatalog = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      await refreshPlayerProfile();
      const response = await crimesApi.list();

      setCatalog(response.crimes);
      setSelectedCrimeId((currentCrimeId) => {
        if (currentCrimeId && response.crimes.some((crime) => crime.id === currentCrimeId)) {
          return currentCrimeId;
        }

        return response.crimes.find((crime) => crime.isRunnable)?.id ?? response.crimes[0]?.id ?? null;
      });
      setFeedback('Catalogo criminal atualizado.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar catalogo criminal.');
    } finally {
      setIsLoading(false);
    }
  }, [crimesApi, refreshPlayerProfile]);

  const attemptSelectedCrime = useCallback(async () => {
    if (!selectedCrime) {
      return;
    }

    setError(null);
    setIsAttempting(true);

    try {
      const response = await crimesApi.attempt(selectedCrime.id);
      setResult(response);
      await refreshPlayerProfile();
      const nextCatalog = await crimesApi.list();
      setCatalog(nextCatalog.crimes);
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao executar crime.');
    } finally {
      setIsAttempting(false);
    }
  }, [crimesApi, refreshPlayerProfile, selectedCrime]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  return {
    attemptSelectedCrime,
    catalog,
    error,
    feedback,
    groupedCrimes,
    isAttempting,
    isLoading,
    loadCatalog,
    result,
    selectCrime: setSelectedCrimeId,
    selectedCrime,
    selectedCrimeId,
    setResult,
  };
}
