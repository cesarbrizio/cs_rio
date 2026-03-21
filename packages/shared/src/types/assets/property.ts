import type {
  PropertyCategory,
  PropertyTravelMode,
  PropertyType,
  RegionId,
  SoldierType,
} from '../../types.js';

export interface PropertyDefinitionSummary {
  baseDailyIncome: number;
  baseDailyMaintenanceCost: number;
  basePrice: number;
  baseProtectionScore: number;
  category: PropertyCategory;
  factionCommissionRate: number;
  label: string;
  maxLevel: number;
  profitable: boolean;
  purchaseMode: 'direct' | 'specialized';
  soldierCapacity: number;
  stockAvailable: number | null;
  type: PropertyType;
  unlockLevel: number;
  utility: {
    inventorySlotsBonus: number;
    inventoryWeightBonus: number;
    cansacoRecoveryPerHourBonus: number;
    travelMode: PropertyTravelMode | null;
  };
}

export interface PropertySlotSummary {
  favelaId: string | null;
  gridPosition: {
    x: number;
    y: number;
  };
  id: string;
  ownerId: string | null;
  ownerLabel: string | null;
  propertyType: PropertyType;
  regionId: RegionId;
  status: 'free' | 'occupied';
  structureId: string;
}

export interface SoldierTemplateSummary {
  dailyCost: number;
  label: string;
  power: number;
  type: SoldierType;
  unlockLevel: number;
}

export interface OwnedPropertySummary {
  createdAt: string;
  definition: PropertyDefinitionSummary;
  economics: {
    dailyExpense: number;
    dailyIncome: number;
    effectiveFactionCommissionRate: number;
    profitable: boolean;
    totalDailyUpkeep: number;
  };
  favelaId: string | null;
  id: string;
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  protection: {
    defenseScore: number;
    factionProtectionActive: boolean;
    robberyRisk: number;
    soldiersPower: number;
    territoryControlRatio: number;
    territoryTier: 'none' | 'partial' | 'strong' | 'dominant' | 'absolute';
    takeoverRisk: number;
    invasionRisk: number;
  };
  regionId: RegionId;
  slotId: string | null;
  soldierRoster: Array<{
    count: number;
    dailyCost: number;
    label: string;
    totalPower: number;
    type: SoldierType;
  }>;
  soldiersCount: number;
  status: 'active' | 'maintenance_blocked';
  type: PropertyType;
}

export interface PropertyCatalogResponse {
  availableProperties: PropertyDefinitionSummary[];
  ownedProperties: OwnedPropertySummary[];
  propertySlots: PropertySlotSummary[];
  soldierTemplates: SoldierTemplateSummary[];
}

export interface PropertyPurchaseInput {
  favelaId?: string | null;
  regionId: RegionId;
  slotId?: string | null;
  type: PropertyType;
}

export interface PropertyPurchaseResponse {
  property: OwnedPropertySummary;
  purchaseCost: number;
}

export interface PropertyUpgradeResponse {
  property: OwnedPropertySummary;
  upgradeCost: number;
}

export interface PropertyHireSoldiersInput {
  quantity: number;
  type: SoldierType;
}

export interface PropertyHireSoldiersResponse {
  hiredQuantity: number;
  property: OwnedPropertySummary;
  soldierType: SoldierType;
  totalDailyCostAdded: number;
}
