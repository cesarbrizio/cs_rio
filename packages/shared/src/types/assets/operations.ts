import type {
  BichoBetMode,
  BichoBetStatus,
  DocksEventPhase,
  DrugSaleChannel,
  FrontStoreBatchStatus,
  FrontStoreKind,
  GameEventResultDestination,
  GameEventResultSeverity,
  GameEventResultType,
  GpType,
  PoliceEventType,
  PuteiroGpStatus,
  RegionId,
  SeasonalEventPoliceMood,
  SeasonalEventType,
} from '../../types.js';

export interface BocaStockItemSummary {
  baseUnitPrice: number;
  code: string;
  drugId: string;
  drugName: string;
  estimatedQuantityPerCycle: number;
  estimatedUnitPrice: number;
  quantity: number;
}

export interface BocaSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastSaleAt: string;
    totalFactionCommission: number;
  };
  economics: {
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    locationMultiplier: number;
    npcDemandPerCycle: number;
    profitable: boolean;
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
  regionId: RegionId;
  status: 'active' | 'maintenance_blocked' | 'out_of_stock';
  stock: BocaStockItemSummary[];
  stockUnits: number;
}

export interface BocaListResponse {
  bocas: BocaSummary[];
}

export interface BocaStockInput {
  inventoryItemId: string;
  quantity: number;
}

export interface BocaStockResponse {
  boca: BocaSummary;
  drug: {
    id: string;
    name: string;
  };
  transferredQuantity: number;
}

export interface BocaCollectResponse {
  boca: BocaSummary;
  collectedAmount: number;
  playerMoneyAfterCollect: number;
}

export interface RaveLineupItemSummary {
  baseUnitPrice: number;
  code: string;
  configuredPriceMultiplier: number;
  configuredUnitPrice: number;
  drugId: string;
  drugName: string;
  estimatedVisitorsPerCycle: number;
  quantity: number;
}

export interface RaveSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastSaleAt: string;
    totalFactionCommission: number;
  };
  economics: {
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    locationMultiplier: number;
    profitable: boolean;
    visitorFlowPerCycle: number;
  };
  favelaId: string | null;
  id: string;
  level: number;
  lineup: RaveLineupItemSummary[];
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  status: 'active' | 'maintenance_blocked' | 'no_lineup';
}

export interface RaveListResponse {
  raves: RaveSummary[];
}

export interface RaveStockInput {
  inventoryItemId: string;
  quantity: number;
}

export interface RaveStockResponse {
  drug: {
    id: string;
    name: string;
  };
  rave: RaveSummary;
  transferredQuantity: number;
}

export interface RavePricingInput {
  drugId: string;
  priceMultiplier: number;
}

export interface RavePricingResponse {
  configuredDrugId: string;
  priceMultiplier: number;
  rave: RaveSummary;
}

export interface RaveCollectResponse {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
  rave: RaveSummary;
}

export interface GpTemplateSummary {
  baseDailyRevenue: number;
  label: string;
  purchasePrice: number;
  cansacoRestorePercent: number;
  type: GpType;
}

export interface PuteiroWorkerSummary {
  baseDailyRevenue: number;
  dstRecoversAt: string | null;
  hasDst: boolean;
  hourlyGrossRevenueEstimate: number;
  id: string;
  incidentRisk: {
    deathChancePerCycle: number;
    dstChancePerCycle: number;
    escapeChancePerCycle: number;
  };
  label: string;
  lastIncidentAt: string | null;
  purchasePrice: number;
  cansacoRestorePercent: number;
  status: PuteiroGpStatus;
  type: GpType;
}

export interface PuteiroSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastRevenueAt: string;
    totalFactionCommission: number;
  };
  economics: {
    activeGps: number;
    availableSlots: number;
    capacity: number;
    charismaMultiplier: number;
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    locationMultiplier: number;
    profitable: boolean;
  };
  favelaId: string | null;
  id: string;
  incidents: {
    activeDstCases: number;
    totalDeaths: number;
    totalDstIncidents: number;
    totalEscapes: number;
  };
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  roster: PuteiroWorkerSummary[];
  status: 'active' | 'maintenance_blocked' | 'no_gps';
}

export interface PuteiroListResponse {
  puteiros: PuteiroSummary[];
  templates: GpTemplateSummary[];
}

export interface PuteiroHireInput {
  quantity: number;
  type: GpType;
}

export interface PuteiroHireResponse {
  hiredGps: PuteiroWorkerSummary[];
  playerMoneyAfterPurchase: number;
  puteiro: PuteiroSummary;
  totalPurchaseCost: number;
}

export interface PuteiroCollectResponse {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
  puteiro: PuteiroSummary;
}

export interface FrontStoreKindTemplateSummary {
  baseDailyLegitRevenue: number;
  baseInvestigationRisk: number;
  baseLaunderingCapacityPerDay: number;
  cleanReturnMultiplier: number;
  kind: FrontStoreKind;
  label: string;
}

export interface FrontStoreBatchSummary {
  completedAt: string;
  expectedCleanReturn: number;
  id: string;
  investedAmount: number;
  investigationRisk: number;
  resolvedAt: string | null;
  resolvedCleanAmount: number;
  seizedAmount: number;
  startedAt: string;
  status: FrontStoreBatchStatus;
}

export interface FrontStoreSummary {
  batches: FrontStoreBatchSummary[];
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastRevenueAt: string;
    totalFactionCommission: number;
    totalLaunderedClean: number;
    totalSeizedAmount: number;
  };
  economics: {
    charismaRiskReduction: number;
    cleanReturnMultiplier: number | null;
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyLegitRevenue: number;
    launderingCapacityPerDay: number;
    launderingCapacityRemaining: number;
    legitRevenuePerCycle: number;
    locationMultiplier: number;
    profitable: boolean;
  };
  favelaId: string | null;
  id: string;
  investigation: {
    activeUntil: string | null;
    investigationsTotal: number;
    isUnderInvestigation: boolean;
    lastInvestigationAt: string | null;
  };
  kind: FrontStoreKind | null;
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  status:
    | 'active'
    | 'investigation_blocked'
    | 'maintenance_blocked'
    | 'setup_required';
}

export interface FrontStoreListResponse {
  frontStores: FrontStoreSummary[];
  kinds: FrontStoreKindTemplateSummary[];
}

export interface FrontStoreInvestInput {
  dirtyAmount: number;
  storeKind?: FrontStoreKind;
}

export interface FrontStoreInvestResponse {
  batch: FrontStoreBatchSummary;
  frontStore: FrontStoreSummary;
  playerMoneyAfterInvest: number;
}

export interface FrontStoreCollectResponse {
  collectedAmount: number;
  frontStore: FrontStoreSummary;
  playerBankMoneyAfterCollect: number;
}

export interface SlotMachineSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastPlayAt: string;
    totalFactionCommission: number;
  };
  config: {
    houseEdge: number;
    jackpotChance: number;
    maxBet: number;
    minBet: number;
  };
  economics: {
    capacity: number;
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    expectedGrossRevenuePerCycle: number;
    installedMachines: number;
    locationMultiplier: number;
    playerTrafficMultiplier: number;
    profitable: boolean;
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
  regionId: RegionId;
  status: 'active' | 'installation_required' | 'maintenance_blocked';
}

export interface SlotMachineListResponse {
  slotMachines: SlotMachineSummary[];
}

export interface SlotMachineInstallInput {
  quantity: number;
}

export interface SlotMachineInstallResponse {
  installedQuantity: number;
  playerMoneyAfterInstall: number;
  slotMachine: SlotMachineSummary;
  totalInstallCost: number;
}

export interface SlotMachineConfigureInput {
  houseEdge: number;
  jackpotChance: number;
  maxBet: number;
  minBet: number;
}

export interface SlotMachineConfigureResponse {
  slotMachine: SlotMachineSummary;
}

export interface SlotMachineCollectResponse {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
  slotMachine: SlotMachineSummary;
}

export interface BichoAnimalSummary {
  groupNumbers: number[];
  label: string;
  number: number;
}

export interface BichoCurrentDrawSummary {
  closesAt: string;
  id: string;
  opensAt: string;
  sequence: number;
}

export interface BichoHistoryDrawSummary {
  closesAt: string;
  id: string;
  opensAt: string;
  sequence: number;
  settledAt: string;
  totalBetAmount: number;
  totalPayoutAmount: number;
  winningAnimalNumber: number;
  winningDozen: number;
}

export interface BichoBetSummary {
  amount: number;
  animalNumber: number | null;
  dozen: number | null;
  drawClosesAt: string;
  drawId: string;
  id: string;
  mode: BichoBetMode;
  payout: number;
  placedAt: string;
  settledAt: string | null;
  status: BichoBetStatus;
}

export interface BichoListResponse {
  animals: BichoAnimalSummary[];
  bets: BichoBetSummary[];
  currentDraw: BichoCurrentDrawSummary;
  recentDraws: BichoHistoryDrawSummary[];
}

export interface BichoPlaceBetInput {
  amount: number;
  animalNumber?: number;
  dozen?: number;
  mode: BichoBetMode;
}

export interface BichoPlaceBetResponse {
  bet: BichoBetSummary;
  currentDraw: BichoCurrentDrawSummary;
  playerMoneyAfterBet: number;
}

export interface DrugFactoryRequirementSummary {
  availableQuantity: number;
  componentId: string;
  componentName: string;
  quantityPerCycle: number;
}

export interface DrugFactoryRecipeSummary {
  baseProduction: number;
  cycleMinutes: number;
  dailyMaintenanceCost: number;
  drugId: string;
  drugName: string;
  levelRequired: number;
  requirements: DrugFactoryRequirementSummary[];
}

export interface DrugFactorySummary {
  baseProduction: number;
  blockedReason: 'components' | 'maintenance' | null;
  createdAt: string;
  cycleMinutes: number;
  dailyMaintenanceCost: number;
  drugId: string;
  drugName: string;
  id: string;
  maintenanceStatus: {
    blocked: boolean;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  multipliers: {
    impulse: number;
    intelligence: number;
    universityProduction: number;
    vocation: number;
  };
  outputPerCycle: number;
  regionId: RegionId;
  requirements: DrugFactoryRequirementSummary[];
  storedOutput: number;
}

export interface DrugFactoryListResponse {
  availableRecipes: DrugFactoryRecipeSummary[];
  factories: DrugFactorySummary[];
}

export interface DrugFactoryCreateInput {
  drugId: string;
}

export interface DrugFactoryCreateResponse {
  factory: DrugFactorySummary;
}

export interface DrugFactoryStockInput {
  inventoryItemId: string;
  quantity: number;
}

export interface DrugFactoryStockResponse {
  component: {
    id: string;
    name: string;
  };
  factory: DrugFactorySummary;
  transferredQuantity: number;
}

export interface DrugFactoryCollectResponse {
  collectedQuantity: number;
  drug: {
    id: string;
    name: string;
  };
  factory: DrugFactorySummary;
}

export interface DrugSaleInput {
  channel: DrugSaleChannel;
  inventoryItemId: string;
  propertyId?: string;
  quantity: number;
}

export interface DrugSaleModifierSummary {
  label: string;
  multiplier: number;
  source: 'attribute' | 'channel' | 'event' | 'property' | 'region';
}

export interface DrugSaleQuoteResponse {
  channel: {
    commissionRate: number;
    id: DrugSaleChannel;
    label: string;
    propertyTypeRequired: 'boca' | 'rave' | null;
    cansacoCost: number;
  };
  drug: {
    code: string;
    id: string;
    inventoryItemId: string;
    name: string;
  };
  location: {
    propertyId: string | null;
    propertyType: 'boca' | 'rave' | null;
    regionId: RegionId;
  };
  modifiers: DrugSaleModifierSummary[];
  pricing: {
    baseUnitPrice: number;
    commissionAmount: number;
    finalUnitPrice: number;
    grossRevenue: number;
    netRevenue: number;
  };
  quantity: {
    available: number;
    demandCap: number;
    remainingAfterSale: number;
    requested: number;
    sellable: number;
  };
  warnings: string[];
}

export interface DrugSaleExecuteResponse extends DrugSaleQuoteResponse {
  playerMoneyAfterSale: number;
  playerCansacoAfterSale: number;
  soldAt: string;
}

export interface DocksEventStatusResponse {
  endsAt: string | null;
  isActive: boolean;
  phase: DocksEventPhase;
  premiumMultiplier: number;
  regionId: RegionId;
  remainingSeconds: number;
  secondsUntilStart: number;
  startsAt: string | null;
  unlimitedDemand: boolean;
}

export interface PoliceEventStatusItem {
  banditsArrested: number | null;
  banditsKilledEstimate: number | null;
  drugsLost: number | null;
  endsAt: string;
  eventType: PoliceEventType;
  favelaId: string | null;
  favelaName: string | null;
  headline: string | null;
  internalSatisfactionAfter: number | null;
  internalSatisfactionBefore: number | null;
  policePressureAfter: number | null;
  policePressureBefore: number | null;
  regionId: RegionId;
  regionName: string;
  remainingSeconds: number;
  satisfactionAfter: number | null;
  satisfactionBefore: number | null;
  soldiersLost: number | null;
  startedAt: string;
  weaponsLost: number | null;
}

export interface PoliceEventStatusResponse {
  events: PoliceEventStatusItem[];
  generatedAt: string;
}

export interface SeasonalEventStatusItem {
  bonusSummary: string[];
  endsAt: string;
  eventType: SeasonalEventType;
  headline: string;
  policeMood: SeasonalEventPoliceMood;
  regionId: RegionId;
  regionName: string;
  remainingSeconds: number;
  startedAt: string;
}

export interface SeasonalEventStatusResponse {
  events: SeasonalEventStatusItem[];
  generatedAt: string;
}

export interface GameEventResultMetric {
  label: string;
  value: string;
}

export interface GameEventResultSummary {
  body: string;
  destination: GameEventResultDestination;
  eventType: GameEventResultType;
  favelaId: string | null;
  favelaName: string | null;
  headline: string;
  id: string;
  impactSummary: string;
  metrics: GameEventResultMetric[];
  regionId: RegionId | null;
  regionName: string | null;
  resolvedAt: string;
  severity: GameEventResultSeverity;
  startedAt: string;
  title: string;
}

export interface EventResultListResponse {
  generatedAt: string;
  results: GameEventResultSummary[];
}
