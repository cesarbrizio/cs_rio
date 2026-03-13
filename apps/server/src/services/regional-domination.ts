import { RegionId } from '@cs-rio/shared';

export interface RegionalDominationFavelaRecord {
  controllingFactionId: string | null;
  regionId: RegionId;
}

export interface RegionalDominationBonus {
  active: boolean;
  controlledFavelas: number;
  factoryProductionMultiplier: number;
  favelaServiceRevenueMultiplier: number;
  frontStoreLegitRevenueMultiplier: number;
  frontStoreLaunderingMultiplier: number;
  maintenanceMultiplier: number;
  propertyDefenseBonus: number;
  propertyRiskMultiplier: number;
  regionId: RegionId;
  revenueMultiplier: number;
  soldiersDefenseMultiplier: number;
  totalFavelas: number;
}

const BASE_REGIONAL_DOMINATION_BONUSES: Record<
  RegionId,
  Omit<RegionalDominationBonus, 'active' | 'controlledFavelas' | 'regionId' | 'totalFavelas'>
> = {
  [RegionId.ZonaSul]: {
    factoryProductionMultiplier: 1,
    favelaServiceRevenueMultiplier: 1,
    frontStoreLegitRevenueMultiplier: 1,
    frontStoreLaunderingMultiplier: 1,
    maintenanceMultiplier: 1,
    propertyDefenseBonus: 24,
    propertyRiskMultiplier: 0.5,
    revenueMultiplier: 1.25,
    soldiersDefenseMultiplier: 1.25,
  },
  [RegionId.ZonaNorte]: {
    factoryProductionMultiplier: 1.1,
    favelaServiceRevenueMultiplier: 1,
    frontStoreLegitRevenueMultiplier: 1,
    frontStoreLaunderingMultiplier: 1,
    maintenanceMultiplier: 1,
    propertyDefenseBonus: 20,
    propertyRiskMultiplier: 0.6,
    revenueMultiplier: 1.2,
    soldiersDefenseMultiplier: 1.18,
  },
  [RegionId.Centro]: {
    factoryProductionMultiplier: 1,
    favelaServiceRevenueMultiplier: 1,
    frontStoreLegitRevenueMultiplier: 1,
    frontStoreLaunderingMultiplier: 1.15,
    maintenanceMultiplier: 1,
    propertyDefenseBonus: 20,
    propertyRiskMultiplier: 0.6,
    revenueMultiplier: 1.2,
    soldiersDefenseMultiplier: 1.18,
  },
  [RegionId.ZonaOeste]: {
    factoryProductionMultiplier: 1,
    favelaServiceRevenueMultiplier: 1.15,
    frontStoreLegitRevenueMultiplier: 1,
    frontStoreLaunderingMultiplier: 1,
    maintenanceMultiplier: 1,
    propertyDefenseBonus: 20,
    propertyRiskMultiplier: 0.6,
    revenueMultiplier: 1.2,
    soldiersDefenseMultiplier: 1.18,
  },
  [RegionId.ZonaSudoeste]: {
    factoryProductionMultiplier: 1,
    favelaServiceRevenueMultiplier: 1,
    frontStoreLegitRevenueMultiplier: 1.1,
    frontStoreLaunderingMultiplier: 1,
    maintenanceMultiplier: 1,
    propertyDefenseBonus: 22,
    propertyRiskMultiplier: 0.55,
    revenueMultiplier: 1.25,
    soldiersDefenseMultiplier: 1.22,
  },
  [RegionId.Baixada]: {
    factoryProductionMultiplier: 1,
    favelaServiceRevenueMultiplier: 1,
    frontStoreLegitRevenueMultiplier: 1,
    frontStoreLaunderingMultiplier: 1,
    maintenanceMultiplier: 0.8,
    propertyDefenseBonus: 16,
    propertyRiskMultiplier: 0.75,
    revenueMultiplier: 1.15,
    soldiersDefenseMultiplier: 1.1,
  },
};

export function buildFactionRegionalDominationByRegion(
  factionId: string | null,
  favelas: RegionalDominationFavelaRecord[],
): Map<RegionId, RegionalDominationBonus> {
  const counts = new Map<RegionId, { controlled: number; total: number }>();

  for (const favela of favelas) {
    const current = counts.get(favela.regionId) ?? { controlled: 0, total: 0 };
    current.total += 1;

    if (factionId && favela.controllingFactionId === factionId) {
      current.controlled += 1;
    }

    counts.set(favela.regionId, current);
  }

  return new Map(
    Object.values(RegionId).map((regionId) => {
      const regionCounts = counts.get(regionId) ?? { controlled: 0, total: 0 };
      const active = Boolean(
        factionId &&
          regionCounts.total > 0 &&
          regionCounts.controlled >= regionCounts.total,
      );
      const baseBonus = active
        ? BASE_REGIONAL_DOMINATION_BONUSES[regionId]
        : buildInactiveRegionalDominationBonus(regionId);

      return [
        regionId,
        {
          ...baseBonus,
          active,
          controlledFavelas: regionCounts.controlled,
          regionId,
          totalFavelas: regionCounts.total,
        } satisfies RegionalDominationBonus,
      ];
    }),
  );
}

export function buildInactiveRegionalDominationBonus(regionId: RegionId): RegionalDominationBonus {
  return {
    ...BASE_REGIONAL_DOMINATION_BONUSES[regionId],
    active: false,
    controlledFavelas: 0,
    factoryProductionMultiplier: 1,
    favelaServiceRevenueMultiplier: 1,
    frontStoreLegitRevenueMultiplier: 1,
    frontStoreLaunderingMultiplier: 1,
    maintenanceMultiplier: 1,
    propertyDefenseBonus: 0,
    propertyRiskMultiplier: 1,
    regionId,
    revenueMultiplier: 1,
    soldiersDefenseMultiplier: 1,
    totalFavelas: 0,
  };
}
