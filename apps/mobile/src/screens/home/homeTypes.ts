import {
  type DocksEventStatusResponse,
  type PoliceEventStatusResponse,
  type SeasonalEventStatusResponse,
  type TerritoryFavelaSummary,
} from '@cs-rio/shared';

export interface WorldContextSpot {
  entityId: string;
  position: {
    x: number;
    y: number;
  };
  reach: number;
  title: string;
}

export interface WorldPulseItem {
  accent: string;
  id: string;
  label: string;
  value: string;
}

export interface RoundPressure {
  detail: string;
  headline: string;
  labels: string[];
}

export interface EventRuntimeState {
  docks: DocksEventStatusResponse;
  police: PoliceEventStatusResponse;
  seasonal: SeasonalEventStatusResponse;
}

export interface ProjectedFavela {
  center: {
    x: number;
    y: number;
  };
  favela: TerritoryFavelaSummary;
}

export interface RegionClimateSummary {
  accent: string;
  detail: string;
  label: string;
  pressureLabel: string;
}
