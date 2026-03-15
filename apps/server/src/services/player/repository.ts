import { VOCATION_BASE_ATTRIBUTES, type DrugType, type InventoryEquipSlot, type InventoryGrantInput, type InventoryItemType, type PlayerCreationInput, type PlayerInventoryItem, type RegionId } from '@cs-rio/shared';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '../../db/client.js';
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
} from '../../db/schema.js';
import { ServerConfigService } from '../server-config.js';
import type {
  DrugDefinitionRecord,
  InventoryDefinitionRecord,
  PlayerDrugConsumptionInput,
  PlayerOverdosePenaltyInput,
  PlayerOverdosePenaltyResult,
  PlayerProfileRecord,
  PlayerRepository,
  PlayerRuntimeStateInput,
} from './types.js';

const serverConfigService = new ServerConfigService();

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

function isStackableInventoryItemType(itemType: InventoryItemType): boolean {
  return itemType === 'drug' || itemType === 'component' || itemType === 'consumable';
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
