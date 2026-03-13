import {
  REGIONS,
  type BocaSummary,
  type BocaListResponse,
  type DrugFactoryListResponse,
  type FrontStoreListResponse,
  type FrontStoreSummary,
  type OwnedPropertySummary,
  type PropertyCatalogResponse,
  type PropertyDefinitionSummary,
  type PropertyType,
  type PuteiroListResponse,
  type PuteiroSummary,
  type RaveListResponse,
  type RaveSummary,
  type SlotMachineListResponse,
  type SlotMachineSummary,
} from '@cs-rio/shared';

export type OperationsTab = 'business' | 'patrimony';

export interface OperationsDashboardData {
  bocaBook: BocaListResponse;
  factoryBook: DrugFactoryListResponse;
  frontStoreBook: FrontStoreListResponse;
  propertyBook: PropertyCatalogResponse;
  puteiroBook: PuteiroListResponse;
  raveBook: RaveListResponse;
  slotMachineBook: SlotMachineListResponse;
}

export interface PropertyOperationSnapshot {
  actionLabel: string;
  availableToCollect: number;
  collectTone: 'bank' | 'cash' | 'inventory';
  collectableLabel: string;
  detailLines: string[];
  estimatedHourlyLabel: string;
  readyToCollect: boolean;
  statusLabel: string;
}

export function filterPropertiesByTab(
  properties: OwnedPropertySummary[],
  tab: OperationsTab,
): OwnedPropertySummary[] {
  return properties.filter((property) =>
    tab === 'business' ? isBusinessProperty(property) : !isBusinessProperty(property),
  );
}

export function isBusinessProperty(property: OwnedPropertySummary): boolean {
  return property.definition.assetClass === 'business';
}

export function sumPropertyPrestige(properties: OwnedPropertySummary[]): number {
  return properties.reduce(
    (total, property) => total + property.economics.effectivePrestigeScore,
    0,
  );
}

export function sumCollectableCash(book: OperationsDashboardData): number {
  return [
    ...book.bocaBook.bocas.map((boca) => boca.cashbox.availableToCollect),
    ...book.raveBook.raves.map((rave) => rave.cashbox.availableToCollect),
    ...book.puteiroBook.puteiros.map((puteiro) => puteiro.cashbox.availableToCollect),
    ...book.frontStoreBook.frontStores.map((frontStore) => frontStore.cashbox.availableToCollect),
    ...book.slotMachineBook.slotMachines.map((slotMachine) => slotMachine.cashbox.availableToCollect),
  ].reduce((total, value) => total + value, 0);
}

export function countOperationalAlerts(properties: OwnedPropertySummary[]): number {
  return properties.filter((property) => {
    if (property.maintenanceStatus.blocked) {
      return true;
    }

    return (
      property.protection.invasionRisk >= 45 ||
      property.protection.robberyRisk >= 45 ||
      property.protection.takeoverRisk >= 35
    );
  }).length;
}

export function countReadyOperations(book: OperationsDashboardData): number {
  const readyFactories = book.factoryBook.factories.filter((factory) => factory.storedOutput > 0).length;
  const readyCashBusinesses = [
    ...book.bocaBook.bocas,
    ...book.raveBook.raves,
    ...book.puteiroBook.puteiros,
    ...book.frontStoreBook.frontStores,
    ...book.slotMachineBook.slotMachines,
  ].filter((entry) => entry.cashbox.availableToCollect > 0).length;

  return readyFactories + readyCashBusinesses;
}

export function formatOperationsCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function resolvePropertyRegionLabel(regionId: string): string {
  return REGIONS.find((region) => region.id === regionId)?.label ?? regionId;
}

export function resolveTravelModeLabel(definition: PropertyDefinitionSummary): string | null {
  if (definition.utility.travelMode === 'ground') {
    return 'Mobilidade terrestre';
  }

  if (definition.utility.travelMode === 'sea') {
    return 'Mobilidade maritima';
  }

  if (definition.utility.travelMode === 'air') {
    return 'Mobilidade aerea';
  }

  return null;
}

export function resolvePropertyUtilityLines(definition: PropertyDefinitionSummary): string[] {
  const lines: string[] = [];

  if (definition.utility.inventorySlotsBonus > 0) {
    lines.push(`+${definition.utility.inventorySlotsBonus} slots no inventário`);
  }

  if (definition.utility.inventoryWeightBonus > 0) {
    lines.push(`+${definition.utility.inventoryWeightBonus} de carga`);
  }

  if (definition.utility.staminaRecoveryPerHourBonus > 0) {
    lines.push(`+${definition.utility.staminaRecoveryPerHourBonus}/h de recuperação de estamina`);
  }

  const travelModeLabel = resolveTravelModeLabel(definition);

  if (travelModeLabel) {
    lines.push(travelModeLabel);
  }

  if (lines.length === 0) {
    lines.push('Ativo patrimonial voltado a prestígio e proteção.');
  }

  return lines;
}

export function resolvePropertyOperationSnapshot(
  property: OwnedPropertySummary,
  book: OperationsDashboardData,
): PropertyOperationSnapshot | null {
  if (property.type === 'factory') {
    const factory = book.factoryBook.factories.find((entry) => entry.id === property.id);

    if (!factory) {
      return null;
    }

    return {
      actionLabel: 'Coletar producao',
      availableToCollect: factory.storedOutput,
      collectTone: 'inventory',
      collectableLabel: `${factory.storedOutput}x ${factory.drugName}`,
      detailLines: [
        `Producao por ciclo: ${factory.outputPerCycle}x`,
        `Bloqueio: ${resolveFactoryBlockedReason(factory)}`,
        `Multiplicador total: x${(factory.multipliers.impulse * factory.multipliers.intelligence * factory.multipliers.vocation).toFixed(2)}`,
      ],
      estimatedHourlyLabel: `${resolveFactoryHourlyOutput(factory)}x/h`,
      readyToCollect: factory.storedOutput > 0,
      statusLabel: factory.blockedReason ? 'Cadeia produtiva pressionada' : 'Linha operando',
    };
  }

  if (property.type === 'boca') {
    const boca = book.bocaBook.bocas.find((entry) => entry.id === property.id);
    return boca ? resolveCashOperationSnapshot(boca, 'Coletar caixa', 'cash') : null;
  }

  if (property.type === 'rave') {
    const rave = book.raveBook.raves.find((entry) => entry.id === property.id);
    return rave ? resolveCashOperationSnapshot(rave, 'Coletar bilheteria', 'cash') : null;
  }

  if (property.type === 'puteiro') {
    const puteiro = book.puteiroBook.puteiros.find((entry) => entry.id === property.id);
    return puteiro ? resolveCashOperationSnapshot(puteiro, 'Coletar caixa', 'cash') : null;
  }

  if (property.type === 'front_store') {
    const frontStore = book.frontStoreBook.frontStores.find((entry) => entry.id === property.id);

    if (!frontStore) {
      return null;
    }

    return {
      actionLabel: 'Coletar limpo',
      availableToCollect: frontStore.cashbox.availableToCollect,
      collectTone: 'bank',
      collectableLabel: formatOperationsCurrency(frontStore.cashbox.availableToCollect),
      detailLines: [
        `Lavado: ${formatOperationsCurrency(frontStore.cashbox.totalLaunderedClean)}`,
        `Capacidade restante: ${formatOperationsCurrency(frontStore.economics.launderingCapacityRemaining)}`,
        `Investigação ativa: ${frontStore.investigation.isUnderInvestigation ? 'Sim' : 'Não'}`,
      ],
      estimatedHourlyLabel: formatOperationsCurrency(frontStore.economics.estimatedHourlyLegitRevenue),
      readyToCollect: frontStore.cashbox.availableToCollect > 0,
      statusLabel: frontStore.status === 'investigation_blocked' ? 'Investigação em curso' : 'Fachada operando',
    };
  }

  if (property.type === 'slot_machine') {
    const slotMachine = book.slotMachineBook.slotMachines.find((entry) => entry.id === property.id);

    if (!slotMachine) {
      return null;
    }

    return {
      actionLabel: 'Coletar caixa',
      availableToCollect: slotMachine.cashbox.availableToCollect,
      collectTone: 'cash',
      collectableLabel: formatOperationsCurrency(slotMachine.cashbox.availableToCollect),
      detailLines: [
        `Maquinas instaladas: ${slotMachine.economics.installedMachines}/${slotMachine.economics.capacity}`,
        `House edge: ${formatPercent(slotMachine.config.houseEdge)}`,
        `Jackpot: ${formatPercent(slotMachine.config.jackpotChance)}`,
      ],
      estimatedHourlyLabel: formatOperationsCurrency(slotMachine.economics.estimatedHourlyGrossRevenue),
      readyToCollect: slotMachine.cashbox.availableToCollect > 0,
      statusLabel: slotMachine.status === 'installation_required' ? 'Instalação pendente' : 'Sala operando',
    };
  }

  return null;
}

function resolveCashOperationSnapshot(
  operation: BocaSummary | FrontStoreSummary | PuteiroSummary | RaveSummary | SlotMachineSummary,
  actionLabel: string,
  collectTone: 'bank' | 'cash',
): PropertyOperationSnapshot {
  return {
    actionLabel,
    availableToCollect: operation.cashbox.availableToCollect,
    collectTone,
    collectableLabel: formatOperationsCurrency(operation.cashbox.availableToCollect),
    detailLines: resolveCashOperationDetailLines(operation),
    estimatedHourlyLabel: formatOperationsCurrency(resolveEstimatedHourlyValue(operation)),
    readyToCollect: operation.cashbox.availableToCollect > 0,
    statusLabel: resolveBusinessStatusLabel(operation.status),
  };
}

function resolveFactoryBlockedReason(factory: DrugFactoryListResponse['factories'][number]): string {
  if (factory.blockedReason === 'components') {
    return 'faltando componente';
  }

  if (factory.blockedReason === 'maintenance') {
    return 'manutenção vencida';
  }

  return 'livre';
}

function resolveFactoryHourlyOutput(factory: DrugFactoryListResponse['factories'][number]): number {
  return Number.parseFloat(((60 / factory.cycleMinutes) * factory.outputPerCycle).toFixed(1));
}

function resolveCashOperationDetailLines(
  operation: BocaSummary | FrontStoreSummary | PuteiroSummary | RaveSummary | SlotMachineSummary,
): string[] {
  if ('stock' in operation) {
    return [
      `Estoque total: ${operation.stockUnits} un`,
      `Demanda por ciclo: ${operation.economics.npcDemandPerCycle}`,
      `Comissão faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  if ('lineup' in operation) {
    return [
      `Itens no lineup: ${operation.lineup.length}`,
      `Fluxo por ciclo: ${operation.economics.visitorFlowPerCycle}`,
      `Comissão faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  if ('roster' in operation) {
    return [
      `GPs ativos: ${operation.economics.activeGps}/${operation.economics.capacity}`,
      `DST ativas: ${operation.incidents.activeDstCases}`,
      `Comissão faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  if ('investigation' in operation) {
    return [
      `Capacidade de lavagem: ${formatOperationsCurrency(operation.economics.launderingCapacityRemaining)}`,
      `Investigações totais: ${operation.investigation.investigationsTotal}`,
      `Comissão faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  return [
    `Maquinas: ${operation.economics.installedMachines}/${operation.economics.capacity}`,
    `Trafego local: x${operation.economics.playerTrafficMultiplier.toFixed(2)}`,
    `Comissão faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
  ];
}

function resolveEstimatedHourlyValue(
  operation: BocaSummary | FrontStoreSummary | PuteiroSummary | RaveSummary | SlotMachineSummary,
): number {
  if ('investigation' in operation) {
    return operation.economics.estimatedHourlyLegitRevenue;
  }

  return operation.economics.estimatedHourlyGrossRevenue;
}

function resolveBusinessStatusLabel(status: string): string {
  if (status.includes('maintenance')) {
    return 'Manutenção travando a operação';
  }

  if (status.includes('stock') || status.includes('lineup') || status.includes('gps')) {
    return 'Operação pedindo reposição';
  }

  if (status.includes('investigation')) {
    return 'Operação travada por investigação';
  }

  if (status.includes('installation')) {
    return 'Instalação pendente';
  }

  return 'Operação estável';
}

export function resolvePropertyTypeLabel(type: PropertyType): string {
  return {
    airplane: 'Avião',
    art: 'Arte',
    beach_house: 'Casa de Praia',
    boca: 'Boca',
    boat: 'Barco',
    car: 'Carro',
    factory: 'Fábrica',
    front_store: 'Loja de Fachada',
    helicopter: 'Helicóptero',
    house: 'Casa',
    jet_ski: 'Jet Ski',
    jewelry: 'Joias',
    luxury: 'Luxo',
    mansion: 'Mansão',
    puteiro: 'Puteiro',
    rave: 'Rave',
    slot_machine: 'Maquininha',
    yacht: 'Iate',
  }[type];
}
