import { describe, expect, it } from 'vitest';

import {
  LEVELS,
  PROPERTY_DEFINITIONS,
  REALTIME_MESSAGE_PLAYER_MOVE,
  REGIONS,
  REGION_REALTIME_ROOM_NAMES,
  UNIVERSITY_COURSE_DEFINITIONS,
  VOCATIONS,
} from '../src/constants.js';

describe('shared constants', () => {
  it('exposes the expected progression ladder', () => {
    expect(LEVELS).toHaveLength(10);
    expect(LEVELS[0]?.title).toBe('pivete');
    expect(LEVELS[9]?.title).toBe('prefeito');
  });

  it('keeps the six macro-regions of the map', () => {
    expect(REGIONS).toHaveLength(6);
  });

  it('keeps the five vocation archetypes', () => {
    expect(VOCATIONS.map((vocation) => vocation.id)).toHaveLength(5);
  });

  it('maps every region to a realtime room name', () => {
    expect(Object.keys(REGION_REALTIME_ROOM_NAMES)).toHaveLength(6);
    expect(REGION_REALTIME_ROOM_NAMES.centro).toBe('room_centro');
  });

  it('keeps the realtime movement message stable', () => {
    expect(REALTIME_MESSAGE_PLAYER_MOVE).toBe('player:move');
  });

  it('includes patrimonial properties with residential utility and logistics bonuses', () => {
    const mansion = PROPERTY_DEFINITIONS.find((entry) => entry.type === 'mansion');
    const beachHouse = PROPERTY_DEFINITIONS.find((entry) => entry.type === 'beach_house');
    const yacht = PROPERTY_DEFINITIONS.find((entry) => entry.type === 'yacht');

    expect(mansion?.profitable).toBe(false);
    expect(mansion?.category).toBe('realty');
    expect(mansion?.utility.inventorySlotsBonus).toBeGreaterThan(0);
    expect(beachHouse?.utility.cansacoRecoveryPerHourBonus).toBeGreaterThan(0);
    expect(yacht?.utility.travelMode).toBe('sea');
    expect(PROPERTY_DEFINITIONS.some((entry) => entry.type === 'jewelry')).toBe(true);
    expect(PROPERTY_DEFINITIONS.some((entry) => entry.category === 'luxury_item')).toBe(true);
  });

  it('keeps the university tree aligned with the five vocation schools', () => {
    expect(UNIVERSITY_COURSE_DEFINITIONS).toHaveLength(20);
    expect(UNIVERSITY_COURSE_DEFINITIONS.filter((entry) => entry.vocation === 'cria')).toHaveLength(4);
    expect(
      UNIVERSITY_COURSE_DEFINITIONS.find((entry) => entry.code === 'mercado_paralelo')?.moneyCost,
    ).toBe(120000);
  });
});
