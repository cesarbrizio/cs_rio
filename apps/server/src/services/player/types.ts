import type {
  DrugType,
  InventoryEquipSlot,
  InventoryGrantInput,
  InventoryItemType,
  PlayerVocationChangeInput,
  PlayerPublicProfileRanking,
  PlayerInventoryEquipmentSummary,
  PlayerCreationInput,
  PlayerFactionSummary,
  PlayerInventoryItem,
  PlayerPropertySummary,
  RegionId,
} from '@cs-rio/shared';

import type { AddictionSystem } from '../../systems/AddictionSystem.js';
import type { DrugToleranceSystem } from '../../systems/DrugToleranceSystem.js';
import type { LevelSystem } from '../../systems/LevelSystem.js';
import type { DisposicaoSystem } from '../../systems/DisposicaoSystem.js';
import type { OverdoseSystem } from '../../systems/OverdoseSystem.js';
import type { PrisonSystemContract } from '../../systems/PrisonSystem.js';
import type { CansacoSystem } from '../../systems/CansacoSystem.js';
import { DomainError, inferDomainErrorCategory } from '../../errors/domain-error.js';
import type { KeyValueStore } from '../auth.js';
import type { AuthPlayerRecord } from '../auth.js';
import type { FactionUpgradeEffectReaderContract } from '../faction/types.js';

export interface PlayerProfileRecord {
  faction: PlayerFactionSummary | null;
  inventory: PlayerInventoryItem[];
  player: AuthPlayerRecord;
  properties: PlayerPropertySummary[];
}

export interface PlayerPublicProfileRecord {
  faction: PlayerFactionSummary | null;
  inventoryItemCount: number;
  player: AuthPlayerRecord;
  propertiesCount: number;
  ranking: PlayerPublicProfileRanking;
}

export interface InventoryDefinitionRecord {
  durabilityMax: number | null;
  equipment?: PlayerInventoryEquipmentSummary | null;
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
  brisaBoost: number;
  name: string;
  disposicaoBoost: number;
  productionLevel: number;
  cansacoRecovery: number;
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
  changeVocation(
    playerId: string,
    input: {
      changedAt: Date;
      creditsCost: number;
      nextVocation: PlayerVocationChangeInput['vocation'];
    },
  ): Promise<PlayerProfileRecord | null>;
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

export interface PlayerPublicProfileReader {
  getPublicProfileByNickname(nickname: string): Promise<PlayerPublicProfileRecord | null>;
}

export interface PlayerRuntimeStateInput {
  addiction: number;
  level: number;
  brisa: number;
  disposicao: number;
  cansaco: number;
}

export interface PlayerDrugConsumptionInput {
  addiction: number;
  brisa: number;
  disposicao: number;
  cansaco: number;
}

export interface PlayerOverdosePenaltyInput {
  addiction: number;
  conceito: number;
  brisa: number;
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
  disposicaoSystem?: DisposicaoSystem;
  overdoseSystem?: OverdoseSystem;
  prisonSystem?: PrisonSystemContract;
  publicProfileReader?: PlayerPublicProfileReader;
  repository?: PlayerRepository;
  cansacoSystem?: CansacoSystem;
  now?: () => Date;
}

type PlayerErrorCode = 'conflict' | 'not_found' | 'unauthorized' | 'validation';

export function playerError(code: PlayerErrorCode, message: string): DomainError {
  return new DomainError('player', code, inferDomainErrorCategory(code), message);
}

export class PlayerError extends DomainError {
  constructor(
    code: PlayerErrorCode,
    message: string,
  ) {
    super('player', code, inferDomainErrorCategory(code), message);
    this.name = 'PlayerError';
  }
}
