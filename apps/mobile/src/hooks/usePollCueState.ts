import { useCallback, useState } from 'react';

import { type AsyncActivityCue } from '../features/activity-results';
import { type EventResultCue } from '../features/event-results';
import { type FactionPromotionCue } from '../features/faction-promotion';
import { type TerritoryLossCue } from '../features/territory-loss';
import { type TribunalCue } from '../features/tribunal-results';
import { type WarResultCue } from '../features/war-results';

export function usePollCueState() {
  const [activeActivityCue, setActiveActivityCue] = useState<AsyncActivityCue | null>(null);
  const [activeEventResultCue, setActiveEventResultCue] = useState<EventResultCue | null>(null);
  const [activeFactionPromotionCue, setActiveFactionPromotionCue] = useState<FactionPromotionCue | null>(null);
  const [activeTerritoryLossCue, setActiveTerritoryLossCue] = useState<TerritoryLossCue | null>(null);
  const [activeTribunalCue, setActiveTribunalCue] = useState<TribunalCue | null>(null);
  const [activeWarResultCue, setActiveWarResultCue] = useState<WarResultCue | null>(null);

  const hasBlockingCue = Boolean(
    activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeTerritoryLossCue ||
      activeTribunalCue,
  );

  const clearAllCues = useCallback(() => {
    setActiveActivityCue(null);
    setActiveEventResultCue(null);
    setActiveFactionPromotionCue(null);
    setActiveTerritoryLossCue(null);
    setActiveTribunalCue(null);
    setActiveWarResultCue(null);
  }, []);

  return {
    activeActivityCue,
    activeEventResultCue,
    activeFactionPromotionCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    clearAllCues,
    closeActivityCue: () => setActiveActivityCue(null),
    closeEventResultCue: () => setActiveEventResultCue(null),
    closeFactionPromotionCue: () => setActiveFactionPromotionCue(null),
    closeTerritoryLossCue: () => setActiveTerritoryLossCue(null),
    closeTribunalCue: () => setActiveTribunalCue(null),
    closeWarResultCue: () => setActiveWarResultCue(null),
    hasBlockingCue,
    setActiveActivityCue,
    setActiveEventResultCue,
    setActiveFactionPromotionCue,
    setActiveTerritoryLossCue,
    setActiveTribunalCue,
    setActiveWarResultCue,
  };
}
