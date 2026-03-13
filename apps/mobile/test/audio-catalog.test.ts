import { RegionId } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import { AUDIO_MUSIC_SOURCES, REGION_MUSIC_TRACKS } from '../src/audio/audioCatalog';

describe('audio catalog', () => {
  it('maps every region to a placeholder music track with a source', () => {
    const regionIds = Object.values(RegionId);

    expect(regionIds).toHaveLength(6);

    for (const regionId of regionIds) {
      const track = REGION_MUSIC_TRACKS[regionId];

      expect(track).toBeTruthy();
      expect(AUDIO_MUSIC_SOURCES[track]).toBeTruthy();
    }
  });
});
