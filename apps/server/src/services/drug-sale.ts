import {
  DRUG_SALE_CHANNELS,
  DRUG_SALE_DOCKS_REGION_ID,
  type DrugSaleChannel,
  type DrugSaleExecuteResponse,
  type DrugSaleInput,
  type DrugSaleModifierSummary,
  type DrugSaleQuoteResponse,
  type RegionId,
} from '@cs-rio/shared';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  drugs,
  favelas,
  gameEvents,
  playerInventory,
  players,
  properties,
  regions,
  transactions,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { buildPlayerProfileCacheKey } from './player.js';

type PropertyChannelType = 'boca' | 'rave';
type DrugSaleErrorCode = 'conflict' | 'not_found' | 'validation';
type SupportedEventType =
  | 'ano_novo_copa'
  | 'baile_cidade'
  | 'carnaval'
  | 'navio_docas'
  | 'seca_drogas';

interface DrugSalePlayerRecord {
  carisma: number;
  id: string;
  inteligencia: number;
  level: number;
  money: number;
  regionId: RegionId;
  stamina: number;
}

interface DrugInventoryRecord {
  code: string;
  id: string;
  inventoryItemId: string;
  name: string;
  price: number;
  productionLevel: number;
  quantity: number;
}

interface DrugSalePropertyRecord {
  favelaPopulation: number | null;
  id: string;
  level: number;
  regionId: RegionId;
  type: PropertyChannelType;
}

interface DrugSaleRegionRecord {
  densityIndex: number;
  id: RegionId;
  policePressure: number;
  wealthIndex: number;
}

interface DrugSaleEventRecord {
  eventType: SupportedEventType;
  regionId: RegionId | null;
}

interface DrugSaleCommitInput {
  channel: DrugSaleChannel;
  commissionAmount: number;
  drugName: string;
  grossRevenue: number;
  inventoryItemId: string;
  netRevenue: number;
  playerId: string;
  quantitySold: number;
  staminaCost: number;
}

interface DrugSaleCommitResult {
  playerMoneyAfterSale: number;
  playerStaminaAfterSale: number;
  remainingQuantity: number;
  soldAt: Date;
}

interface QuoteContext {
  channel: (typeof DRUG_SALE_CHANNELS)[number];
  events: DrugSaleEventRecord[];
  inventoryItem: DrugInventoryRecord;
  player: DrugSalePlayerRecord;
  property: DrugSalePropertyRecord | null;
  region: DrugSaleRegionRecord;
}

interface QuoteResult extends DrugSaleQuoteResponse {
  commit: DrugSaleCommitInput;
}

export interface DrugSaleRepository {
  commitSale(input: DrugSaleCommitInput): Promise<DrugSaleCommitResult | null>;
  getDrugInventory(playerId: string, inventoryItemId: string): Promise<DrugInventoryRecord | null>;
  getPlayer(playerId: string): Promise<DrugSalePlayerRecord | null>;
  getProperty(playerId: string, propertyId: string): Promise<DrugSalePropertyRecord | null>;
  getRegion(regionId: RegionId): Promise<DrugSaleRegionRecord | null>;
  listActiveEvents(regionId: RegionId, now: Date): Promise<DrugSaleEventRecord[]>;
}

export interface DrugSaleServiceContract {
  close?(): Promise<void>;
  quoteSale(playerId: string, input: DrugSaleInput): Promise<DrugSaleQuoteResponse>;
  sell(playerId: string, input: DrugSaleInput): Promise<DrugSaleExecuteResponse>;
}

export interface DrugSaleServiceOptions {
  keyValueStore?: KeyValueStore;
  repository?: DrugSaleRepository;
}

export class DrugSaleError extends Error {
  constructor(
    public readonly code: DrugSaleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DrugSaleError';
  }
}

const CHANNEL_CONFIG_BY_ID = new Map<DrugSaleChannel, (typeof DRUG_SALE_CHANNELS)[number]>(
  DRUG_SALE_CHANNELS.map((channel) => [channel.id, channel]),
);

const CHANNEL_PRICE_MULTIPLIERS: Record<DrugSaleChannel, number> = {
  boca: 1.18,
  docks: 1.1,
  rave: 1.32,
  street: 1.02,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function buildRegionMultiplier(region: DrugSaleRegionRecord): number {
  const value =
    0.82 +
    region.wealthIndex / 220 +
    region.densityIndex / 260 -
    region.policePressure / 520;
  return clamp(value, 0.95, 1.45);
}

function buildAttributeMultiplier(player: DrugSalePlayerRecord, channel: DrugSaleChannel): number {
  switch (channel) {
    case 'street':
      return clamp(1 + player.carisma / 600, 1, 1.22);
    case 'boca':
      return clamp(1 + player.carisma / 500, 1, 1.25);
    case 'rave':
      return clamp(1 + (player.carisma + player.inteligencia) / 900, 1, 1.28);
    case 'docks':
      return clamp(1 + player.inteligencia / 650, 1, 1.3);
  }

  return 1;
}

function buildPropertyMultiplier(property: DrugSalePropertyRecord | null): number {
  if (!property) {
    return 1;
  }

  if (property.type === 'boca') {
    return clamp(
      1 + property.level * 0.05 + (property.favelaPopulation ?? 0) / 1_000_000,
      1,
      1.4,
    );
  }

  return clamp(1 + property.level * 0.07, 1, 1.45);
}

function hasActiveEvent(
  events: DrugSaleEventRecord[],
  eventType: SupportedEventType,
  regionId: RegionId,
): boolean {
  return events.some(
    (event) => event.eventType === eventType && (event.regionId === null || event.regionId === regionId),
  );
}

function buildEventModifiers(
  channel: DrugSaleChannel,
  events: DrugSaleEventRecord[],
  regionId: RegionId,
): DrugSaleModifierSummary[] {
  const modifiers: DrugSaleModifierSummary[] = [];

  if (hasActiveEvent(events, 'seca_drogas', regionId)) {
    modifiers.push({
      label: 'Seca de drogas',
      multiplier: 1.5,
      source: 'event',
    });
  }

  if (channel === 'rave' && hasActiveEvent(events, 'baile_cidade', regionId)) {
    modifiers.push({
      label: 'Baile da cidade',
      multiplier: 3,
      source: 'event',
    });
  }

  if (
    channel === 'rave' &&
    regionId === DRUG_SALE_DOCKS_REGION_ID &&
    hasActiveEvent(events, 'ano_novo_copa', regionId)
  ) {
    modifiers.push({
      label: 'Ano novo em Copa',
      multiplier: 1.2,
      source: 'event',
    });
  }

  if (
    channel === 'rave' &&
    (regionId === DRUG_SALE_DOCKS_REGION_ID || regionId === 'zona_sul') &&
    hasActiveEvent(events, 'carnaval', regionId)
  ) {
    modifiers.push({
      label: 'Carnaval',
      multiplier: 1.25,
      source: 'event',
    });
  }

  if (channel === 'docks' && hasActiveEvent(events, 'navio_docas', regionId)) {
    modifiers.push({
      label: 'Navio nas docas',
      multiplier: 1.5,
      source: 'event',
    });
  }

  return modifiers;
}

function buildDemandCap(input: {
  channel: DrugSaleChannel;
  events: DrugSaleEventRecord[];
  player: DrugSalePlayerRecord;
  property: DrugSalePropertyRecord | null;
  region: DrugSaleRegionRecord;
}): number {
  const { channel, events, player, property, region } = input;
  let demand = 0;

  switch (channel) {
    case 'street':
      demand = 6 + Math.floor(region.densityIndex / 18) + Math.floor(player.carisma / 10);
      break;
    case 'boca':
      demand =
        18 +
        (property?.level ?? 1) * 10 +
        Math.floor(region.densityIndex / 8) +
        Math.floor((property?.favelaPopulation ?? 0) / 8000);
      break;
    case 'rave':
      demand =
        24 +
        (property?.level ?? 1) * 12 +
        Math.floor(region.wealthIndex / 6) +
        Math.floor(player.carisma / 5);
      break;
    case 'docks':
      demand = 120 + Math.floor(player.inteligencia * 1.5);
      break;
  }

  if (hasActiveEvent(events, 'seca_drogas', region.id)) {
    demand = Math.floor(demand * 1.2);
  }

  if (channel === 'rave' && hasActiveEvent(events, 'baile_cidade', region.id)) {
    demand = Math.floor(demand * 3);
  }

  if (channel === 'docks' && hasActiveEvent(events, 'navio_docas', region.id)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(1, demand);
}

export class DatabaseDrugSaleRepository implements DrugSaleRepository {
  async commitSale(input: DrugSaleCommitInput): Promise<DrugSaleCommitResult | null> {
    return db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          money: players.money,
          stamina: players.stamina,
        })
        .from(players)
        .where(eq(players.id, input.playerId))
        .limit(1);

      const [inventoryItem] = await tx
        .select({
          quantity: playerInventory.quantity,
        })
        .from(playerInventory)
        .where(
          and(
            eq(playerInventory.id, input.inventoryItemId),
            eq(playerInventory.playerId, input.playerId),
            eq(playerInventory.itemType, 'drug'),
          ),
        )
        .limit(1);

      if (!player || !inventoryItem) {
        return null;
      }

      if (inventoryItem.quantity < input.quantitySold || player.stamina < input.staminaCost) {
        return null;
      }

      const remainingQuantity = inventoryItem.quantity - input.quantitySold;

      if (remainingQuantity <= 0) {
        await tx
          .delete(playerInventory)
          .where(
            and(
              eq(playerInventory.id, input.inventoryItemId),
              eq(playerInventory.playerId, input.playerId),
            ),
          );
      } else {
        await tx
          .update(playerInventory)
          .set({
            quantity: remainingQuantity,
          })
          .where(
            and(
              eq(playerInventory.id, input.inventoryItemId),
              eq(playerInventory.playerId, input.playerId),
            ),
          );
      }

      const updatedMoney = roundCurrency(Number.parseFloat(player.money) + input.netRevenue);
      const updatedStamina = player.stamina - input.staminaCost;

      await tx
        .update(players)
        .set({
          money: updatedMoney.toFixed(2),
          stamina: updatedStamina,
        })
        .where(eq(players.id, input.playerId));

      await tx.insert(transactions).values({
        amount: input.netRevenue.toFixed(2),
        description:
          `${input.quantitySold}x ${input.drugName} via ${input.channel}` +
          ` | bruto=${input.grossRevenue.toFixed(2)}` +
          ` | comissao=${input.commissionAmount.toFixed(2)}`,
        playerId: input.playerId,
        type: `drug_sale:${input.channel}`,
      });

      return {
        playerMoneyAfterSale: updatedMoney,
        playerStaminaAfterSale: updatedStamina,
        remainingQuantity,
        soldAt: new Date(),
      };
    });
  }

  async getDrugInventory(playerId: string, inventoryItemId: string): Promise<DrugInventoryRecord | null> {
    const [record] = await db
      .select({
        code: drugs.code,
        drugId: drugs.id,
        inventoryItemId: playerInventory.id,
        name: drugs.name,
        price: drugs.price,
        productionLevel: drugs.productionLevel,
        quantity: playerInventory.quantity,
      })
      .from(playerInventory)
      .innerJoin(drugs, eq(drugs.id, playerInventory.itemId))
      .where(
        and(
          eq(playerInventory.id, inventoryItemId),
          eq(playerInventory.playerId, playerId),
          eq(playerInventory.itemType, 'drug'),
        ),
      )
      .limit(1);

    if (!record) {
      return null;
    }

    return {
      code: record.code,
      id: record.drugId,
      inventoryItemId: record.inventoryItemId,
      name: record.name,
      price: Number.parseFloat(record.price),
      productionLevel: record.productionLevel,
      quantity: record.quantity,
    };
  }

  async getPlayer(playerId: string): Promise<DrugSalePlayerRecord | null> {
    const [player] = await db
      .select({
        carisma: players.carisma,
        id: players.id,
        inteligencia: players.inteligencia,
        level: players.level,
        money: players.money,
        regionId: players.regionId,
        stamina: players.stamina,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return null;
    }

    return {
      carisma: player.carisma,
      id: player.id,
      inteligencia: player.inteligencia,
      level: player.level,
      money: Number.parseFloat(player.money),
      regionId: player.regionId as RegionId,
      stamina: player.stamina,
    };
  }

  async getProperty(playerId: string, propertyId: string): Promise<DrugSalePropertyRecord | null> {
    const [property] = await db
      .select({
        favelaPopulation: favelas.population,
        id: properties.id,
        level: properties.level,
        regionId: properties.regionId,
        type: properties.type,
      })
      .from(properties)
      .leftJoin(favelas, eq(favelas.id, properties.favelaId))
      .where(and(eq(properties.id, propertyId), eq(properties.playerId, playerId)))
      .limit(1);

    if (!property || (property.type !== 'boca' && property.type !== 'rave')) {
      return null;
    }

    return {
      favelaPopulation: property.favelaPopulation,
      id: property.id,
      level: property.level,
      regionId: property.regionId as RegionId,
      type: property.type,
    };
  }

  async getRegion(regionId: RegionId): Promise<DrugSaleRegionRecord | null> {
    const [region] = await db
      .select({
        densityIndex: regions.densityIndex,
        id: regions.id,
        policePressure: regions.policePressure,
        wealthIndex: regions.wealthIndex,
      })
      .from(regions)
      .where(eq(regions.id, regionId))
      .limit(1);

    return region
      ? {
          ...region,
          id: region.id as RegionId,
        }
      : null;
  }

  async listActiveEvents(regionId: RegionId, now: Date): Promise<DrugSaleEventRecord[]> {
    const rows = await db
      .select({
        eventType: gameEvents.eventType,
        regionId: gameEvents.regionId,
      })
      .from(gameEvents)
      .where(
        and(
          lte(gameEvents.startedAt, now),
          gte(gameEvents.endsAt, now),
          or(eq(gameEvents.regionId, regionId), isNull(gameEvents.regionId)),
        ),
      );

    return rows.filter((row): row is DrugSaleEventRecord =>
      row.eventType === 'ano_novo_copa' ||
      row.eventType === 'baile_cidade' ||
      row.eventType === 'carnaval' ||
      row.eventType === 'navio_docas' ||
      row.eventType === 'seca_drogas',
    );
  }
}

export class DrugSaleService implements DrugSaleServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly ownsKeyValueStore: boolean;

  private readonly repository: DrugSaleRepository;

  constructor(options: DrugSaleServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.repository = options.repository ?? new DatabaseDrugSaleRepository();
  }

  async close(): Promise<void> {
    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async quoteSale(playerId: string, input: DrugSaleInput): Promise<DrugSaleQuoteResponse> {
    const context = await this.loadContext(playerId, input);
    return this.buildQuote(context, input);
  }

  async sell(playerId: string, input: DrugSaleInput): Promise<DrugSaleExecuteResponse> {
    const context = await this.loadContext(playerId, input);
    const quote = this.buildQuote(context, input);
    const committed = await this.repository.commitSale(quote.commit);

    if (!committed) {
      throw new DrugSaleError(
        'conflict',
        'Nao foi possivel concluir a venda. Confira inventario, estamina e tente novamente.',
      );
    }

    await this.keyValueStore.delete?.(buildPlayerProfileCacheKey(playerId));

    return {
      ...quote,
      playerMoneyAfterSale: committed.playerMoneyAfterSale,
      playerStaminaAfterSale: committed.playerStaminaAfterSale,
      pricing: {
        ...quote.pricing,
      },
      quantity: {
        ...quote.quantity,
        remainingAfterSale: committed.remainingQuantity,
      },
      soldAt: committed.soldAt.toISOString(),
    };
  }

  private buildQuote(context: QuoteContext, input: DrugSaleInput): QuoteResult {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new DrugSaleError('validation', 'A quantidade para venda precisa ser um inteiro positivo.');
    }

    if (context.player.level < context.channel.minLevel) {
      throw new DrugSaleError(
        'validation',
        `Canal indisponivel. Nivel minimo requerido: ${context.channel.minLevel}.`,
      );
    }

    if (context.channel.staminaCost > 0 && context.player.stamina < context.channel.staminaCost) {
      throw new DrugSaleError('validation', 'Estamina insuficiente para trafico direto.');
    }

    if (context.channel.id === 'docks') {
      if (context.player.regionId !== DRUG_SALE_DOCKS_REGION_ID) {
        throw new DrugSaleError('validation', 'A venda nas docas so pode ser feita no Centro.');
      }

      if (!hasActiveEvent(context.events, 'navio_docas', context.region.id)) {
        throw new DrugSaleError('validation', 'Nao ha navio atracado nas docas no momento.');
      }
    }

    const modifiers: DrugSaleModifierSummary[] = [
      {
        label: context.channel.label,
        multiplier: CHANNEL_PRICE_MULTIPLIERS[context.channel.id],
        source: 'channel',
      },
      {
        label: `Regiao ${context.region.id}`,
        multiplier: buildRegionMultiplier(context.region),
        source: 'region',
      },
      {
        label:
          context.channel.id === 'docks' ? 'Inteligencia de negociacao' : 'Carisma de venda',
        multiplier: buildAttributeMultiplier(context.player, context.channel.id),
        source: 'attribute',
      },
    ];

    if (context.property) {
      modifiers.push({
        label: context.property.type === 'boca' ? 'Estrutura da boca' : 'Estrutura da rave',
        multiplier: buildPropertyMultiplier(context.property),
        source: 'property',
      });
    }

    modifiers.push(...buildEventModifiers(context.channel.id, context.events, context.region.id));

    const finalUnitPrice = roundCurrency(
      context.inventoryItem.price *
        modifiers.reduce((accumulator, modifier) => accumulator * modifier.multiplier, 1),
    );
    const demandCap = buildDemandCap({
      channel: context.channel.id,
      events: context.events,
      player: context.player,
      property: context.property,
      region: context.region,
    });
    const sellableQuantity = Math.min(input.quantity, context.inventoryItem.quantity, demandCap);

    if (sellableQuantity <= 0) {
      throw new DrugSaleError('validation', 'Nao ha demanda suficiente para vender essa droga agora.');
    }

    const grossRevenue = roundCurrency(finalUnitPrice * sellableQuantity);
    const commissionAmount = roundCurrency(grossRevenue * context.channel.commissionRate);
    const netRevenue = roundCurrency(grossRevenue - commissionAmount);
    const warnings: string[] = [];

    if (input.quantity > context.inventoryItem.quantity) {
      warnings.push('A venda foi limitada pela quantidade disponivel no inventario.');
    }

    if (input.quantity > demandCap) {
      warnings.push('O canal nao absorveu toda a quantidade pedida nesta janela de venda.');
    }

    return {
      channel: {
        commissionRate: context.channel.commissionRate,
        id: context.channel.id,
        label: context.channel.label,
        propertyTypeRequired: context.channel.propertyTypeRequired,
        staminaCost: context.channel.staminaCost,
      },
      commit: {
        channel: context.channel.id,
        commissionAmount,
        drugName: context.inventoryItem.name,
        grossRevenue,
        inventoryItemId: context.inventoryItem.inventoryItemId,
        netRevenue,
        playerId: context.player.id,
        quantitySold: sellableQuantity,
        staminaCost: context.channel.staminaCost,
      },
      drug: {
        code: context.inventoryItem.code,
        id: context.inventoryItem.id,
        inventoryItemId: context.inventoryItem.inventoryItemId,
        name: context.inventoryItem.name,
      },
      location: {
        propertyId: context.property?.id ?? null,
        propertyType: context.property?.type ?? null,
        regionId: context.region.id,
      },
      modifiers,
      pricing: {
        baseUnitPrice: context.inventoryItem.price,
        commissionAmount,
        finalUnitPrice,
        grossRevenue,
        netRevenue,
      },
      quantity: {
        available: context.inventoryItem.quantity,
        demandCap,
        remainingAfterSale: context.inventoryItem.quantity - sellableQuantity,
        requested: input.quantity,
        sellable: sellableQuantity,
      },
      warnings,
    };
  }

  private async loadContext(playerId: string, input: DrugSaleInput): Promise<QuoteContext> {
    const channel = CHANNEL_CONFIG_BY_ID.get(input.channel);

    if (!channel) {
      throw new DrugSaleError('validation', 'Canal de venda invalido.');
    }

    const [player, inventoryItem] = await Promise.all([
      this.repository.getPlayer(playerId),
      this.repository.getDrugInventory(playerId, input.inventoryItemId),
    ]);

    if (!player || !inventoryItem) {
      throw new DrugSaleError('not_found', 'Jogador ou droga do inventario nao encontrados.');
    }

    let property: DrugSalePropertyRecord | null = null;

    if (channel.propertyTypeRequired) {
      if (!input.propertyId) {
        throw new DrugSaleError(
          'validation',
          `Este canal exige uma propriedade do tipo ${channel.propertyTypeRequired}.`,
        );
      }

      property = await this.repository.getProperty(playerId, input.propertyId);

      if (!property || property.type !== channel.propertyTypeRequired) {
        throw new DrugSaleError(
          'validation',
          `Propriedade invalida. Era esperado um estabelecimento do tipo ${channel.propertyTypeRequired}.`,
        );
      }
    }

    const saleRegionId = property?.regionId ?? player.regionId;
    const [region, events] = await Promise.all([
      this.repository.getRegion(saleRegionId),
      this.repository.listActiveEvents(saleRegionId, new Date()),
    ]);

    if (!region) {
      throw new DrugSaleError('not_found', 'Regiao de venda nao encontrada.');
    }

    return {
      channel,
      events,
      inventoryItem,
      player,
      property,
      region,
    };
  }
}
