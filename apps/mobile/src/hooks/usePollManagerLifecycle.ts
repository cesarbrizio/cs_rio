import { useEffect } from 'react';
import {
  type PlayerProfile,
  type RegionId,
  type UniversityCourseSummary,
} from '@cs-rio/shared';

type PollLifecyclePlayer = Pick<
  PlayerProfile,
  'hasCharacter' | 'hospitalization' | 'prison' | 'regionId'
>;

interface UsePollManagerLifecycleInput {
  clearState: () => void;
  isAuthenticated: boolean;
  player: PollLifecyclePlayer | null;
  pollAll: () => Promise<void>;
  resetEventFeed: () => void;
  resetPrivateMessageFeed: () => void;
  syncRegionMusic: (regionId: RegionId | null | undefined) => Promise<unknown> | void;
  syncTimerNotifications: (
    player: Pick<PlayerProfile, 'hospitalization' | 'prison'> | null | undefined,
  ) => Promise<unknown> | void;
  syncUniversityNotifications: (
    activeCourse: Pick<UniversityCourseSummary, 'label' | 'code' | 'endsAt' | 'isInProgress'> | null | undefined,
  ) => Promise<unknown> | void;
}

export function usePollManagerLifecycle({
  clearState,
  isAuthenticated,
  player,
  pollAll,
  resetEventFeed,
  resetPrivateMessageFeed,
  syncRegionMusic,
  syncTimerNotifications,
  syncUniversityNotifications,
}: UsePollManagerLifecycleInput) {
  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      void syncRegionMusic(null);
      return;
    }

    void syncRegionMusic(player.regionId ?? null);
  }, [isAuthenticated, player?.hasCharacter, player?.regionId, syncRegionMusic]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      clearState();
      resetEventFeed();
      resetPrivateMessageFeed();
      void syncTimerNotifications(null);
      void syncUniversityNotifications(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        await pollAll();
      } catch {
        if (!cancelled) {
          // Silent fail in pre-alpha: the banner should not block auth or map boot.
        }
      }
    };

    void load();
    const intervalId = setInterval(() => {
      void load();
    }, 45_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [
    clearState,
    isAuthenticated,
    player?.hasCharacter,
    pollAll,
    resetEventFeed,
    resetPrivateMessageFeed,
    syncTimerNotifications,
    syncUniversityNotifications,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      void syncTimerNotifications(null);
      return;
    }

    void syncTimerNotifications(player);
  }, [
    isAuthenticated,
    player,
    player?.hasCharacter,
    player?.hospitalization?.endsAt,
    player?.hospitalization?.isHospitalized,
    player?.prison?.endsAt,
    player?.prison?.isImprisoned,
    syncTimerNotifications,
  ]);
}
