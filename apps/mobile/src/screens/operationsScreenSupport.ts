import {
  SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
  SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
  SLOT_MACHINE_DEFAULT_MAX_BET,
  SLOT_MACHINE_DEFAULT_MIN_BET,
  type OwnedPropertySummary,
} from '@cs-rio/shared';

import { formatOperationsCurrency } from '../features/operations';
import {
  bocaApi,
  factoryApi,
  frontStoreApi,
  puteiroApi,
  raveApi,
  slotMachineApi,
} from '../services/api';

export const HIRE_QUANTITY_OPTIONS = [1, 3, 5] as const;

export type HireQuantity = (typeof HIRE_QUANTITY_OPTIONS)[number];
export type SlotMachineActionMode = 'configure' | 'install' | null;

export interface OperationResultState {
  message: string;
  title: string;
}

export const DEFAULT_SLOT_MACHINE_INSTALL_QUANTITY_INPUT = '1';
export const DEFAULT_SLOT_MACHINE_HOUSE_EDGE_INPUT = formatPercentageInput(
  SLOT_MACHINE_DEFAULT_HOUSE_EDGE,
);
export const DEFAULT_SLOT_MACHINE_JACKPOT_INPUT = formatPercentageInput(
  SLOT_MACHINE_DEFAULT_JACKPOT_CHANCE,
);
export const DEFAULT_SLOT_MACHINE_MIN_BET_INPUT = String(SLOT_MACHINE_DEFAULT_MIN_BET);
export const DEFAULT_SLOT_MACHINE_MAX_BET_INPUT = String(SLOT_MACHINE_DEFAULT_MAX_BET);

export async function collectPropertyOperation(
  property: OwnedPropertySummary,
): Promise<string> {
  if (property.type === 'boca') {
    const response = await bocaApi.collect(property.id);
    return `Coletado ${formatOperationsCurrency(response.collectedAmount)} da boca.`;
  }

  if (property.type === 'rave') {
    const response = await raveApi.collect(property.id);
    return `Coletado ${formatOperationsCurrency(response.collectedAmount)} da rave.`;
  }

  if (property.type === 'puteiro') {
    const response = await puteiroApi.collect(property.id);
    return `Coletado ${formatOperationsCurrency(response.collectedAmount)} do puteiro.`;
  }

  if (property.type === 'front_store') {
    const response = await frontStoreApi.collect(property.id);
    return `Coletado ${formatOperationsCurrency(response.collectedAmount)} limpos para o banco.`;
  }

  if (property.type === 'slot_machine') {
    const response = await slotMachineApi.collect(property.id);
    return `Coletado ${formatOperationsCurrency(response.collectedAmount)} das maquininhas.`;
  }

  if (property.type === 'factory') {
    const response = await factoryApi.collect(property.id);
    return `Coletado ${response.collectedQuantity}x ${response.drug.name} da fábrica.`;
  }

  throw new Error('Este ativo não gera coleta operacional.');
}

export function sanitizePositiveInteger(value: string): number {
  const normalized = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function sanitizeDecimalInput(value: string): string {
  return value
    .replace(',', '.')
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1');
}

export function sanitizePercentageInput(value: string): number {
  const normalized = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(normalized) ? normalized / 100 : 0;
}

export function formatPercentageInput(value: number): string {
  return `${Math.round(value * 1000) / 10}`.replace(/\.0$/, '');
}

export function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}
