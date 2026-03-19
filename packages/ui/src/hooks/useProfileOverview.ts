import { type PlayerProfile } from '@cs-rio/shared';
import { useMemo } from 'react';

import {
  buildProfileProgression,
  buildVocationScopeLines,
  PROFILE_VISIBILITY_COPY,
  PROFILE_VISIBILITY_TITLE,
} from './profileHelpers';

export function useProfileOverview(player: PlayerProfile | null) {
  const progression = useMemo(() => buildProfileProgression(player), [player]);
  const vocationScopeLines = useMemo(
    () => buildVocationScopeLines(player?.vocation),
    [player?.vocation],
  );

  return {
    progression,
    profileVisibilityCopy: PROFILE_VISIBILITY_COPY,
    profileVisibilityTitle: PROFILE_VISIBILITY_TITLE,
    vocationScopeLines,
  };
}
