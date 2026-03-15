import {
  DEFAULT_CHARACTER_APPEARANCE,
  DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
  DEFAULT_PLAYER_PRISON_STATUS,
  INVENTORY_BASE_MAX_SLOTS,
  INVENTORY_BASE_MAX_WEIGHT,
  INVENTORY_REPAIR_MIN_COST,
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
  type PlayerProfile,
  type PlayerPropertySummary,
  type PropertyType,
  type RegionId,
  VocationType,
} from '@cs-rio/shared';

import { env } from '../config/env.js';
import {
  AuthError,
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
import { resolveCachedEconomyPropertyDefinition } from './economy-config.js';
import { type FactionUpgradeEffectReaderContract } from './faction/types.js';
import { buildPlayerProfileCacheKey } from './player-cache.js';
import { DatabasePlayerRepository } from './player/repository.js';
import {
  type DrugDefinitionRecord,
  type InventoryDefinitionRecord,
  type PlayerDrugConsumptionInput,
  PlayerError,
  type PlayerOverdosePenaltyInput,
  type PlayerProfileRecord,
  type PlayerRepository,
  type PlayerServiceOptions,
} from './player/types.js';

const PLAYER_PROFILE_CACHE_TTL_SECONDS = 30;

export { buildPlayerProfileCacheKey } from './player-cache.js';
export { DatabasePlayerRepository } from './player/repository.js';
export { PlayerError } from './player/types.js';
export type {
  DrugDefinitionRecord,
  InventoryDefinitionRecord,
  PlayerDrugConsumptionInput,
  PlayerOverdosePenaltyInput,
  PlayerOverdosePenaltyResult,
  PlayerProfileRecord,
  PlayerRepository,
  PlayerRuntimeStateInput,
  PlayerServiceOptions,
} from './player/types.js';

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

  async getFreshPlayerProfile(playerId: string): Promise<PlayerProfile> {
    return this.buildHydratedPlayerProfile(playerId);
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
    const serializedProfile = await this.buildHydratedPlayerProfile(playerId, profileOverride);
    await this.keyValueStore.set(
      buildPlayerProfileCacheKey(playerId),
      JSON.stringify(serializedProfile),
      PLAYER_PROFILE_CACHE_TTL_SECONDS,
    );

    return serializedProfile;
  }

  private async buildHydratedPlayerProfile(
    playerId: string,
    profileOverride?: PlayerProfileRecord,
  ): Promise<PlayerProfile> {
    const profile = profileOverride ?? (await this.loadRepositoryProfile(playerId, { allowMissingCharacter: true }));
    const upgradedProfile = await this.applyFactionUpgradeEffects(profile);

    return this.hydratePlayerLockStates(playerId, serializePlayerProfile(upgradedProfile));
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
