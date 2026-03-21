import {
  REGIONS,
  SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
  SLOT_MACHINE_DEFAULT_MAX_BET,
  SLOT_MACHINE_DEFAULT_MIN_BET,
  SLOT_MACHINE_OPERATION_CYCLE_MINUTES,
  type BocaSummary,
  type FrontStoreSummary,
  type OwnedPropertySummary,
  type PropertyDefinitionSummary,
  type PropertyType,
  type PuteiroSummary,
  type RaveSummary,
  type SlotMachineSummary,
} from '@cs-rio/shared';

import type {
  OperationsDashboardData,
  PropertyOperationSnapshot,
} from './operationsHelpers';

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
  switch (definition.category) {
    case 'business':
      return 'Negocio';
    case 'realty':
      return 'Imovel';
    case 'luxury_item':
      return 'Artigo de luxo';
  }
}

export function resolvePropertyStockLabel(definition: PropertyDefinitionSummary): string {
  if (definition.stockAvailable === null) {
    return 'Sem limite';
  }

  if (definition.stockAvailable <= 0) {
    return 'Esgotado';
  }

  return `${definition.stockAvailable} restante(s)`;
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

export function estimateSlotMachineHourlyRevenue(installedMachines: number): number {
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

export function resolveSlotMachineCapacity(level: number): number {
  return 3 + level * 2;
}

export function roundOperationsCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
