import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';

import type { TerritoryOverview, UseHomeHudControllerInput } from './homeHudControllerTypes';

export function useHomeHudLifecycle({
  bootstrapTutorial,
  consumeMapReturnCue,
  player,
  refreshHomeMapData,
  selectedMapFavelaId,
  setBootstrapStatus,
  setSelectedMapFavelaId,
  setTutorialNowMs,
  showInteractionFeedback,
  territoryOverview,
  tutorialProgress,
  issueCameraCommand,
}: {
  bootstrapTutorial: UseHomeHudControllerInput['bootstrapTutorial'];
  consumeMapReturnCue: UseHomeHudControllerInput['consumeMapReturnCue'];
  issueCameraCommand: (type: 'follow' | 'free' | 'recenter') => void;
  player: UseHomeHudControllerInput['player'];
  refreshHomeMapData: UseHomeHudControllerInput['refreshHomeMapData'];
  selectedMapFavelaId: UseHomeHudControllerInput['selectedMapFavelaId'];
  setBootstrapStatus: UseHomeHudControllerInput['setBootstrapStatus'];
  setSelectedMapFavelaId: UseHomeHudControllerInput['setSelectedMapFavelaId'];
  setTutorialNowMs: (value: number) => void;
  showInteractionFeedback: (message: string, accent?: string) => void;
  territoryOverview: TerritoryOverview | null;
  tutorialProgress: { completed: number; total: number };
}) {
  useEffect(() => {
    if (!selectedMapFavelaId) {
      return;
    }

    const stillExists = territoryOverview?.favelas.some((favela) => favela.id === selectedMapFavelaId);
    if (!stillExists) {
      setSelectedMapFavelaId(null);
    }
  }, [selectedMapFavelaId, setSelectedMapFavelaId, territoryOverview?.favelas]);

  useEffect(() => {
    if (player?.hasCharacter && player.id) {
      bootstrapTutorial(player.id);
    }
  }, [bootstrapTutorial, player?.hasCharacter, player?.id]);

  useEffect(() => {
    if (tutorialProgress.completed === tutorialProgress.total && tutorialProgress.total > 0) {
      setBootstrapStatus(
        'Tutorial inicial concluido. Agora siga no seu ritmo entre crimes, mercado, faccao e territorio.',
      );
    }
  }, [setBootstrapStatus, tutorialProgress.completed, tutorialProgress.total]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const nextCue = consumeMapReturnCue();

      if (nextCue) {
        showInteractionFeedback(nextCue.message, nextCue.accent);
        setBootstrapStatus(nextCue.message);
        issueCameraCommand('recenter');
      }

      if (!player?.hasCharacter) {
        return () => {
          cancelled = true;
        };
      }

      const isCancelled = () => cancelled;
      const refreshFeeds = () => refreshHomeMapData(isCancelled);

      setTutorialNowMs(Date.now());
      void refreshFeeds();

      const intervalId = setInterval(() => {
        setTutorialNowMs(Date.now());
        void refreshFeeds();
      }, 60_000);

      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [
      consumeMapReturnCue,
      issueCameraCommand,
      player?.hasCharacter,
      refreshHomeMapData,
      setBootstrapStatus,
      setTutorialNowMs,
      showInteractionFeedback,
    ]),
  );
}
