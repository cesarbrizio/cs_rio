import {
  DEFAULT_CHARACTER_APPEARANCE,
  DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
  DEFAULT_PLAYER_PRISON_STATUS,
  INVENTORY_BASE_MAX_SLOTS,
  INVENTORY_BASE_MAX_WEIGHT,
  INVENTORY_REPAIR_MIN_COST,
  VOCATION_BASE_ATTRIBUTES,
  VOCATIONS,
  VOCATION_CHANGE_COOLDOWN_HOURS,
  VOCATION_CHANGE_CREDITS_COST,
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
  type PlayerPublicProfile,
  type PlayerCreationInput,
  type PlayerProfile,
  type PlayerPropertySummary,
  type PlayerVocationCenterResponse,
  type PlayerVocationChangeInput,
  type PlayerVocationChangeResponse,
  type PlayerVocationOptionSummary,
  type PlayerVocationStatus,
  type PropertyType,
  type RegionId,
  VocationType,
  normalizeAuthNickname,
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
import { DisposicaoSystem } from '../systems/DisposicaoSystem.js';
import { OverdoseSystem } from '../systems/OverdoseSystem.js';
import { type PrisonSystemContract, PrisonSystem } from '../systems/PrisonSystem.js';
import { CansacoSystem } from '../systems/CansacoSystem.js';
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
  type PlayerPublicProfileReader,
  type PlayerPublicProfileRecord,
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
  PlayerPublicProfileReader,
  PlayerPublicProfileRecord,
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

  private readonly disposicaoSystem: DisposicaoSystem;

  private readonly overdoseSystem: OverdoseSystem;

  private readonly ownsPrisonSystem: boolean;

  private readonly prisonSystem: PrisonSystemContract;

  private readonly publicProfileReader: PlayerPublicProfileReader;

  private readonly repository: PlayerRepository;

  private readonly now: () => Date;

  private readonly cansacoSystem: CansacoSystem;

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
    this.disposicaoSystem = options.disposicaoSystem ?? new DisposicaoSystem({ keyValueStore: this.keyValueStore });
    this.overdoseSystem =
      options.overdoseSystem ?? new OverdoseSystem({ keyValueStore: this.keyValueStore });
    this.repository = options.repository ?? new DatabasePlayerRepository();
    this.publicProfileReader = options.publicProfileReader ?? new DatabasePlayerRepository();
    this.now = options.now ?? (() => new Date());
    this.cansacoSystem = options.cansacoSystem ?? new CansacoSystem({ keyValueStore: this.keyValueStore });
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
    await this.disposicaoSystem.close();
    await this.overdoseSystem.close();
    if (this.ownsPrisonSystem) {
      await this.prisonSystem.close?.();
    }
    await this.cansacoSystem.close();
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

  async getPublicProfileByNickname(rawNickname: string): Promise<PlayerPublicProfile> {
    const nickname = normalizeAuthNickname(rawNickname);
    const profile = await this.publicProfileReader.getPublicProfileByNickname(nickname);

    if (!profile || !profile.player.characterCreatedAt) {
      throw new PlayerError('not_found', 'Perfil publico nao encontrado.');
    }

    return serializePublicPlayerProfile(profile);
  }

  async getVocationCenter(playerId: string): Promise<PlayerVocationCenterResponse> {
    const profile = await this.loadRepositoryProfile(playerId);
    ensureCharacterCreated(profile, 'Crie seu personagem antes de gerenciar a vocacao.');

    return buildPlayerVocationCenter(profile, this.now());
  }

  async changeVocation(
    playerId: string,
    input: PlayerVocationChangeInput,
  ): Promise<PlayerVocationChangeResponse> {
    const profile = await this.loadRepositoryProfile(playerId);
    ensureCharacterCreated(profile, 'Crie seu personagem antes de gerenciar a vocacao.');

    const nextVocation = validateVocation(input.vocation);
    const now = this.now();
    const center = buildPlayerVocationCenter(profile, now);

    if (center.status.currentVocation === nextVocation) {
      throw new PlayerError('conflict', 'Essa ja e a vocacao atual do personagem.');
    }

    if (!center.availability.available) {
      throw new PlayerError(
        'conflict',
        center.availability.reason ?? 'A troca de vocacao nao esta disponivel agora.',
      );
    }

    const updatedProfile = await this.repository.changeVocation(playerId, {
      changedAt: now,
      creditsCost: center.availability.creditsCost,
      nextVocation,
    });

    if (!updatedProfile) {
      const refreshedProfile = await this.loadRepositoryProfile(playerId);
      ensureCharacterCreated(refreshedProfile, 'Crie seu personagem antes de gerenciar a vocacao.');
      const refreshedCenter = buildPlayerVocationCenter(refreshedProfile, now);

      if (refreshedCenter.status.currentVocation === nextVocation) {
        throw new PlayerError('conflict', 'Essa ja e a vocacao atual do personagem.');
      }

      if (!refreshedCenter.availability.available) {
        throw new PlayerError(
          'conflict',
          refreshedCenter.availability.reason ?? 'A troca de vocacao nao esta disponivel agora.',
        );
      }

      throw new PlayerError('conflict', 'Nao foi possivel concluir a troca de vocacao. Tente novamente.');
    }

    const player = await this.refreshPlayerProfileCache(playerId, updatedProfile);

    return {
      center: buildPlayerVocationCenter(updatedProfile, now),
      message: `Vocacao alterada para ${resolveVocationLabel(nextVocation)}. Cooldown global de ${VOCATION_CHANGE_COOLDOWN_HOURS}h iniciado.`,
      player,
    };
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

    if ((item.durability ?? 0) <= 0) {
      throw new PlayerError(
        'conflict',
        `${item.itemName ?? 'Este item'} esta quebrado e precisa de reparo antes de equipar.`,
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
    const brisaRecovered = resolveDrugRecoveredEffect(drug.brisaBoost, effectivenessMultiplier);
    const disposicaoRecovered = resolveDrugRecoveredEffect(drug.disposicaoBoost, effectivenessMultiplier);
    const cansacoRecovered = resolveDrugRecoveredEffect(drug.cansacoRecovery, effectivenessMultiplier);
    const addictionGained = resolveDrugAddictionGain(drug);
    const toleranceGained = resolveDrugToleranceGain(drug);
    const rawNextCansaco = profile.player.cansaco + cansacoRecovered;
    const nextResources = {
      addiction: clampNumber(profile.player.addiction + addictionGained, 0, 100),
      brisa: clampNumber(profile.player.brisa + brisaRecovered, 0, 100),
      disposicao: clampNumber(profile.player.disposicao + disposicaoRecovered, 0, 100),
      cansaco: clampNumber(profile.player.cansaco + cansacoRecovered, 0, 100),
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
      rawNextCansaco,
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
          brisaResetTo: penalties.brisa,
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
        brisaRecovered,
        disposicaoRecovered,
        cansacoRecovered,
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
    const cansacoRecoveryPerHour = resolveCansacoRecoveryPerHour(profile);
    const [cansacoSync, disposicaoSync, addictionSync] = await Promise.all([
      this.cansacoSystem.sync(profile.player.id, profile.player.cansaco, {
        recoveryPerHour: cansacoRecoveryPerHour,
      }),
      this.disposicaoSystem.sync(profile.player.id, profile.player.disposicao),
      this.addictionSystem.sync(profile.player.id, profile.player.addiction),
    ]);
    const levelProgression = this.levelSystem.resolve(
      profile.player.conceito,
      profile.player.level,
    );

    if (
      !cansacoSync.changed &&
      !disposicaoSync.changed &&
      !addictionSync.changed &&
      !levelProgression.leveledUp &&
      levelProgression.level === profile.player.level
    ) {
      return;
    }

    profile.player.addiction = addictionSync.nextValue;
    profile.player.level = levelProgression.level;
    profile.player.disposicao = disposicaoSync.nextValue;
    profile.player.cansaco = cansacoSync.nextValue;

    await this.repository.updateRuntimeState(profile.player.id, {
      addiction: profile.player.addiction,
      level: profile.player.level,
      brisa: profile.player.brisa,
      disposicao: profile.player.disposicao,
      cansaco: profile.player.cansaco,
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

function serializePublicPlayerProfile(profile: PlayerPublicProfileRecord): PlayerPublicProfile {
  const summary = toPlayerSummary(profile.player);

  return {
    conceito: summary.resources.conceito,
    faction: profile.faction,
    id: summary.id,
    level: summary.level,
    location: {
      positionX: profile.player.positionX,
      positionY: profile.player.positionY,
      regionId: profile.player.regionId as RegionId,
    },
    nickname: summary.nickname,
    ranking: profile.ranking,
    regionId: summary.regionId,
    title: summary.title,
    visibility: {
      inventoryItemCount: profile.inventoryItemCount,
      preciseLocationVisible: true,
      propertyCount: profile.propertiesCount,
    },
    vocation: summary.vocation,
  };
}

function buildPlayerVocationCenter(
  profile: PlayerProfileRecord,
  now: Date,
): PlayerVocationCenterResponse {
  const status = resolvePlayerVocationStatus(profile.player, now);

  return {
    availability: resolvePlayerVocationAvailability(profile.player.credits, status),
    cooldownHours: VOCATION_CHANGE_COOLDOWN_HOURS,
    options: VOCATIONS.map((option) => ({
      baseAttributes: VOCATION_BASE_ATTRIBUTES[option.id],
      id: option.id,
      isCurrent: option.id === status.currentVocation,
      label: option.label,
      primaryAttribute: option.primaryAttribute,
      secondaryAttribute: option.secondaryAttribute,
    }) satisfies PlayerVocationOptionSummary),
    player: {
      credits: profile.player.credits,
      level: profile.player.level,
      nickname: profile.player.nickname,
      vocation: status.currentVocation,
    },
    status,
  };
}

function resolvePlayerVocationStatus(
  player: PlayerProfileRecord['player'],
  now: Date,
): PlayerVocationStatus {
  const currentVocation = player.vocation as VocationType;
  const pendingVocation = (player.vocationTarget as VocationType | null) ?? null;
  const transitionEndsAtDate = player.vocationTransitionEndsAt;
  const cooldownEndsAtDate = player.vocationChangedAt
    ? new Date(player.vocationChangedAt.getTime() + VOCATION_CHANGE_COOLDOWN_HOURS * 60 * 60 * 1000)
    : null;
  const nextAvailabilityDate = [transitionEndsAtDate, cooldownEndsAtDate]
    .filter((entry): entry is Date => entry instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const nextChangeAvailableAt =
    nextAvailabilityDate && nextAvailabilityDate.getTime() > now.getTime()
      ? nextAvailabilityDate
      : null;
  const state =
    transitionEndsAtDate && transitionEndsAtDate.getTime() > now.getTime() && pendingVocation
      ? 'transition'
      : nextChangeAvailableAt
        ? 'cooldown'
        : 'ready';

  return {
    changedAt: player.vocationChangedAt?.toISOString() ?? null,
    cooldownEndsAt: cooldownEndsAtDate?.toISOString() ?? null,
    cooldownRemainingSeconds: nextChangeAvailableAt
      ? Math.max(0, Math.ceil((nextChangeAvailableAt.getTime() - now.getTime()) / 1000))
      : 0,
    currentVocation,
    nextChangeAvailableAt: nextChangeAvailableAt?.toISOString() ?? null,
    pendingVocation,
    state,
    transitionEndsAt: transitionEndsAtDate?.toISOString() ?? null,
  };
}

function resolvePlayerVocationAvailability(
  credits: number,
  status: PlayerVocationStatus,
) {
  if (status.state === 'transition') {
    return {
      available: false,
      creditsCost: VOCATION_CHANGE_CREDITS_COST,
      reason: 'Existe uma transicao de vocacao em andamento. Aguarde o termino dela antes de trocar novamente.',
    };
  }

  if (status.state === 'cooldown') {
    return {
      available: false,
      creditsCost: VOCATION_CHANGE_CREDITS_COST,
      reason: `A troca de vocacao esta em cooldown global de ${VOCATION_CHANGE_COOLDOWN_HOURS}h.`,
    };
  }

  if (credits < VOCATION_CHANGE_CREDITS_COST) {
    return {
      available: false,
      creditsCost: VOCATION_CHANGE_CREDITS_COST,
      reason: 'Creditos insuficientes para mudar de vocacao.',
    };
  }

  return {
    available: true,
    creditsCost: VOCATION_CHANGE_CREDITS_COST,
    reason: null,
  };
}

function resolveVocationLabel(vocation: VocationType): string {
  return VOCATIONS.find((entry) => entry.id === vocation)?.label ?? vocation;
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
  message = 'Crie seu personagem antes de acessar o inventario.',
): void {
  const hasCharacter =
    'hasCharacter' in profile
      ? profile.hasCharacter
      : Boolean(profile.player.characterCreatedAt);

  if (!hasCharacter) {
    throw new PlayerError('conflict', message);
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

function resolveCansacoRecoveryPerHour(profile: PlayerProfileRecord): number {
  let recoveryPerHour = 12;

  if (profile.faction) {
    recoveryPerHour += 1;
  }

  recoveryPerHour += resolveResidentialBonuses(profile.properties).cansacoRecoveryPerHourBonus;

  recoveryPerHour -= Math.min(5, Math.floor(profile.player.addiction / 20));

  return clampNumber(recoveryPerHour, 4, 18);
}

function resolveResidentialBonuses(
  properties: Pick<PlayerPropertySummary, 'type'>[],
): {
  inventorySlotsBonus: number;
  inventoryWeightBonus: number;
  cansacoRecoveryPerHourBonus: number;
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
        cansacoRecoveryPerHourBonus: Math.max(
          bestBonus.cansacoRecoveryPerHourBonus,
          utility.cansacoRecoveryPerHourBonus,
        ),
      };
    },
    {
      inventorySlotsBonus: 0,
      inventoryWeightBonus: 0,
      cansacoRecoveryPerHourBonus: 0,
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
  drug: Pick<DrugDefinitionRecord, 'addictionRate' | 'disposicaoBoost' | 'cansacoRecovery'>,
): number {
  const baseGain = Math.ceil(drug.addictionRate);
  const effectBonus = Math.floor((drug.disposicaoBoost + drug.cansacoRecovery) / 6);

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
  rawNextCansaco: number;
  recentDrugTypes: DrugType[];
}): OverdoseTrigger | null {
  if (input.rawNextCansaco > 100) {
    return 'cansaco_overflow';
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
    brisa: 0,
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
