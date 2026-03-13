import {
  DEFAULT_CHARACTER_APPEARANCE,
  DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
  DEFAULT_PLAYER_PRISON_STATUS,
  INVENTORY_BASE_MAX_SLOTS,
  INVENTORY_BASE_MAX_WEIGHT,
  INVENTORY_REPAIR_MIN_COST,
  VOCATION_BASE_ATTRIBUTES,
  type CharacterAppearance,
  type DrugConsumeResponse,
  type DrugType,
  type InventoryCapacity,
  type InventoryEquipSlot,
  type InventoryGrantInput,
  type InventoryItemType,
  type InventoryListResponse,
  type InventoryRepairResponse,
  type OverdoseTrigger,
  type PlayerCreationInput,
  type PlayerFactionSummary,
  type PlayerInventoryItem,
  type PlayerProfile,
  type PlayerPropertySummary,
  type PropertyType,
  type RegionId,
  VocationType,
} from '@cs-rio/shared';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  components,
  contacts,
  drugs,
  factionMembers,
  factions,
  playerInventory,
  players,
  properties,
  vests,
  weapons,
} from '../db/schema.js';
import {
  AuthError,
  type AuthPlayerRecord,
  RedisKeyValueStore,
  type KeyValueStore,
  toPlayerSummary,
} from './auth.js';
import { AddictionSystem } from '../systems/AddictionSystem.js';
import { DrugToleranceSystem } from '../systems/DrugToleranceSystem.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import { NerveSystem } from '../systems/NerveSystem.js';
import { OverdoseSystem } from '../systems/OverdoseSystem.js';
import { type PrisonSystemContract, PrisonSystem } from '../systems/PrisonSystem.js';
import { StaminaSystem } from '../systems/StaminaSystem.js';
import { type FactionUpgradeEffectReaderContract } from './faction.js';
import { resolveCachedEconomyPropertyDefinition } from './economy-config.js';
import { ServerConfigService } from './server-config.js';

const PLAYER_PROFILE_CACHE_TTL_SECONDS = 30;
const serverConfigService = new ServerConfigService();

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

export class DatabasePlayerRepository implements PlayerRepository {
  async applyDrugOverdosePenalties(
    playerId: string,
    input: PlayerOverdosePenaltyInput,
  ): Promise<PlayerOverdosePenaltyResult | null> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          id: players.id,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!player) {
        return null;
      }

      const knownContacts = await tx
        .select({
          contactId: contacts.contactId,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.playerId, playerId),
            eq(contacts.type, 'known'),
          ),
        );

      if (knownContacts.length > 0) {
        await tx
          .delete(contacts)
          .where(
            and(
              eq(contacts.playerId, playerId),
              eq(contacts.type, 'known'),
            ),
          );
      }

      const [updatedPlayer] = await tx
        .update(players)
        .set({
          addiction: input.addiction,
          conceito: input.conceito,
          morale: input.morale,
        })
        .where(eq(players.id, playerId))
        .returning({
          id: players.id,
        });

      if (!updatedPlayer) {
        return null;
      }

      return {
        knownContactsLost: knownContacts.length,
      };
    });
  }

  async clearInventoryEquipSlot(playerId: string, equipSlot: InventoryEquipSlot): Promise<void> {
    await db
      .update(playerInventory)
      .set({
        equippedSlot: null,
      })
      .where(
        and(
          eq(playerInventory.playerId, playerId),
          eq(playerInventory.equippedSlot, equipSlot),
        ),
      );
  }

  async consumeDrugInventoryItem(
    playerId: string,
    inventoryItemId: string,
    input: PlayerDrugConsumptionInput,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [inventoryEntry] = await tx
        .select({
          id: playerInventory.id,
          quantity: playerInventory.quantity,
        })
        .from(playerInventory)
        .where(
          and(
            eq(playerInventory.id, inventoryItemId),
            eq(playerInventory.playerId, playerId),
            eq(playerInventory.itemType, 'drug'),
          ),
        )
        .limit(1);

      if (!inventoryEntry) {
        return false;
      }

      if (inventoryEntry.quantity <= 1) {
        await tx
          .delete(playerInventory)
          .where(
            and(
              eq(playerInventory.id, inventoryItemId),
              eq(playerInventory.playerId, playerId),
            ),
          );
      } else {
        await tx
          .update(playerInventory)
          .set({
            quantity: inventoryEntry.quantity - 1,
          })
          .where(
            and(
              eq(playerInventory.id, inventoryItemId),
              eq(playerInventory.playerId, playerId),
            ),
          );
      }

      const [updatedPlayer] = await tx
        .update(players)
        .set({
          addiction: input.addiction,
          morale: input.morale,
          nerve: input.nerve,
          stamina: input.stamina,
        })
        .where(eq(players.id, playerId))
        .returning({
          id: players.id,
        });

      return Boolean(updatedPlayer);
    });
  }

  async createCharacter(
    playerId: string,
    input: PlayerCreationInput,
  ): Promise<PlayerProfileRecord | null> {
    const [existingPlayer] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);

    if (!existingPlayer) {
      return null;
    }

    const attributes = VOCATION_BASE_ATTRIBUTES[input.vocation];
    const spawnRegion = await serverConfigService.getRegion(existingPlayer.regionId as RegionId);
    const spawnPoint = {
      positionX: spawnRegion?.spawnPositionX ?? 128,
      positionY: spawnRegion?.spawnPositionY ?? 116,
    };

    await db
      .update(players)
      .set({
        addiction: 0,
        appearanceJson: input.appearance,
        carisma: attributes.carisma,
        characterCreatedAt: new Date(),
        conceito: 0,
        forca: attributes.forca,
        hp: 100,
        inteligencia: attributes.inteligencia,
        level: 1,
        morale: 100,
        nerve: 100,
        positionX: spawnPoint.positionX,
        positionY: spawnPoint.positionY,
        resistencia: attributes.resistencia,
        stamina: 100,
        vocation: input.vocation,
      })
      .where(eq(players.id, playerId));

    return this.getPlayerProfile(playerId);
  }

  async deleteInventoryItem(playerId: string, inventoryItemId: string): Promise<boolean> {
    const [deletedEntry] = await db
      .delete(playerInventory)
      .where(
        and(
          eq(playerInventory.id, inventoryItemId),
          eq(playerInventory.playerId, playerId),
        ),
      )
      .returning({
        id: playerInventory.id,
      });

    return Boolean(deletedEntry);
  }

  async getInventoryDefinition(
    itemType: InventoryItemType,
    itemId: string,
  ): Promise<InventoryDefinitionRecord | null> {
    if (itemType === 'weapon') {
      const [weapon] = await db
        .select({
          durabilityMax: weapons.durabilityMax,
          id: weapons.id,
          levelRequired: weapons.levelRequired,
          name: weapons.name,
          weight: weapons.weight,
        })
        .from(weapons)
        .where(eq(weapons.id, itemId))
        .limit(1);

      return weapon
        ? {
            durabilityMax: weapon.durabilityMax,
            itemId: weapon.id,
            itemName: weapon.name,
            itemType,
            levelRequired: weapon.levelRequired,
            stackable: false,
            unitWeight: weapon.weight,
          }
        : null;
    }

    if (itemType === 'vest') {
      const [vest] = await db
        .select({
          durabilityMax: vests.durabilityMax,
          id: vests.id,
          levelRequired: vests.levelRequired,
          name: vests.name,
          weight: vests.weight,
        })
        .from(vests)
        .where(eq(vests.id, itemId))
        .limit(1);

      return vest
        ? {
            durabilityMax: vest.durabilityMax,
            itemId: vest.id,
            itemName: vest.name,
            itemType,
            levelRequired: vest.levelRequired,
            stackable: false,
            unitWeight: vest.weight,
          }
        : null;
    }

    if (itemType === 'drug') {
      const [drug] = await db
        .select({
          id: drugs.id,
          levelRequired: drugs.productionLevel,
          name: drugs.name,
          weight: drugs.weight,
        })
        .from(drugs)
        .where(eq(drugs.id, itemId))
        .limit(1);

      return drug
        ? {
            durabilityMax: null,
            itemId: drug.id,
            itemName: drug.name,
            itemType,
            levelRequired: drug.levelRequired,
            stackable: true,
            unitWeight: drug.weight,
          }
        : null;
    }

    if (itemType === 'component') {
      const [component] = await db
        .select({
          id: components.id,
          name: components.name,
          weight: components.weight,
        })
        .from(components)
        .where(eq(components.id, itemId))
        .limit(1);

      return component
        ? {
            durabilityMax: null,
            itemId: component.id,
            itemName: component.name,
            itemType,
            levelRequired: null,
            stackable: true,
            unitWeight: component.weight,
          }
        : null;
    }

    return null;
  }

  async getDrugDefinition(drugId: string): Promise<DrugDefinitionRecord | null> {
    const [drug] = await db
      .select({
        addictionRate: drugs.addictionRate,
        code: drugs.code,
        id: drugs.id,
        moralBoost: drugs.moralBoost,
        name: drugs.name,
        nerveBoost: drugs.nerveBoost,
        productionLevel: drugs.productionLevel,
        staminaRecovery: drugs.staminaRecovery,
        type: drugs.type,
      })
      .from(drugs)
      .where(eq(drugs.id, drugId))
      .limit(1);

    return drug
      ? {
          addictionRate: Number.parseFloat(String(drug.addictionRate)),
          code: drug.code,
          drugId: drug.id,
          moralBoost: drug.moralBoost,
          name: drug.name,
          nerveBoost: drug.nerveBoost,
          productionLevel: drug.productionLevel,
          staminaRecovery: drug.staminaRecovery,
          type: drug.type as DrugType,
        }
      : null;
  }

  async getPlayerProfile(playerId: string): Promise<PlayerProfileRecord | null> {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);

    if (!player) {
      return null;
    }

    const [membership] = await db
      .select({
        factionId: factionMembers.factionId,
        rank: factionMembers.rank,
      })
      .from(factionMembers)
      .where(eq(factionMembers.playerId, playerId))
      .limit(1);
    const factionId = membership?.factionId ?? player.factionId ?? null;
    const [factionRow] = factionId
      ? await db
          .select({
            abbreviation: factions.abbreviation,
            id: factions.id,
            name: factions.name,
          })
          .from(factions)
          .where(eq(factions.id, factionId))
          .limit(1)
      : [];
    const inventoryRows = await db
      .select({
        equippedSlot: playerInventory.equippedSlot,
        durability: playerInventory.durability,
        id: playerInventory.id,
        itemId: playerInventory.itemId,
        itemType: playerInventory.itemType,
        proficiency: playerInventory.proficiency,
        quantity: playerInventory.quantity,
      })
      .from(playerInventory)
      .where(eq(playerInventory.playerId, playerId));
    const propertiesRows = await db
      .select({
        createdAt: properties.createdAt,
        favelaId: properties.favelaId,
        id: properties.id,
        level: properties.level,
        regionId: properties.regionId,
        soldiersCount: properties.soldiersCount,
        type: properties.type,
      })
      .from(properties)
      .where(eq(properties.playerId, playerId));

    return {
      faction: factionRow
        ? {
            abbreviation: factionRow.abbreviation,
            id: factionRow.id,
            name: factionRow.name,
            rank: membership?.rank ?? null,
          }
        : null,
      inventory: await hydrateInventoryRows(inventoryRows),
      player,
      properties: propertiesRows.map((entry) => ({
        createdAt: entry.createdAt.toISOString(),
        favelaId: entry.favelaId,
        id: entry.id,
        level: entry.level,
        regionId: entry.regionId as RegionId,
        soldiersCount: entry.soldiersCount,
        type: entry.type,
      })),
    };
  }

  async grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<void> {
    if (isStackableInventoryItemType(input.itemType)) {
      const [existingEntry] = await db
        .select({
          id: playerInventory.id,
          quantity: playerInventory.quantity,
        })
        .from(playerInventory)
        .where(
          and(
            eq(playerInventory.playerId, playerId),
            eq(playerInventory.itemType, input.itemType),
            eq(playerInventory.itemId, input.itemId),
            isNull(playerInventory.equippedSlot),
          ),
        )
        .limit(1);

      if (existingEntry) {
        await db
          .update(playerInventory)
          .set({
            quantity: existingEntry.quantity + input.quantity,
          })
          .where(eq(playerInventory.id, existingEntry.id));
        return;
      }
    }

    const definition = await this.getInventoryDefinition(input.itemType, input.itemId);

    await db.insert(playerInventory).values({
      durability: definition?.durabilityMax ?? null,
      itemId: input.itemId,
      itemType: input.itemType,
      playerId,
      quantity: input.quantity,
    });
  }

  async repairInventoryItem(
    playerId: string,
    inventoryItemId: string,
    nextDurability: number,
    repairCost: number,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          money: players.money,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!player) {
        return false;
      }

      const [updatedEntry] = await tx
        .update(playerInventory)
        .set({
          durability: nextDurability,
        })
        .where(
          and(
            eq(playerInventory.id, inventoryItemId),
            eq(playerInventory.playerId, playerId),
          ),
        )
        .returning({
          id: playerInventory.id,
        });

      if (!updatedEntry) {
        return false;
      }

      const nextMoney = Math.max(0, Number.parseFloat(player.money) - repairCost);

      await tx
        .update(players)
        .set({
          money: nextMoney.toFixed(2),
        })
        .where(eq(players.id, playerId));

      return true;
    });
  }

  async travelToRegion(playerId: string, regionId: RegionId): Promise<PlayerProfileRecord | null> {
    const spawnRegion = await serverConfigService.getRegion(regionId);
    const spawnPoint = {
      positionX: spawnRegion?.spawnPositionX ?? 128,
      positionY: spawnRegion?.spawnPositionY ?? 116,
    };

    const [updatedPlayer] = await db
      .update(players)
      .set({
        positionX: spawnPoint.positionX,
        positionY: spawnPoint.positionY,
        regionId,
      })
      .where(eq(players.id, playerId))
      .returning({
        id: players.id,
      });

    if (!updatedPlayer) {
      return null;
    }

    return this.getPlayerProfile(playerId);
  }

  async setInventoryEquipSlot(
    playerId: string,
    inventoryItemId: string,
    equipSlot: InventoryEquipSlot | null,
  ): Promise<boolean> {
    const [updatedEntry] = await db
      .update(playerInventory)
      .set({
        equippedSlot: equipSlot,
      })
      .where(
        and(
          eq(playerInventory.id, inventoryItemId),
          eq(playerInventory.playerId, playerId),
        ),
      )
      .returning({
        id: playerInventory.id,
      });

    return Boolean(updatedEntry);
  }

  async updateInventoryItemQuantity(
    playerId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<boolean> {
    const [updatedEntry] = await db
      .update(playerInventory)
      .set({
        quantity,
      })
      .where(
        and(
          eq(playerInventory.id, inventoryItemId),
          eq(playerInventory.playerId, playerId),
        ),
      )
      .returning({
        id: playerInventory.id,
      });

    return Boolean(updatedEntry);
  }

  async updateRuntimeState(playerId: string, input: PlayerRuntimeStateInput): Promise<void> {
    await db
      .update(players)
      .set({
        addiction: input.addiction,
        level: input.level,
        morale: input.morale,
        nerve: input.nerve,
        stamina: input.stamina,
      })
      .where(eq(players.id, playerId));
  }
}

export class PlayerService {
  private readonly addictionSystem: AddictionSystem;

  private readonly drugToleranceSystem: DrugToleranceSystem;

  private readonly factionUpgradeReader: FactionUpgradeEffectReaderContract;

  private readonly keyValueStore: KeyValueStore;

  private readonly levelSystem: LevelSystem;

  private readonly nerveSystem: NerveSystem;

  private readonly overdoseSystem: OverdoseSystem;

  private readonly ownsPrisonSystem: boolean;

  private readonly prisonSystem: PrisonSystemContract;

  private readonly repository: PlayerRepository;

  private readonly staminaSystem: StaminaSystem;

  constructor(options: PlayerServiceOptions = {}) {
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.addictionSystem = options.addictionSystem ?? new AddictionSystem({ keyValueStore: this.keyValueStore });
    this.drugToleranceSystem =
      options.drugToleranceSystem ?? new DrugToleranceSystem({ keyValueStore: this.keyValueStore });
    this.factionUpgradeReader = options.factionUpgradeReader ?? {
      async getFactionUpgradeEffectsForFaction() {
        return {
          attributeBonusMultiplier: 1,
          canAccessExclusiveArsenal: false,
          hasFortifiedHeadquarters: false,
          muleDeliveryTier: 0,
          soldierCapacityMultiplier: 1,
        };
      },
    };
    this.levelSystem = options.levelSystem ?? new LevelSystem();
    this.nerveSystem = options.nerveSystem ?? new NerveSystem({ keyValueStore: this.keyValueStore });
    this.overdoseSystem =
      options.overdoseSystem ?? new OverdoseSystem({ keyValueStore: this.keyValueStore });
    this.repository = options.repository ?? new DatabasePlayerRepository();
    this.staminaSystem = options.staminaSystem ?? new StaminaSystem({ keyValueStore: this.keyValueStore });
    this.ownsPrisonSystem = !options.prisonSystem;
    this.prisonSystem =
      options.prisonSystem ??
      new PrisonSystem({
        keyValueStore: this.keyValueStore,
      });
  }

  async close(): Promise<void> {
    await this.addictionSystem.close();
    await this.drugToleranceSystem.close();
    await this.nerveSystem.close();
    await this.overdoseSystem.close();
    if (this.ownsPrisonSystem) {
      await this.prisonSystem.close?.();
    }
    await this.staminaSystem.close();
    await this.keyValueStore.close?.();
  }

  async createCharacter(playerId: string, input: PlayerCreationInput): Promise<PlayerProfile> {
    const sanitizedInput = {
      appearance: sanitizeAppearance(input.appearance),
      vocation: validateVocation(input.vocation),
    };
    const currentProfile = await this.loadRepositoryProfile(playerId, {
      allowMissingCharacter: true,
    });

    if (currentProfile.player.characterCreatedAt) {
      throw new AuthError('conflict', 'Personagem ja foi criado para esta conta.');
    }

    const updatedProfile = await this.repository.createCharacter(playerId, sanitizedInput);

    if (!updatedProfile) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    return this.refreshPlayerProfileCache(playerId, updatedProfile);
  }

  async travelToRegion(playerId: string, regionId: RegionId): Promise<PlayerProfile> {
    const profile = await this.loadRepositoryProfile(playerId);
    ensureCharacterCreated(profile);

    if (profile.player.regionId === regionId) {
      return this.refreshPlayerProfileCache(playerId, profile);
    }

    const updatedProfile = await this.repository.travelToRegion(playerId, regionId);

    if (!updatedProfile) {
      throw new PlayerError('not_found', 'Jogador nao encontrado.');
    }

    return this.refreshPlayerProfileCache(playerId, updatedProfile);
  }

  async getPlayerProfile(playerId: string): Promise<PlayerProfile> {
    const cacheKey = buildPlayerProfileCacheKey(playerId);
    const cachedProfile = await this.keyValueStore.get(cacheKey);

    if (cachedProfile) {
      return this.hydratePlayerLockStates(playerId, JSON.parse(cachedProfile) as PlayerProfile);
    }

    return this.refreshPlayerProfileCache(playerId);
  }

  async getInventory(playerId: string): Promise<InventoryListResponse> {
    const profile = await this.getPlayerProfile(playerId);
    ensureCharacterCreated(profile);
    return buildInventoryListResponse(profile);
  }

  async equipInventoryItem(playerId: string, inventoryItemId: string): Promise<InventoryListResponse> {
    const profile = await this.loadRepositoryProfile(playerId);
    const item = profile.inventory.find((entry) => entry.id === inventoryItemId);

    if (!item) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    const equipSlot = resolveInventoryEquipSlot(item.itemType);

    if (!equipSlot) {
      throw new PlayerError('validation', 'Este item nao pode ser equipado.');
    }

    if (item.levelRequired !== null && profile.player.level < item.levelRequired) {
      throw new PlayerError(
        'conflict',
        `Nivel insuficiente para equipar ${item.itemName ?? 'este item'}.`,
      );
    }

    await this.repository.clearInventoryEquipSlot(playerId, equipSlot);
    const updated = await this.repository.setInventoryEquipSlot(playerId, inventoryItemId, equipSlot);

    if (!updated) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    return this.refreshInventoryAfterMutation(playerId);
  }

  async unequipInventoryItem(playerId: string, inventoryItemId: string): Promise<InventoryListResponse> {
    const profile = await this.loadRepositoryProfile(playerId);
    const item = profile.inventory.find((entry) => entry.id === inventoryItemId);

    if (!item) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    if (!item.isEquipped) {
      throw new PlayerError('validation', 'Este item nao esta equipado.');
    }

    const updated = await this.repository.setInventoryEquipSlot(playerId, inventoryItemId, null);

    if (!updated) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    return this.refreshInventoryAfterMutation(playerId);
  }

  async repairInventoryItem(playerId: string, inventoryItemId: string): Promise<InventoryRepairResponse> {
    const profile = await this.loadRepositoryProfile(playerId);
    const item = profile.inventory.find((entry) => entry.id === inventoryItemId);

    if (!item) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    if (!item.itemId) {
      throw new PlayerError('validation', 'Item invalido para reparo.');
    }

    const definition = await this.repository.getInventoryDefinition(item.itemType, item.itemId);

    if (!definition || definition.stackable || definition.durabilityMax === null) {
      throw new PlayerError('validation', 'Somente armas e coletes podem ser reparados.');
    }

    const currentDurability = clampNumber(item.durability ?? definition.durabilityMax, 0, definition.durabilityMax);

    if (currentDurability >= definition.durabilityMax) {
      throw new PlayerError('conflict', 'Esse item ja esta com a durabilidade maxima.');
    }

    const repairCost = resolveRepairCost(definition, currentDurability);
    const availableMoney = Number.parseFloat(String(profile.player.money));

    if (availableMoney < repairCost) {
      throw new PlayerError('conflict', 'Dinheiro insuficiente para reparar este item.');
    }

    const repaired = await this.repository.repairInventoryItem(
      playerId,
      inventoryItemId,
      definition.durabilityMax,
      repairCost,
    );

    if (!repaired) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    const inventory = await this.refreshInventoryAfterMutation(playerId);
    const repairedItem = inventory.items.find((entry) => entry.id === inventoryItemId);

    if (!repairedItem) {
      throw new PlayerError('not_found', 'Item reparado nao encontrado no inventario.');
    }

    return {
      ...inventory,
      repairCost,
      repairedItem,
    };
  }

  async consumeDrugInventoryItem(playerId: string, inventoryItemId: string): Promise<DrugConsumeResponse> {
    const hospitalization = await this.overdoseSystem.getHospitalizationStatus(playerId);

    if (hospitalization.isHospitalized) {
      throw new PlayerError(
        'conflict',
        `Personagem hospitalizado ate ${hospitalization.endsAt ?? 'data indisponivel'}.`,
      );
    }

    const profile = await this.loadRepositoryProfile(playerId);
    const item = profile.inventory.find((entry) => entry.id === inventoryItemId);

    if (!item) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    if (item.itemType !== 'drug' || !item.itemId) {
      throw new PlayerError('validation', 'Somente drogas podem ser consumidas por este endpoint.');
    }

    if (item.quantity < 1) {
      throw new PlayerError('conflict', 'Nao ha unidades disponiveis dessa droga no inventario.');
    }

    const drug = await this.repository.getDrugDefinition(item.itemId);

    if (!drug) {
      throw new PlayerError('validation', 'Droga invalida para consumo.');
    }

    if (profile.player.level < drug.productionLevel) {
      throw new PlayerError('conflict', `Nivel insuficiente para consumir ${drug.name}.`);
    }

    const toleranceBeforeUse = await this.drugToleranceSystem.sync(playerId, drug.drugId);
    const effectivenessMultiplier = resolveDrugEffectivenessMultiplier(toleranceBeforeUse.current);
    const moraleRecovered = resolveDrugRecoveredEffect(drug.moralBoost, effectivenessMultiplier);
    const nerveRecovered = resolveDrugRecoveredEffect(drug.nerveBoost, effectivenessMultiplier);
    const staminaRecovered = resolveDrugRecoveredEffect(drug.staminaRecovery, effectivenessMultiplier);
    const addictionGained = resolveDrugAddictionGain(drug);
    const toleranceGained = resolveDrugToleranceGain(drug);
    const rawNextStamina = profile.player.stamina + staminaRecovered;
    const nextResources = {
      addiction: clampNumber(profile.player.addiction + addictionGained, 0, 100),
      morale: clampNumber(profile.player.morale + moraleRecovered, 0, 100),
      nerve: clampNumber(profile.player.nerve + nerveRecovered, 0, 100),
      stamina: clampNumber(profile.player.stamina + staminaRecovered, 0, 100),
    } satisfies PlayerDrugConsumptionInput;
    const consumed = await this.repository.consumeDrugInventoryItem(playerId, inventoryItemId, nextResources);

    if (!consumed) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    const [, tolerance, recentDrugMix] = await Promise.all([
      this.addictionSystem.recordDrugUse(playerId),
      this.drugToleranceSystem.recordUse(playerId, drug.drugId, toleranceGained),
      this.overdoseSystem.recordDrugUse(playerId, drug.type),
    ]);
    const overdoseTrigger = resolveDrugOverdoseTrigger({
      nextAddiction: nextResources.addiction,
      rawNextStamina,
      recentDrugTypes: recentDrugMix.distinctTypes,
    });
    let overdose: DrugConsumeResponse['overdose'] = null;

    if (overdoseTrigger) {
      const penalties = resolveDrugOverdosePenaltyState(profile.player.conceito);
      const penaltyResult = await this.repository.applyDrugOverdosePenalties(playerId, penalties);

      if (!penaltyResult) {
        throw new PlayerError('unauthorized', 'Jogador nao encontrado.');
      }

      const nextHospitalization = await this.overdoseSystem.hospitalizeForOverdose(playerId, overdoseTrigger);

      overdose = {
        hospitalization: nextHospitalization,
        knownContactsLost: penaltyResult.knownContactsLost,
        penalties: {
          addictionResetTo: penalties.addiction,
          conceitoLost: penalties.conceitoLost,
          moraleResetTo: penalties.morale,
        },
        recentDrugTypes: recentDrugMix.distinctTypes,
        trigger: overdoseTrigger,
      };
    }

    const nextProfile = await this.refreshPlayerProfileCache(playerId);
    const remainingItem =
      nextProfile.inventory.find((entry) => entry.id === inventoryItemId) ?? null;

    return {
      consumedInventoryItemId: inventoryItemId,
      drug: {
        code: drug.code,
        id: drug.drugId,
        name: drug.name,
        remainingQuantity: remainingItem?.quantity ?? 0,
        type: drug.type,
      },
      effects: {
        addictionGained: Math.max(0, nextResources.addiction - profile.player.addiction),
        moraleRecovered,
        nerveRecovered,
        staminaRecovered,
      },
      overdose,
      player: nextProfile,
      tolerance: {
        current: tolerance.current,
        decayedBy: tolerance.decayedBy,
        drugId: drug.drugId,
        effectiveTolerance: toleranceBeforeUse.current,
        effectivenessMultiplier,
        increasedBy: tolerance.increasedBy,
      },
    };
  }

  async updateInventoryItemQuantity(
    playerId: string,
    inventoryItemId: string,
    quantity: number,
  ): Promise<InventoryListResponse> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new PlayerError('validation', 'Quantidade deve ser um inteiro maior ou igual a 1.');
    }

    const profile = await this.loadRepositoryProfile(playerId);
    const item = profile.inventory.find((entry) => entry.id === inventoryItemId);

    if (!item) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    if (!item.stackable) {
      throw new PlayerError('validation', 'Apenas itens stackaveis aceitam ajuste de quantidade.');
    }

    if (quantity === item.quantity) {
      return buildInventoryListResponse(serializePlayerProfile(profile));
    }

    if (quantity > item.quantity) {
      const capacity = resolveInventoryCapacity(profile);
      const additionalWeight = (quantity - item.quantity) * item.unitWeight;

      if (capacity.currentWeight + additionalWeight > capacity.maxWeight) {
        throw new PlayerError('conflict', 'Peso maximo do inventario excedido.');
      }
    }

    const updated = await this.repository.updateInventoryItemQuantity(playerId, inventoryItemId, quantity);

    if (!updated) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    return this.refreshInventoryAfterMutation(playerId);
  }

  async deleteInventoryItem(playerId: string, inventoryItemId: string): Promise<InventoryListResponse> {
    const profile = await this.loadRepositoryProfile(playerId);
    const item = profile.inventory.find((entry) => entry.id === inventoryItemId);

    if (!item) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    const deleted = await this.repository.deleteInventoryItem(playerId, inventoryItemId);

    if (!deleted) {
      throw new PlayerError('not_found', 'Item do inventario nao encontrado.');
    }

    return this.refreshInventoryAfterMutation(playerId);
  }

  async grantInventoryItem(playerId: string, input: InventoryGrantInput): Promise<InventoryListResponse> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new PlayerError('validation', 'Quantidade deve ser um inteiro maior ou igual a 1.');
    }

    const profile = await this.loadRepositoryProfile(playerId);
    const definition = await this.repository.getInventoryDefinition(input.itemType, input.itemId);

    if (!definition) {
      throw new PlayerError('validation', 'Definicao de item invalida para o inventario.');
    }

    if (!definition.stackable && input.quantity !== 1) {
      throw new PlayerError(
        'validation',
        'Itens nao stackaveis devem ser adicionados uma unidade por vez.',
      );
    }

    const capacity = resolveInventoryCapacity(profile);
    const existingStack = definition.stackable
      ? profile.inventory.find(
          (item) => item.itemType === input.itemType && item.itemId === input.itemId,
        ) ?? null
      : null;
    const nextUsedSlots = capacity.usedSlots + (existingStack ? 0 : 1);
    const nextWeight = capacity.currentWeight + definition.unitWeight * input.quantity;

    if (nextUsedSlots > capacity.maxSlots) {
      throw new PlayerError('conflict', 'Slots maximos do inventario excedidos.');
    }

    if (nextWeight > capacity.maxWeight) {
      throw new PlayerError('conflict', 'Peso maximo do inventario excedido.');
    }

    await this.repository.grantInventoryItem(playerId, input);
    return this.refreshInventoryAfterMutation(playerId);
  }

  private async synchronizeRuntimeState(profile: PlayerProfileRecord): Promise<void> {
    const staminaRecoveryPerHour = resolveStaminaRecoveryPerHour(profile);
    const [staminaSync, nerveSync, addictionSync] = await Promise.all([
      this.staminaSystem.sync(profile.player.id, profile.player.stamina, {
        recoveryPerHour: staminaRecoveryPerHour,
      }),
      this.nerveSystem.sync(profile.player.id, profile.player.nerve),
      this.addictionSystem.sync(profile.player.id, profile.player.addiction),
    ]);
    const levelProgression = this.levelSystem.resolve(
      profile.player.conceito,
      profile.player.level,
    );

    if (
      !staminaSync.changed &&
      !nerveSync.changed &&
      !addictionSync.changed &&
      !levelProgression.leveledUp &&
      levelProgression.level === profile.player.level
    ) {
      return;
    }

    profile.player.addiction = addictionSync.nextValue;
    profile.player.level = levelProgression.level;
    profile.player.nerve = nerveSync.nextValue;
    profile.player.stamina = staminaSync.nextValue;

    await this.repository.updateRuntimeState(profile.player.id, {
      addiction: profile.player.addiction,
      level: profile.player.level,
      morale: profile.player.morale,
      nerve: profile.player.nerve,
      stamina: profile.player.stamina,
    });
  }

  private async loadRepositoryProfile(
    playerId: string,
    options: {
      allowMissingCharacter?: boolean;
    } = {},
  ): Promise<PlayerProfileRecord> {
    const profile = await this.repository.getPlayerProfile(playerId);

    if (!profile) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!options.allowMissingCharacter) {
      ensureCharacterCreated(profile);
    }

    await this.synchronizeRuntimeState(profile);
    return profile;
  }

  private async refreshPlayerProfileCache(
    playerId: string,
    profileOverride?: PlayerProfileRecord,
  ): Promise<PlayerProfile> {
    const profile = profileOverride ?? (await this.loadRepositoryProfile(playerId, { allowMissingCharacter: true }));
    const upgradedProfile = await this.applyFactionUpgradeEffects(profile);
    const serializedProfile = await this.hydratePlayerLockStates(
      playerId,
      serializePlayerProfile(upgradedProfile),
    );
    await this.keyValueStore.set(
      buildPlayerProfileCacheKey(playerId),
      JSON.stringify(serializedProfile),
      PLAYER_PROFILE_CACHE_TTL_SECONDS,
    );

    return serializedProfile;
  }

  private async refreshInventoryAfterMutation(playerId: string): Promise<InventoryListResponse> {
    const profile = await this.refreshPlayerProfileCache(playerId);
    return buildInventoryListResponse(profile);
  }

  private async hydratePlayerLockStates(
    playerId: string,
    profile: PlayerProfile,
  ): Promise<PlayerProfile> {
    const [hospitalization, prison] = await Promise.all([
      this.overdoseSystem.getHospitalizationStatus(playerId),
      this.prisonSystem.getStatus(playerId),
    ]);

    return {
      ...profile,
      hospitalization,
      prison,
    };
  }

  private async applyFactionUpgradeEffects(profile: PlayerProfileRecord): Promise<PlayerProfileRecord> {
    const effects = await this.factionUpgradeReader.getFactionUpgradeEffectsForFaction(profile.faction?.id ?? null);

    if (effects.attributeBonusMultiplier === 1) {
      return profile;
    }

    return {
      ...profile,
      player: {
        ...profile.player,
        carisma: Math.round(profile.player.carisma * effects.attributeBonusMultiplier),
        forca: Math.round(profile.player.forca * effects.attributeBonusMultiplier),
        inteligencia: Math.round(profile.player.inteligencia * effects.attributeBonusMultiplier),
        resistencia: Math.round(profile.player.resistencia * effects.attributeBonusMultiplier),
      },
    };
  }
}

async function hydrateInventoryRows(
  inventoryRows: Array<{
    equippedSlot: InventoryEquipSlot | null;
    durability: number | null;
    id: string;
    itemId: string | null;
    itemType: InventoryItemType;
    proficiency: number;
    quantity: number;
  }>,
): Promise<PlayerInventoryItem[]> {
  const weaponIds = inventoryRows
    .filter((item) => item.itemType === 'weapon' && item.itemId)
    .map((item) => item.itemId as string);
  const vestIds = inventoryRows
    .filter((item) => item.itemType === 'vest' && item.itemId)
    .map((item) => item.itemId as string);
  const drugIds = inventoryRows
    .filter((item) => item.itemType === 'drug' && item.itemId)
    .map((item) => item.itemId as string);
  const componentIds = inventoryRows
    .filter((item) => item.itemType === 'component' && item.itemId)
    .map((item) => item.itemId as string);
  const [weaponRows, vestRows, drugRows, componentRows] = await Promise.all([
    weaponIds.length > 0
      ? db
          .select({
            durabilityMax: weapons.durabilityMax,
            id: weapons.id,
            levelRequired: weapons.levelRequired,
            name: weapons.name,
            weight: weapons.weight,
          })
          .from(weapons)
          .where(inArray(weapons.id, weaponIds))
      : Promise.resolve([]),
    vestIds.length > 0
      ? db
          .select({
            durabilityMax: vests.durabilityMax,
            id: vests.id,
            levelRequired: vests.levelRequired,
            name: vests.name,
            weight: vests.weight,
          })
          .from(vests)
          .where(inArray(vests.id, vestIds))
      : Promise.resolve([]),
    drugIds.length > 0
      ? db
          .select({
            id: drugs.id,
            levelRequired: drugs.productionLevel,
            name: drugs.name,
            weight: drugs.weight,
          })
          .from(drugs)
          .where(inArray(drugs.id, drugIds))
      : Promise.resolve([]),
    componentIds.length > 0
      ? db
          .select({
            id: components.id,
            name: components.name,
            weight: components.weight,
          })
          .from(components)
          .where(inArray(components.id, componentIds))
      : Promise.resolve([]),
  ]);
  const itemMetadata = new Map<
    string,
    {
      durabilityMax: number | null;
      levelRequired: number | null;
      name: string;
      unitWeight: number;
    }
  >();

  for (const item of weaponRows) {
    itemMetadata.set(`weapon:${item.id}`, {
      durabilityMax: item.durabilityMax,
      levelRequired: item.levelRequired,
      name: item.name,
      unitWeight: item.weight,
    });
  }

  for (const item of vestRows) {
    itemMetadata.set(`vest:${item.id}`, {
      durabilityMax: item.durabilityMax,
      levelRequired: item.levelRequired,
      name: item.name,
      unitWeight: item.weight,
    });
  }

  for (const item of drugRows) {
    itemMetadata.set(`drug:${item.id}`, {
      durabilityMax: null,
      levelRequired: item.levelRequired,
      name: item.name,
      unitWeight: item.weight,
    });
  }

  for (const item of componentRows) {
    itemMetadata.set(`component:${item.id}`, {
      durabilityMax: null,
      levelRequired: null,
      name: item.name,
      unitWeight: item.weight,
    });
  }

  return inventoryRows.map((item) => {
    const metadata = item.itemId ? itemMetadata.get(`${item.itemType}:${item.itemId}`) : null;
    const unitWeight = metadata?.unitWeight ?? 1;
    const equipSlot = item.equippedSlot ?? null;

    return {
      durability: item.durability,
      equipSlot,
      id: item.id,
      isEquipped: equipSlot !== null,
      itemId: item.itemId,
      itemName: metadata?.name ?? null,
      itemType: item.itemType,
      levelRequired: metadata?.levelRequired ?? null,
      maxDurability: metadata?.durabilityMax ?? null,
      proficiency: item.proficiency,
      quantity: item.quantity,
      stackable: isStackableInventoryItemType(item.itemType),
      totalWeight: unitWeight * item.quantity,
      unitWeight,
    };
  });
}

export function buildPlayerProfileCacheKey(playerId: string): string {
  return `player:profile:${playerId}`;
}

function serializePlayerProfile(profile: PlayerProfileRecord): PlayerProfile {
  const summary = toPlayerSummary(profile.player);

  return {
    ...summary,
    appearance: profile.player.appearanceJson ?? DEFAULT_CHARACTER_APPEARANCE,
    faction: profile.faction,
    hasCharacter: Boolean(profile.player.characterCreatedAt),
    hospitalization: DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
    inventory: profile.inventory,
    location: {
      positionX: profile.player.positionX,
      positionY: profile.player.positionY,
      regionId: profile.player.regionId as RegionId,
    },
    prison: DEFAULT_PLAYER_PRISON_STATUS,
    properties: profile.properties,
  };
}

function buildInventoryListResponse(
  profile: Pick<PlayerProfile, 'inventory' | 'properties'> | Pick<PlayerProfileRecord, 'inventory' | 'properties'>,
): InventoryListResponse {
  return {
    capacity: resolveInventoryCapacity(profile),
    items: [...profile.inventory],
  };
}

function ensureCharacterCreated(
  profile: Pick<PlayerProfileRecord, 'player'> | Pick<PlayerProfile, 'hasCharacter'>,
): void {
  const hasCharacter =
    'hasCharacter' in profile
      ? profile.hasCharacter
      : Boolean(profile.player.characterCreatedAt);

  if (!hasCharacter) {
    throw new PlayerError('conflict', 'Crie seu personagem antes de acessar o inventario.');
  }
}

function isStackableInventoryItemType(itemType: InventoryItemType): boolean {
  return itemType === 'drug' || itemType === 'component' || itemType === 'consumable';
}

function resolveInventoryCapacity(
  profile: Pick<PlayerProfile, 'inventory' | 'properties'> | Pick<PlayerProfileRecord, 'inventory' | 'properties'>,
): InventoryCapacity {
  const residentialBonuses = resolveResidentialBonuses(profile.properties);
  const maxSlots = INVENTORY_BASE_MAX_SLOTS + residentialBonuses.inventorySlotsBonus;
  const maxWeight = INVENTORY_BASE_MAX_WEIGHT + residentialBonuses.inventoryWeightBonus;
  const usedSlots = profile.inventory.length;
  const currentWeight = profile.inventory.reduce((total, item) => total + item.totalWeight, 0);

  return {
    availableSlots: Math.max(0, maxSlots - usedSlots),
    availableWeight: Math.max(0, maxWeight - currentWeight),
    currentWeight,
    maxSlots,
    maxWeight,
    usedSlots,
  };
}

function resolveInventoryEquipSlot(itemType: InventoryItemType): InventoryEquipSlot | null {
  if (itemType === 'weapon' || itemType === 'vest') {
    return itemType;
  }

  return null;
}

function resolveStaminaRecoveryPerHour(profile: PlayerProfileRecord): number {
  let recoveryPerHour = 12;

  if (profile.faction) {
    recoveryPerHour += 1;
  }

  recoveryPerHour += resolveResidentialBonuses(profile.properties).staminaRecoveryPerHourBonus;

  recoveryPerHour -= Math.min(5, Math.floor(profile.player.addiction / 20));

  return clampNumber(recoveryPerHour, 4, 18);
}

function resolveResidentialBonuses(
  properties: Pick<PlayerPropertySummary, 'type'>[],
): {
  inventorySlotsBonus: number;
  inventoryWeightBonus: number;
  staminaRecoveryPerHourBonus: number;
} {
  return properties.reduce(
    (bestBonus, property) => {
      const utility = resolveCachedEconomyPropertyDefinition(property.type as PropertyType).utility;

      if (!utility) {
        return bestBonus;
      }

      return {
        inventorySlotsBonus: Math.max(bestBonus.inventorySlotsBonus, utility.inventorySlotsBonus),
        inventoryWeightBonus: Math.max(bestBonus.inventoryWeightBonus, utility.inventoryWeightBonus),
        staminaRecoveryPerHourBonus: Math.max(
          bestBonus.staminaRecoveryPerHourBonus,
          utility.staminaRecoveryPerHourBonus,
        ),
      };
    },
    {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      staminaRecoveryPerHourBonus: 0,
    },
  );
}

function resolveRepairCost(
  definition: Pick<InventoryDefinitionRecord, 'durabilityMax' | 'levelRequired' | 'unitWeight'>,
  currentDurability: number,
): number {
  const maxDurability = definition.durabilityMax ?? 0;
  const missingDurability = Math.max(0, maxDurability - currentDurability);
  const repairMultiplier = Math.max(2, (definition.levelRequired ?? 1) + definition.unitWeight);

  return Math.max(INVENTORY_REPAIR_MIN_COST, missingDurability * repairMultiplier);
}

function resolveDrugAddictionGain(drug: Pick<DrugDefinitionRecord, 'addictionRate'>): number {
  return Math.max(1, Math.ceil(drug.addictionRate));
}

function resolveDrugToleranceGain(
  drug: Pick<DrugDefinitionRecord, 'addictionRate' | 'nerveBoost' | 'staminaRecovery'>,
): number {
  const baseGain = Math.ceil(drug.addictionRate);
  const effectBonus = Math.floor((drug.nerveBoost + drug.staminaRecovery) / 6);

  return Math.max(1, baseGain + effectBonus);
}

function resolveDrugEffectivenessMultiplier(tolerance: number): number {
  const clampedTolerance = clampNumber(tolerance, 0, 100);
  const multiplier = (45 - 44 * (clampedTolerance / 100)) / 45;

  return Number.parseFloat(multiplier.toFixed(4));
}

function resolveDrugRecoveredEffect(baseEffect: number, effectivenessMultiplier: number): number {
  if (baseEffect <= 0 || effectivenessMultiplier <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(baseEffect * effectivenessMultiplier));
}

function resolveDrugOverdoseTrigger(input: {
  nextAddiction: number;
  rawNextStamina: number;
  recentDrugTypes: DrugType[];
}): OverdoseTrigger | null {
  if (input.rawNextStamina > 100) {
    return 'stamina_overflow';
  }

  if (input.nextAddiction >= 100) {
    return 'max_addiction';
  }

  if (input.recentDrugTypes.length >= 3) {
    return 'poly_drug_mix';
  }

  return null;
}

function resolveDrugOverdosePenaltyState(
  conceito: number,
): PlayerOverdosePenaltyInput & { conceitoLost: number } {
  const conceitoLost =
    conceito > 0
      ? Math.max(1, Math.ceil(conceito * 0.05))
      : 0;

  return {
    addiction: 50,
    conceito: Math.max(0, conceito - conceitoLost),
    conceitoLost,
    morale: 0,
  };
}

function sanitizeAppearance(input: CharacterAppearance): CharacterAppearance {
  const appearance = input ?? DEFAULT_CHARACTER_APPEARANCE;

  return {
    hair: sanitizeAppearanceField(appearance.hair, DEFAULT_CHARACTER_APPEARANCE.hair),
    outfit: sanitizeAppearanceField(appearance.outfit, DEFAULT_CHARACTER_APPEARANCE.outfit),
    skin: sanitizeAppearanceField(appearance.skin, DEFAULT_CHARACTER_APPEARANCE.skin),
  };
}

function sanitizeAppearanceField(value: string, fallback: string): string {
  const sanitized = typeof value === 'string' ? value.trim() : '';

  if (!/^[a-z0-9_]{2,32}$/u.test(sanitized)) {
    if (sanitized.length === 0) {
      return fallback;
    }

    throw new AuthError(
      'validation',
      'Appearance deve usar apenas letras minusculas, numeros e underscore entre 2 e 32 caracteres.',
    );
  }

  return sanitized;
}

function validateVocation(vocation: VocationType): VocationType {
  if (!Object.values(VocationType).includes(vocation)) {
    throw new AuthError('validation', 'Vocacao invalida.');
  }

  return vocation;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
