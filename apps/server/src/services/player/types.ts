import type {
  DrugType,
  InventoryEquipSlot,
  InventoryGrantInput,
  InventoryItemType,
  PlayerCreationInput,
  PlayerFactionSummary,
  PlayerInventoryItem,
  PlayerPropertySummary,
  RegionId,
} from '@cs-rio/shared';

import type { AddictionSystem } from '../../systems/AddictionSystem.js';
import type { DrugToleranceSystem } from '../../systems/DrugToleranceSystem.js';
import type { LevelSystem } from '../../systems/LevelSystem.js';
import type { NerveSystem } from '../../systems/NerveSystem.js';
import type { OverdoseSystem } from '../../systems/OverdoseSystem.js';
import type { PrisonSystemContract } from '../../systems/PrisonSystem.js';
import type { StaminaSystem } from '../../systems/StaminaSystem.js';
import type { KeyValueStore } from '../auth.js';
import type { AuthPlayerRecord } from '../auth.js';
import type { FactionUpgradeEffectReaderContract } from '../faction/types.js';

export interface PlayerProfileRecord {
  faction: PlayerFactionSummary | null;
  inventory: PlayerInventoryItem[];
  player: AuthPlayerRecord;
  properties: PlayerPropertySummary[];
}

export interface InventoryDefinitionRecord {
  durabilityMax: number | null;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  levelRequired: number | null;
  stackable: boolean;
  unitWeight: number;
}

export interface DrugDefinitionRecord {
  addictionRate: number;
  code: string;
  drugId: string;
  moralBoost: number;
  name: string;
  nerveBoost: number;
  productionLevel: number;
  staminaRecovery: number;
  type: DrugType;
}

export interface PlayerRepository {
  applyDrugOverdosePenalties(
    playerId: string,
    input: PlayerOverdosePenaltyInput,
  ): Promise<PlayerOverdosePenaltyResult | null>;
  clearInventoryEquipSlot(playerId: string, equipSlot: InventoryEquipSlot): Promise<void>;
  consumeDrugInventoryItem(
    playerId: string,
    inventoryItemId: string,
    input: PlayerDrugConsumptionInput,
  ): Promise<boolean>;
  createCharacter(playerId: string, input: PlayerCreationInput): Promise<PlayerProfileRecord | null>;
  deleteInventoryItem(playerId: string, inventoryItemId: string): Promise<boolean>;
  getDrugDefinition(drugId: string): Promise<DrugDefinitionRecord | null>;
  getInventoryDefinition(
    itemType: InventoryItemType,
    itemId: string,
  ): Promise<InventoryDefinitionRecord | null>;
  getPlayerProfile(playerId: string): Promise<PlayerProfileRecord | null>;
  grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<void>;
  repairInventoryItem(
    playerId: string,
    inventoryItemId: string,
    nextDurability: number,
    repairCost: number,
  ): Promise<boolean>;
  travelToRegion(playerId: string, regionId: RegionId): Promise<PlayerProfileRecord | null>;
  setInventoryEquipSlot(
    playerId: string,
    inventoryItemId: string,
    equipSlot: InventoryEquipSlot | null,
  ): Promise<boolean>;
  updateInventoryItemQuantity(
    playerId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<boolean>;
  updateRuntimeState(playerId: string, input: PlayerRuntimeStateInput): Promise<void>;
}

export interface PlayerRuntimeStateInput {
  addiction: number;
  level: number;
  morale: number;
  nerve: number;
  stamina: number;
}

export interface PlayerDrugConsumptionInput {
  addiction: number;
  morale: number;
  nerve: number;
  stamina: number;
}

export interface PlayerOverdosePenaltyInput {
  addiction: number;
  conceito: number;
  morale: number;
}

export interface PlayerOverdosePenaltyResult {
  knownContactsLost: number;
}

export interface PlayerServiceOptions {
  addictionSystem?: AddictionSystem;
  drugToleranceSystem?: DrugToleranceSystem;
  factionUpgradeReader?: FactionUpgradeEffectReaderContract;
  keyValueStore?: KeyValueStore;
  levelSystem?: LevelSystem;
  nerveSystem?: NerveSystem;
  overdoseSystem?: OverdoseSystem;
  prisonSystem?: PrisonSystemContract;
  repository?: PlayerRepository;
  staminaSystem?: StaminaSystem;
}

type PlayerErrorCode = 'conflict' | 'not_found' | 'unauthorized' | 'validation';

export class PlayerError extends Error {
  constructor(
    public readonly code: PlayerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PlayerError';
  }
}
