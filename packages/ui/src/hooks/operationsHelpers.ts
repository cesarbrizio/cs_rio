import {
  PUTEIRO_MAX_ACTIVE_GPS,
  REGIONS,
  SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
  SLOT_MACHINE_DEFAULT_MAX_BET,
  SLOT_MACHINE_DEFAULT_MIN_BET,
  SLOT_MACHINE_OPERATION_CYCLE_MINUTES,
  type BocaSummary,
  type BocaListResponse,
  type DrugFactoryListResponse,
  type FrontStoreListResponse,
  type FrontStoreSummary,
  type GpTemplateSummary,
  type OwnedPropertySummary,
  type PropertyCatalogResponse,
  type PropertyDefinitionSummary,
  type PropertyPurchaseInput,
  type PropertyType,
  type PuteiroListResponse,
  type PuteiroSummary,
  type RaveListResponse,
  type RaveSummary,
  type RegionId,
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

export interface SlotMachineAcquisitionState {
  baseCapacity: number;
  blockerLabel: string | null;
  canAfford: boolean;
  canPurchase: boolean;
  currentRegionId: RegionId | null;
  currentRegionLabel: string | null;
  definition: PropertyDefinitionSummary | null;
  estimatedHourlyRevenueAtBase: number;
  estimatedHourlyRevenueAtCapacity: number;
  isOwned: boolean;
  isUnlocked: boolean;
  ownedCount: number;
  purchaseInput: PropertyPurchaseInput | null;
}

export interface PuteiroAcquisitionState {
  blockerLabel: string | null;
  canAfford: boolean;
  canPurchase: boolean;
  capacity: number;
  currentRegionId: RegionId | null;
  currentRegionLabel: string | null;
  definition: PropertyDefinitionSummary | null;
  entryTemplate: GpTemplateSummary | null;
  estimatedHourlyRevenueAtCapacity: number;
  estimatedHourlyRevenueAtEntry: number;
  isOwned: boolean;
  isUnlocked: boolean;
  ownedCount: number;
  purchaseInput: PropertyPurchaseInput | null;
  templatesCount: number;
}

export interface PuteiroDashboardSnapshot {
  activeRosterCount: number;
  deceasedRosterCount: number;
  escapedRosterCount: number;
  incidentSummary: string;
  nextStepCopy: string;
  operatingHeadline: string;
  workerStatusSummary: string;
}

export function filterPropertiesByTab(
  properties: OwnedPropertySummary[],
  tab: OperationsTab,
): OwnedPropertySummary[] {
  return properties.filter((property) =>
    tab === 'business' ? isBusinessProperty(property) : !isBusinessProperty(property),
  );
}

export function resolveOperationsTabLabel(tab: OperationsTab): string {
  return tab === 'business' ? 'Operacoes' : 'Base e logistica';
}

export function resolveOperationsTabDescription(tab: OperationsTab): string {
  if (tab === 'business') {
    return 'Ativos que giram caixa, exigem coleta e as vezes pedem configuracao operacional.';
  }

  return 'Imoveis, veiculos e luxo que ampliam mobilidade, slots, recuperacao e protecao.';
}

export function isBusinessProperty(property: OwnedPropertySummary): boolean {
  return property.definition.assetClass === 'business';
}

export function sumPropertyDailyUpkeep(properties: OwnedPropertySummary[]): number {
  return properties.reduce(
    (total, property) => total + property.economics.totalDailyUpkeep,
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

export function buildSlotMachineAcquisitionState(input: {
  availableProperties: PropertyDefinitionSummary[];
  ownedProperties: OwnedPropertySummary[];
  playerLevel: number;
  playerMoney: number;
  playerRegionId?: RegionId | null;
}): SlotMachineAcquisitionState {
  const definition =
    input.availableProperties.find((propertyDefinition) => propertyDefinition.type === 'slot_machine') ?? null;
  const ownedCount = input.ownedProperties.filter((property) => property.type === 'slot_machine').length;
  const currentRegionId = input.playerRegionId ?? null;
  const isOwned = ownedCount > 0;
  const isUnlocked = definition ? input.playerLevel >= definition.unlockLevel : false;
  const canAfford = definition ? input.playerMoney >= definition.basePrice : false;
  const purchaseInput =
    definition && currentRegionId
      ? {
          regionId: currentRegionId,
          type: 'slot_machine' as const,
        }
      : null;
  const baseCapacity = definition ? resolveSlotMachineCapacity(1) : 0;
  const estimatedHourlyRevenueAtBase = definition ? estimateSlotMachineHourlyRevenue(1) : 0;
  const estimatedHourlyRevenueAtCapacity = definition
    ? estimateSlotMachineHourlyRevenue(baseCapacity)
    : 0;

  let blockerLabel: string | null = null;

  if (!definition) {
    blockerLabel = 'Maquininha indisponivel no catalogo autoritativo.';
  } else if (isOwned) {
    blockerLabel = 'Voce ja possui uma maquininha. Use o card do ativo para instalar, configurar e coletar.';
  } else if (!currentRegionId) {
    blockerLabel = 'Defina uma regiao valida antes de comprar a maquininha.';
  } else if (!isUnlocked) {
    blockerLabel = `Nivel ${definition.unlockLevel} necessario para liberar esta compra.`;
  } else if (!canAfford) {
    blockerLabel = `Faltam ${formatOperationsCurrency(definition.basePrice - input.playerMoney)} para comprar agora.`;
  }

  return {
    baseCapacity,
    blockerLabel,
    canAfford,
    canPurchase: Boolean(definition && purchaseInput && !isOwned && isUnlocked && canAfford),
    currentRegionId,
    currentRegionLabel: currentRegionId ? resolvePropertyRegionLabel(currentRegionId) : null,
    definition,
    estimatedHourlyRevenueAtBase,
    estimatedHourlyRevenueAtCapacity,
    isOwned,
    isUnlocked,
    ownedCount,
    purchaseInput,
  };
}

export function buildPuteiroAcquisitionState(input: {
  availableProperties: PropertyDefinitionSummary[];
  gpTemplates: GpTemplateSummary[];
  ownedProperties: OwnedPropertySummary[];
  playerLevel: number;
  playerMoney: number;
  playerRegionId?: RegionId | null;
}): PuteiroAcquisitionState {
  const definition =
    input.availableProperties.find((propertyDefinition) => propertyDefinition.type === 'puteiro') ?? null;
  const ownedCount = input.ownedProperties.filter((property) => property.type === 'puteiro').length;
  const currentRegionId = input.playerRegionId ?? null;
  const isOwned = ownedCount > 0;
  const isUnlocked = definition ? input.playerLevel >= definition.unlockLevel : false;
  const canAfford = definition ? input.playerMoney >= definition.basePrice : false;
  const purchaseInput =
    definition && currentRegionId
      ? {
          regionId: currentRegionId,
          type: 'puteiro' as const,
        }
      : null;
  const entryTemplate =
    [...input.gpTemplates].sort((left, right) => {
      const byPrice = left.purchasePrice - right.purchasePrice;

      if (byPrice !== 0) {
        return byPrice;
      }

      return left.label.localeCompare(right.label, 'pt-BR');
    })[0] ?? null;
  const bestRevenueTemplate =
    [...input.gpTemplates].sort((left, right) => right.baseDailyRevenue - left.baseDailyRevenue)[0] ?? null;
  const estimatedHourlyRevenueAtEntry = entryTemplate
    ? roundOperationsCurrency(entryTemplate.baseDailyRevenue / 24)
    : 0;
  const estimatedHourlyRevenueAtCapacity = bestRevenueTemplate
    ? roundOperationsCurrency((bestRevenueTemplate.baseDailyRevenue * PUTEIRO_MAX_ACTIVE_GPS) / 24)
    : 0;

  let blockerLabel: string | null = null;

  if (!definition) {
    blockerLabel = 'Puteiro indisponivel no catalogo autoritativo.';
  } else if (input.gpTemplates.length === 0) {
    blockerLabel = 'Catalogo de GPs indisponivel. Aguarde o backend liberar os templates.';
  } else if (isOwned) {
    blockerLabel = 'Voce ja possui um puteiro. Use o painel abaixo para contratar GPs e coletar o caixa.';
  } else if (!currentRegionId) {
    blockerLabel = 'Defina uma regiao valida antes de comprar o puteiro.';
  } else if (!isUnlocked) {
    blockerLabel = `Nivel ${definition.unlockLevel} necessario para liberar esta compra.`;
  } else if (!canAfford) {
    blockerLabel = `Faltam ${formatOperationsCurrency(definition.basePrice - input.playerMoney)} para comprar agora.`;
  }

  return {
    blockerLabel,
    canAfford,
    canPurchase: Boolean(
      definition &&
        input.gpTemplates.length > 0 &&
        purchaseInput &&
        !isOwned &&
        isUnlocked &&
        canAfford
    ),
    capacity: PUTEIRO_MAX_ACTIVE_GPS,
    currentRegionId,
    currentRegionLabel: currentRegionId ? resolvePropertyRegionLabel(currentRegionId) : null,
    definition,
    entryTemplate,
    estimatedHourlyRevenueAtCapacity,
    estimatedHourlyRevenueAtEntry,
    isOwned,
    isUnlocked,
    ownedCount,
    purchaseInput,
    templatesCount: input.gpTemplates.length,
  };
}

export function buildPuteiroDashboardSnapshot(puteiro: PuteiroSummary): PuteiroDashboardSnapshot {
  const activeRosterCount = puteiro.roster.filter((worker) => worker.status === 'active').length;
  const escapedRosterCount = puteiro.roster.filter((worker) => worker.status === 'escaped').length;
  const deceasedRosterCount = puteiro.roster.filter((worker) => worker.status === 'deceased').length;
  const activeWorkersWithDst = puteiro.roster.filter(
    (worker) => worker.status === 'active' && worker.hasDst,
  ).length;

  let operatingHeadline = 'Casa operando com elenco ativo, caixa girando e risco sob observacao.';
  let nextStepCopy = 'Operacao estavel. Monitore DST nas GPs, colete o caixa e reforce o elenco quando abrir vaga.';

  if (puteiro.status === 'maintenance_blocked') {
    operatingHeadline = 'Manutencao vencida travou a casa e derrubou o giro do negocio.';
    nextStepCopy = `Sincronize a manutencao e quite o atraso de ${puteiro.maintenanceStatus.overdueDays} dia(s) antes de expandir o elenco.`;
  } else if (puteiro.status === 'no_gps' || puteiro.economics.activeGps === 0) {
    operatingHeadline = 'Casa aberta, mas sem GPs ativas. Sem elenco nao existe receita real.';
    nextStepCopy = 'Contrate pelo menos uma GP para destravar receita, incidentes operacionais e coleta de caixa.';
  } else if (puteiro.economics.availableSlots > 0) {
    operatingHeadline = 'Casa operando, mas ainda com vagas abertas para ampliar o giro por hora.';
    nextStepCopy = `Ainda cabem ${puteiro.economics.availableSlots} GPs. Reforce o elenco para acelerar a receita.`;
  } else if (puteiro.cashbox.availableToCollect > 0) {
    operatingHeadline = 'Casa lotada e caixa acumulando. O foco agora e coletar sem perder o controle do risco.';
    nextStepCopy = 'Elenco cheio. Colete o caixa e acompanhe DST nas GPs, fugas e mortes para nao perder margem.';
  }

  return {
    activeRosterCount,
    deceasedRosterCount,
    escapedRosterCount,
    incidentSummary: `DST ativas nas GPs ${puteiro.incidents.activeDstCases} · fugas ${puteiro.incidents.totalEscapes} · mortes ${puteiro.incidents.totalDeaths}`,
    nextStepCopy,
    operatingHeadline,
    workerStatusSummary: `${activeRosterCount} ativas · ${activeWorkersWithDst} GPs com DST · ${escapedRosterCount} fugiram · ${deceasedRosterCount} morreram`,
  };
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

export function resolvePropertyAssetClassLabel(definition: PropertyDefinitionSummary): string {
  switch (definition.assetClass) {
    case 'business':
      return 'Negocio';
    case 'real_estate':
      return 'Imovel';
    case 'vehicle':
      return 'Veiculo';
    case 'luxury':
    default:
      return 'Ativo especial';
  }
}

export function resolvePropertyUtilityLines(definition: PropertyDefinitionSummary): string[] {
  const lines: string[] = [];

  if (definition.utility.inventorySlotsBonus > 0) {
    lines.push(`+${definition.utility.inventorySlotsBonus} slots no inventario`);
  }

  if (definition.utility.inventoryWeightBonus > 0) {
    lines.push(`+${definition.utility.inventoryWeightBonus} de carga`);
  }

  if (definition.utility.cansacoRecoveryPerHourBonus > 0) {
    lines.push(`+${definition.utility.cansacoRecoveryPerHourBonus}/h de recuperacao de cansaco`);
  }

  if (definition.utility.travelMode === 'ground') {
    lines.push('Mobilidade terrestre');
  } else if (definition.utility.travelMode === 'sea') {
    lines.push('Mobilidade maritima');
  } else if (definition.utility.travelMode === 'air') {
    lines.push('Mobilidade aerea');
  }

  if (lines.length === 0) {
    lines.push('Ativo patrimonial voltado a protecao, logistica e conforto.');
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
        `Bloqueio: ${factory.blockedReason ?? 'livre'}`,
        `Multiplicador total: x${(factory.multipliers.impulse * factory.multipliers.intelligence * factory.multipliers.vocation).toFixed(2)}`,
      ],
      estimatedHourlyLabel: `${Number.parseFloat(((60 / factory.cycleMinutes) * factory.outputPerCycle).toFixed(1))}x/h`,
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
        `Investigacao ativa: ${frontStore.investigation.isUnderInvestigation ? 'Sim' : 'Nao'}`,
      ],
      estimatedHourlyLabel: formatOperationsCurrency(frontStore.economics.estimatedHourlyLegitRevenue),
      readyToCollect: frontStore.cashbox.availableToCollect > 0,
      statusLabel: frontStore.status === 'investigation_blocked' ? 'Investigacao em curso' : 'Fachada operando',
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
      statusLabel: slotMachine.status === 'installation_required' ? 'Instalacao pendente' : 'Sala operando',
    };
  }

  return null;
}

export function resolvePuteiroWorkerStatusLabel(worker: PuteiroSummary['roster'][number]): string {
  if (worker.status === 'deceased') {
    return 'Falecida';
  }

  if (worker.status === 'escaped') {
    return 'Fugiu';
  }

  if (worker.hasDst) {
    return 'Ativa com DST';
  }

  return 'Ativa';
}

export function resolvePropertyTypeLabel(type: PropertyType): string {
  return {
    airplane: 'Aviao',
    art: 'Arte',
    beach_house: 'Casa de Praia',
    boca: 'Boca',
    boat: 'Barco',
    car: 'Carro',
    factory: 'Fabrica',
    front_store: 'Loja de Fachada',
    helicopter: 'Helicoptero',
    house: 'Casa',
    jet_ski: 'Jet Ski',
    jewelry: 'Joias',
    luxury: 'Luxo',
    mansion: 'Mansao',
    puteiro: 'Puteiro',
    rave: 'Rave',
    slot_machine: 'Maquininha',
    yacht: 'Iate',
  }[type];
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

function resolveCashOperationDetailLines(
  operation: BocaSummary | FrontStoreSummary | PuteiroSummary | RaveSummary | SlotMachineSummary,
): string[] {
  if ('stock' in operation) {
    return [
      `Estoque total: ${operation.stockUnits} un`,
      `Demanda por ciclo: ${operation.economics.npcDemandPerCycle}`,
      `Comissao faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  if ('lineup' in operation) {
    return [
      `Itens no lineup: ${operation.lineup.length}`,
      `Fluxo por ciclo: ${operation.economics.visitorFlowPerCycle}`,
      `Comissao faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  if ('roster' in operation) {
    return [
      `GPs ativos: ${operation.economics.activeGps}/${operation.economics.capacity}`,
      `DST ativas nas GPs: ${operation.incidents.activeDstCases}`,
      `Comissao faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  if ('investigation' in operation) {
    return [
      `Capacidade de lavagem: ${formatOperationsCurrency(operation.economics.launderingCapacityRemaining)}`,
      `Investigacoes totais: ${operation.investigation.investigationsTotal}`,
      `Comissao faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
    ];
  }

  return [
    `Maquinas: ${operation.economics.installedMachines}/${operation.economics.capacity}`,
    `Trafego local: x${operation.economics.playerTrafficMultiplier.toFixed(2)}`,
    `Comissao faccional: ${formatPercent(operation.economics.effectiveFactionCommissionRate)}`,
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
    return 'Manutencao travando a operacao';
  }

  if (status.includes('stock') || status.includes('lineup') || status.includes('gps')) {
    return 'Operacao pedindo reposicao';
  }

  if (status.includes('investigation')) {
    return 'Operacao travada por investigacao';
  }

  if (status.includes('installation')) {
    return 'Instalacao pendente';
  }

  return 'Operacao estavel';
}

function estimateSlotMachineHourlyRevenue(installedMachines: number): number {
  const averageBet = Math.sqrt(
    Math.max(100, SLOT_MACHINE_DEFAULT_MIN_BET) * Math.max(SLOT_MACHINE_DEFAULT_MIN_BET, SLOT_MACHINE_DEFAULT_MAX_BET),
  );
  const playsPerMachine = 1.15;
  const grossHandle = averageBet * installedMachines * playsPerMachine;
  const expectedGrossRevenuePerCycle = grossHandle * SLOT_MACHINE_DEFAULT_HOUSE_EDGE;

  return roundOperationsCurrency(
    expectedGrossRevenuePerCycle * (60 / SLOT_MACHINE_OPERATION_CYCLE_MINUTES),
  );
}

function resolveSlotMachineCapacity(level: number): number {
  return 3 + level * 2;
}

function roundOperationsCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
