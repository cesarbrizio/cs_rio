import { describe, expect, it } from 'vitest';

import { RegionId } from '@cs-rio/shared';

import {
  estimateMacroRegionTravel,
  getMacroRegionMeta,
} from '../src/hooks/mapPresentation';

describe('mapPresentation', () => {
  it('falls back to Centro metadata for unknown regions', () => {
    expect(getMacroRegionMeta('desconhecida')).toEqual(getMacroRegionMeta(RegionId.Centro));
  });

  it('returns zero travel inside the same macro region', () => {
    expect(estimateMacroRegionTravel(RegionId.Centro, RegionId.Centro)).toEqual({
      cost: 0,
      minutes: 0,
    });
  });

  it('keeps the shared travel estimate stable between regions', () => {
    expect(estimateMacroRegionTravel(RegionId.Centro, RegionId.ZonaSul)).toEqual({
      cost: 147,
      minutes: 7,
    });
    expect(estimateMacroRegionTravel(RegionId.ZonaSul, RegionId.Centro)).toEqual({
      cost: 147,
      minutes: 7,
    });
  });
});
