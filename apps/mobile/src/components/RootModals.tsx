import { type AsyncActivityCue } from '../features/activity-results';
import { type EventResultCue } from '../features/event-results';
import { type FactionPromotionCue } from '../features/faction-promotion';
import { type TerritoryLossCue } from '../features/territory-loss';
import { type TribunalCue } from '../features/tribunal-results';
import { type WarResultCue } from '../features/war-results';
import { navigationRef } from '../navigation/RootNavigator';
import { useEventFeedStore } from '../stores/eventFeedStore';
import { ActivityResultModal } from './ActivityResultModal';
import { EventResultModal } from './EventResultModal';
import { EventToastOverlay } from './EventToastOverlay';
import { FactionPromotionModal } from './FactionPromotionModal';
import { TerritoryLossModal } from './TerritoryLossModal';
import { TribunalResultModal } from './TribunalResultModal';
import { WarResultModal } from './WarResultModal';

interface RootModalsProps {
  activeActivityCue: AsyncActivityCue | null;
  activeEventResultCue: EventResultCue | null;
  activeFactionPromotionCue: FactionPromotionCue | null;
  activeTerritoryLossCue: TerritoryLossCue | null;
  activeTribunalCue: TribunalCue | null;
  activeWarResultCue: WarResultCue | null;
  onCloseActivityCue: () => void;
  onCloseEventResultCue: () => void;
  onCloseFactionPromotionCue: () => void;
  onCloseTerritoryLossCue: () => void;
  onCloseTribunalCue: () => void;
  onCloseWarResultCue: () => void;
}

export function RootModals({
  activeActivityCue,
  activeEventResultCue,
  activeFactionPromotionCue,
  activeTerritoryLossCue,
  activeTribunalCue,
  activeWarResultCue,
  onCloseActivityCue,
  onCloseEventResultCue,
  onCloseFactionPromotionCue,
  onCloseTerritoryLossCue,
  onCloseTribunalCue,
  onCloseWarResultCue,
}: RootModalsProps): JSX.Element {
  const activeEventToast = useEventFeedStore((state) => state.activeEventToast);
  const dismissEventToast = useEventFeedStore((state) => state.dismissEventToast);

  return (
    <>
      <EventToastOverlay notification={activeEventToast} onDismiss={dismissEventToast} />
      <EventResultModal
        cue={activeEventResultCue}
        onClose={onCloseEventResultCue}
        onOpenTarget={(cue) => {
          onCloseEventResultCue();
          openEventTarget(cue);
        }}
        visible={Boolean(activeEventResultCue)}
      />
      <ActivityResultModal
        cue={activeActivityCue}
        onClose={onCloseActivityCue}
        onOpenTarget={(cue) => {
          onCloseActivityCue();

          if (!navigationRef.isReady()) {
            return;
          }

          navigationRef.navigate('University');
        }}
        visible={Boolean(activeActivityCue)}
      />
      <FactionPromotionModal
        cue={activeFactionPromotionCue}
        onClose={onCloseFactionPromotionCue}
        visible={Boolean(activeFactionPromotionCue)}
      />
      <TribunalResultModal
        cue={activeTribunalCue}
        onClose={onCloseTribunalCue}
        onOpenTarget={(cue) => {
          onCloseTribunalCue();

          if (!navigationRef.isReady()) {
            return;
          }

          navigationRef.navigate('Tribunal', {
            focusFavelaId: cue.case.favelaId,
          });
        }}
        visible={Boolean(activeTribunalCue)}
      />
      <TerritoryLossModal
        cue={activeTerritoryLossCue}
        onClose={onCloseTerritoryLossCue}
        onOpenTarget={(cue) => {
          onCloseTerritoryLossCue();

          if (!navigationRef.isReady()) {
            return;
          }

          navigationRef.navigate('Territory', {
            focusFavelaId: cue.favelaId,
          });
        }}
        visible={Boolean(activeTerritoryLossCue)}
      />
      <WarResultModal
        cue={activeWarResultCue}
        onClose={onCloseWarResultCue}
        visible={Boolean(activeWarResultCue)}
      />
    </>
  );
}

function openEventTarget(cue: EventResultCue): void {
  if (!navigationRef.isReady()) {
    return;
  }

  switch (cue.destination) {
    case 'territory':
      navigationRef.navigate('Territory');
      return;
    case 'market':
      navigationRef.navigate('Market');
      return;
    case 'prison':
      navigationRef.navigate('Prison');
      return;
    case 'map':
      navigationRef.navigate('Map');
      return;
  }
}
