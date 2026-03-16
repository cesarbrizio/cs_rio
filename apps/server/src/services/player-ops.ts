import { randomUUID } from 'node:crypto';

import { LEVELS, type InventoryEquipSlot, type InventoryItemType, type RegionId, type VocationType } from '@cs-rio/shared';
import { and, eq, gt, inArray, or } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  components,
  drugs,
  playerInventory,
  playerOperationLogs,
  players,
  prisonRecords,
  vests,
  weapons,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { OverdoseSystem } from '../systems/OverdoseSystem.js';
import { PrisonSystem } from '../systems/PrisonSystem.js';
import { DatabasePlayerRepository } from './player.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import { ServerConfigService } from './server-config.js';

type SupportedInventoryItemType = Extract<InventoryItemType, 'component' | 'drug' | 'vest' | 'weapon'>;

function toJsonRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

export interface PlayerOpsSelector {
  email?: string;
  nickname?: string;
  playerId?: string;
  player?: string;
}

type MoneyOperation =
  | { type: 'add-bank-money'; value: number }
  | { type: 'add-money'; value: number }
  | { type: 'set-bank-money'; value: number }
  | { type: 'set-money'; value: number };

type ResourceOperation =
  | { type: 'full-resources' }
  | { type: 'set-addiction'; value: number }
  | { type: 'set-hp'; value: number }
  | { type: 'set-brisa'; value: number }
  | { type: 'set-disposicao'; value: number }
  | { type: 'set-cansaco'; value: number };

type ProgressionOperation =
  | { type: 'set-conceito'; value: number }
  | { type: 'set-level'; value: number }
  | { type: 'set-vocation'; value: VocationType };

type PositionOperation =
  | { type: 'move-to-region-spawn' }
  | { type: 'set-position'; x: number; y: number }
  | { type: 'set-region'; value: RegionId };

type StatusOperation =
  | { type: 'clear-hospital' }
  | { type: 'clear-prison' }
  | { type: 'set-hospital-minutes'; value: number }
  | { type: 'set-prison-minutes'; value: number };

type InventorySpec = {
  identifier: string;
  itemType: SupportedInventoryItemType;
};

type InventoryOperation =
  | { type: 'equip-item'; value: InventorySpec | { inventoryItemId: string } }
  | { type: 'grant-item'; itemType: SupportedInventoryItemType; codeOrId: string; quantity: number }
  | { type: 'remove-item'; value: InventorySpec | { inventoryItemId: string } }
  | { type: 'repair-all' }
  | { type: 'set-item-quantity'; quantity: number; value: InventorySpec | { inventoryItemId: string } }
  | { type: 'unequip-item'; value: InventorySpec | { inventoryItemId: string } | { slot: InventoryEquipSlot } };

export type PlayerOpsOperation =
  | InventoryOperation
  | MoneyOperation
  | PositionOperation
  | ProgressionOperation
  | ResourceOperation
  | StatusOperation;

export interface PlayerOpsCommand {
  actor?: string;
  operation: PlayerOpsOperation;
  origin?: string;
}

export interface PlayerOpsResult {
  applied: Array<{
    operationType: PlayerOpsOperation['type'];
    summary: string;
  }>;
  batchId: string;
  player: PlayerOpsSnapshot;
}

export interface PlayerOpsPreviewResult {
  dryRun: true;
  operations: Array<{
    changed: boolean;
    operationType: PlayerOpsOperation['type'];
    summary: string;
  }>;
  player: PlayerOpsSnapshot;
}

interface PlayerOpsPlayerRecord {
  addiction: number;
  bankMoney: string;
  characterCreatedAt: Date | null;
  conceito: number;
  email: string;
  factionId: string | null;
  hp: number;
  id: string;
  level: number;
  money: string;
  brisa: number;
  disposicao: number;
  nickname: string;
  positionX: number;
  positionY: number;
  regionId: RegionId;
  cansaco: number;
  vocation: VocationType;
}

type InventorySnapshotItem = {
  code: string | null;
  durability: number | null;
  equippedSlot: InventoryEquipSlot | null;
  id: string;
  itemType: InventoryItemType;
  quantity: number;
};

export interface PlayerOpsSnapshot {
  addiction: number;
  bankMoney: number;
  characterReady: boolean;
  conceito: number;
  email: string;
  factionId: string | null;
  hospital: {
    endsAt: string | null;
    isHospitalized: boolean;
    reason: string | null;
    remainingSeconds: number;
  };
  hp: number;
  inventory: InventorySnapshotItem[];
  level: number;
  money: number;
  brisa: number;
  disposicao: number;
  nickname: string;
  position: {
    regionId: RegionId;
    x: number;
    y: number;
  };
  prison: {
    endsAt: string | null;
    heatScore: number;
    heatTier: string;
    isImprisoned: boolean;
    reason: string | null;
    remainingSeconds: number;
  };
  cansaco: number;
  vocation: VocationType;
  wealth: {
    bankMoney: number;
    money: number;
  };
}

interface PlayerOpsServiceOptions {
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  overdoseSystem?: OverdoseSystem;
  prisonSystem?: PrisonSystem;
  repository?: DatabasePlayerRepository;
  serverConfigService?: ServerConfigService;
}

export class PlayerOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerOpsError';
  }
}

export class PlayerOpsService {
  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly overdoseSystem: OverdoseSystem;

  private readonly prisonSystem: PrisonSystem;

  private readonly repository: DatabasePlayerRepository;

  private readonly serverConfigService: ServerConfigService;

  constructor(options: PlayerOpsServiceOptions = {}) {
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.now = options.now ?? (() => new Date());
    this.overdoseSystem =
      options.overdoseSystem ??
      new OverdoseSystem({
        keyValueStore: this.keyValueStore,
        now: () => this.now().getTime(),
      });
    this.prisonSystem =
      options.prisonSystem ??
      new PrisonSystem({
        keyValueStore: this.keyValueStore,
        now: () => this.now(),
      });
    this.repository = options.repository ?? new DatabasePlayerRepository();
    this.serverConfigService = options.serverConfigService ?? new ServerConfigService();
  }

  async close(): Promise<void> {
    await this.overdoseSystem.close?.();
    await this.prisonSystem.close?.();
    await this.keyValueStore.close?.();
  }

  async applyCommands(selector: PlayerOpsSelector, commands: PlayerOpsCommand[]): Promise<PlayerOpsResult> {
    if (commands.length === 0) {
      throw new PlayerOpsError('Nenhuma operação de player foi informada.');
    }

    let player = await this.resolvePlayer(selector);
    const batchId = randomUUID();
    const applied: PlayerOpsResult['applied'] = [];

    for (const command of commands) {
      const before = await this.snapshotPlayer(player.id);
      const summary = await this.applyOperation(player, command.operation);
      const after = await this.snapshotPlayer(player.id);
      const beforeJson = toJsonRecord(before);
      const afterJson = toJsonRecord(after);
      const payloadJson = toJsonRecord(command.operation);

      await db.insert(playerOperationLogs).values({
        actor: command.actor ?? process.env.USER ?? 'local',
        afterJson,
        batchId,
        beforeJson,
        operationType: command.operation.type,
        origin: command.origin ?? 'ops:player',
        payloadJson,
        playerId: player.id,
        summary,
      });

      applied.push({
        operationType: command.operation.type,
        summary,
      });

      await this.invalidatePlayerCache(player.id);
      player = await this.resolvePlayer({ playerId: player.id });
    }

    await this.invalidatePlayerCache(player.id);

    return {
      applied,
      batchId,
      player: await this.snapshotPlayer(player.id),
    };
  }

  async previewCommands(
    selector: PlayerOpsSelector,
    commands: PlayerOpsCommand[],
  ): Promise<PlayerOpsPreviewResult> {
    if (commands.length === 0) {
      throw new PlayerOpsError('Nenhuma operação de player foi informada.');
    }

    const player = await this.resolvePlayer(selector);
    const previewPlayer = { ...player };
    const operations: PlayerOpsPreviewResult['operations'] = [];

    for (const command of commands) {
      operations.push(await this.previewOperation(previewPlayer, command.operation));
    }

    return {
      dryRun: true,
      operations,
      player: await this.snapshotPlayer(player.id),
    };
  }

  private async applyOperation(
    player: PlayerOpsPlayerRecord,
    operation: PlayerOpsOperation,
  ): Promise<string> {
    switch (operation.type) {
      case 'set-money':
        await this.updatePlayer(player.id, { money: toMoneyString(requireNonNegative(operation.value, operation.type)) });
        return `Dinheiro em mãos ajustado para R$ ${formatMoney(operation.value)}.`;
      case 'add-money': {
        const nextMoney = clampMoney(Number.parseFloat(player.money) + operation.value);
        await this.updatePlayer(player.id, { money: toMoneyString(nextMoney) });
        return `Dinheiro em mãos ajustado em ${formatSignedMoney(operation.value)}.`;
      }
      case 'set-bank-money':
        await this.updatePlayer(player.id, { bankMoney: toMoneyString(requireNonNegative(operation.value, operation.type)) });
        return `Banco pessoal ajustado para R$ ${formatMoney(operation.value)}.`;
      case 'add-bank-money': {
        const nextBankMoney = clampMoney(Number.parseFloat(player.bankMoney) + operation.value);
        await this.updatePlayer(player.id, { bankMoney: toMoneyString(nextBankMoney) });
        return `Banco pessoal ajustado em ${formatSignedMoney(operation.value)}.`;
      }
      case 'set-hp':
        await this.updatePlayer(player.id, { hp: clampStat(operation.value, 0, 100, operation.type) });
        return `HP ajustado para ${operation.value}.`;
      case 'set-cansaco':
        await this.updatePlayer(player.id, { cansaco: clampStat(operation.value, 0, 100, operation.type) });
        return `Cansaço ajustado para ${operation.value}.`;
      case 'set-disposicao':
        await this.updatePlayer(player.id, { disposicao: clampStat(operation.value, 0, 100, operation.type) });
        return `Disposição ajustada para ${operation.value}.`;
      case 'set-brisa':
        await this.updatePlayer(player.id, { brisa: clampStat(operation.value, 0, 100, operation.type) });
        return `Brisa ajustada para ${operation.value}.`;
      case 'set-addiction':
        await this.updatePlayer(player.id, { addiction: clampStat(operation.value, 0, 100, operation.type) });
        return `Vício ajustado para ${operation.value}.`;
      case 'full-resources':
        await this.updatePlayer(player.id, {
          addiction: 0,
          hp: 100,
          brisa: 100,
          disposicao: 100,
          cansaco: 100,
        });
        return 'HP, cansaço, disposição e brisa restaurados; vício zerado.';
      case 'set-conceito':
        await this.updatePlayer(player.id, { conceito: requireWholeNumber(operation.value, operation.type) });
        return `Conceito ajustado para ${operation.value}.`;
      case 'set-level': {
        const targetLevel = requireWholeNumber(operation.value, operation.type);
        const levelEntry = LEVELS.find((entry) => entry.level === targetLevel);
        if (!levelEntry) {
          throw new PlayerOpsError(`Nível inválido: ${targetLevel}.`);
        }
        const nextConceito = Math.max(player.conceito, levelEntry.conceitoRequired);
        await this.updatePlayer(player.id, { conceito: nextConceito, level: targetLevel });
        return `Nível forçado para ${targetLevel} com conceito mínimo coerente (${nextConceito}).`;
      }
      case 'set-vocation':
        await this.updatePlayer(player.id, { vocation: operation.value });
        return `Vocação ajustada para ${operation.value}.`;
      case 'set-region':
        await this.updatePlayer(player.id, { regionId: operation.value });
        return `Região ajustada para ${operation.value}.`;
      case 'set-position':
        await this.updatePlayer(player.id, {
          positionX: clampStat(operation.x, 0, 10_000, operation.type),
          positionY: clampStat(operation.y, 0, 10_000, operation.type),
        });
        return `Posição ajustada para (${operation.x}, ${operation.y}).`;
      case 'move-to-region-spawn': {
        const currentPlayer = await this.requirePlayerById(player.id);
        const region = await this.serverConfigService.getRegion(currentPlayer.regionId);
        const targetX = region?.spawnPositionX ?? 0;
        const targetY = region?.spawnPositionY ?? 0;
        await this.updatePlayer(player.id, { positionX: targetX, positionY: targetY });
        return `Jogador movido para o spawn oficial de ${currentPlayer.regionId}.`;
      }
      case 'clear-prison': {
        const now = this.now();
        await db
          .update(prisonRecords)
          .set({
            releaseAt: now,
          })
          .where(and(eq(prisonRecords.playerId, player.id), gt(prisonRecords.releaseAt, now)));
        return 'Prisão ativa removida.';
      }
      case 'set-prison-minutes': {
        const minutes = requireNonNegative(operation.value, operation.type);
        if (minutes === 0) {
          await db
            .update(prisonRecords)
            .set({
              releaseAt: this.now(),
            })
            .where(and(eq(prisonRecords.playerId, player.id), gt(prisonRecords.releaseAt, this.now())));
          return 'Prisão zerada (0 minutos).';
        }

        const now = this.now();
        await db
          .update(prisonRecords)
          .set({
            releaseAt: now,
          })
          .where(and(eq(prisonRecords.playerId, player.id), gt(prisonRecords.releaseAt, now)));
        await db.insert(prisonRecords).values({
          allowBail: true,
          allowBribe: true,
          allowEscape: true,
          allowFactionRescue: true,
          playerId: player.id,
          reason: 'Operação interna de desenvolvimento.',
          releaseAt: new Date(now.getTime() + Math.round(minutes * 60 * 1000)),
          sentencedAt: now,
        });
        return `Prisão forçada por ${minutes} minuto(s).`;
      }
      case 'clear-hospital':
        await this.overdoseSystem.clearHospitalization(player.id);
        return 'Hospitalização ativa removida.';
      case 'set-hospital-minutes': {
        const minutes = requireNonNegative(operation.value, operation.type);
        if (minutes === 0) {
          await this.overdoseSystem.clearHospitalization(player.id);
          return 'Hospitalização zerada (0 minutos).';
        }
        await this.overdoseSystem.hospitalize(player.id, {
          durationMs: Math.round(minutes * 60 * 1000),
          reason: 'combat',
          trigger: null,
        });
        return `Hospitalização forçada por ${minutes} minuto(s).`;
      }
      case 'grant-item': {
        const definition = await resolveInventoryDefinitionByCodeOrId(operation.itemType, operation.codeOrId);
        if (!definition) {
          throw new PlayerOpsError(`Item não encontrado para ${operation.itemType}:${operation.codeOrId}.`);
        }
        await this.repository.grantInventoryItem(player.id, {
          itemId: definition.id,
          itemType: operation.itemType,
          quantity: requireWholeNumber(operation.quantity, operation.type),
        });
        return `Item concedido: ${operation.itemType}:${definition.code} x${operation.quantity}.`;
      }
      case 'remove-item': {
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length === 0) {
          throw new PlayerOpsError('Nenhum item do inventário encontrado para remover.');
        }
        const ids = inventoryItems.map((item) => item.id);
        await db.delete(playerInventory).where(inArray(playerInventory.id, ids));
        return `${inventoryItems.length} item(ns) removido(s) do inventário.`;
      }
      case 'set-item-quantity': {
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length !== 1) {
          throw new PlayerOpsError('Ajuste de quantidade exige exatamente um item de inventário como alvo.');
        }
        const target = inventoryItems[0]!;
        await this.repository.updateInventoryItemQuantity(
          player.id,
          target.id,
          requireWholeNumber(operation.quantity, operation.type),
        );
        return `Quantidade do item ajustada para ${operation.quantity}.`;
      }
      case 'equip-item': {
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length !== 1) {
          throw new PlayerOpsError('Equipar exige exatamente um item de inventário como alvo.');
        }
        const target = inventoryItems[0]!;
        if (target.itemType !== 'weapon' && target.itemType !== 'vest') {
          throw new PlayerOpsError('Somente armas e coletes podem ser equipados.');
        }
        await this.repository.clearInventoryEquipSlot(player.id, target.itemType);
        await this.repository.setInventoryEquipSlot(player.id, target.id, target.itemType);
        return `${target.itemType === 'weapon' ? 'Arma' : 'Colete'} equipado(a).`;
      }
      case 'unequip-item': {
        if ('slot' in operation.value) {
          await this.repository.clearInventoryEquipSlot(player.id, operation.value.slot);
          return `Slot ${operation.value.slot} desequipado.`;
        }
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length !== 1) {
          throw new PlayerOpsError('Desequipar exige exatamente um item de inventário como alvo.');
        }
        const target = inventoryItems[0]!;
        await this.repository.setInventoryEquipSlot(player.id, target.id, null);
        return 'Item desequipado.';
      }
      case 'repair-all': {
        const repairedCount = await this.repairAll(player.id);
        return repairedCount > 0 ? `${repairedCount} item(ns) reparado(s).` : 'Nenhum item reparável encontrado.';
      }
      default:
        return exhaustiveGuard(operation);
    }
  }

  private async previewOperation(
    player: PlayerOpsPlayerRecord,
    operation: PlayerOpsOperation,
  ): Promise<{ changed: boolean; operationType: PlayerOpsOperation['type']; summary: string }> {
    switch (operation.type) {
      case 'set-money': {
        const nextValue = requireNonNegative(operation.value, operation.type);
        const currentValue = Number.parseFloat(player.money);
        player.money = toMoneyString(nextValue);
        return {
          changed: currentValue !== nextValue,
          operationType: operation.type,
          summary:
            currentValue === nextValue
              ? `Dinheiro em mãos já está em R$ ${formatMoney(nextValue)}.`
              : `Dry-run: dinheiro em mãos iria para R$ ${formatMoney(nextValue)}.`,
        };
      }
      case 'add-money': {
        const currentValue = Number.parseFloat(player.money);
        const nextValue = clampMoney(currentValue + operation.value);
        player.money = toMoneyString(nextValue);
        return {
          changed: operation.value !== 0,
          operationType: operation.type,
          summary: `Dry-run: dinheiro em mãos seria ajustado em ${formatSignedMoney(operation.value)}.`,
        };
      }
      case 'set-bank-money': {
        const nextValue = requireNonNegative(operation.value, operation.type);
        const currentValue = Number.parseFloat(player.bankMoney);
        player.bankMoney = toMoneyString(nextValue);
        return {
          changed: currentValue !== nextValue,
          operationType: operation.type,
          summary:
            currentValue === nextValue
              ? `Banco pessoal já está em R$ ${formatMoney(nextValue)}.`
              : `Dry-run: banco pessoal iria para R$ ${formatMoney(nextValue)}.`,
        };
      }
      case 'add-bank-money': {
        const nextValue = clampMoney(Number.parseFloat(player.bankMoney) + operation.value);
        player.bankMoney = toMoneyString(nextValue);
        return {
          changed: operation.value !== 0,
          operationType: operation.type,
          summary: `Dry-run: banco pessoal seria ajustado em ${formatSignedMoney(operation.value)}.`,
        };
      }
      case 'set-hp':
        return previewStat(player, operation, 'hp', 'HP');
      case 'set-cansaco':
        return previewStat(player, operation, 'cansaco', 'Cansaço');
      case 'set-disposicao':
        return previewStat(player, operation, 'disposicao', 'Disposição');
      case 'set-brisa':
        return previewStat(player, operation, 'brisa', 'Brisa');
      case 'set-addiction':
        return previewStat(player, operation, 'addiction', 'Vício');
      case 'full-resources': {
        const changed =
          player.hp !== 100 ||
          player.cansaco !== 100 ||
          player.disposicao !== 100 ||
          player.brisa !== 100 ||
          player.addiction !== 0;
        player.hp = 100;
        player.cansaco = 100;
        player.disposicao = 100;
        player.brisa = 100;
        player.addiction = 0;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? 'Dry-run: HP, cansaço, disposição e brisa seriam restaurados; vício seria zerado.'
            : 'Recursos já estão cheios e vício já está zerado.',
        };
      }
      case 'set-conceito': {
        const nextValue = requireWholeNumber(operation.value, operation.type);
        const changed = player.conceito !== nextValue;
        player.conceito = nextValue;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: conceito iria para ${nextValue}.`
            : `Conceito já está em ${nextValue}.`,
        };
      }
      case 'set-level': {
        const targetLevel = requireWholeNumber(operation.value, operation.type);
        const levelEntry = LEVELS.find((entry) => entry.level === targetLevel);
        if (!levelEntry) {
          throw new PlayerOpsError(`Nível inválido: ${targetLevel}.`);
        }
        const nextConceito = Math.max(player.conceito, levelEntry.conceitoRequired);
        const changed = player.level !== targetLevel || player.conceito !== nextConceito;
        player.level = targetLevel;
        player.conceito = nextConceito;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: nível iria para ${targetLevel} com conceito mínimo coerente (${nextConceito}).`
            : `Jogador já está no nível ${targetLevel} com conceito coerente.`,
        };
      }
      case 'set-vocation': {
        const changed = player.vocation !== operation.value;
        player.vocation = operation.value;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: vocação iria para ${operation.value}.`
            : `Vocação já está em ${operation.value}.`,
        };
      }
      case 'set-region': {
        const changed = player.regionId !== operation.value;
        player.regionId = operation.value;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: região iria para ${operation.value}.`
            : `Região já está em ${operation.value}.`,
        };
      }
      case 'set-position': {
        const nextX = clampStat(operation.x, 0, 10_000, operation.type);
        const nextY = clampStat(operation.y, 0, 10_000, operation.type);
        const changed = player.positionX !== nextX || player.positionY !== nextY;
        player.positionX = nextX;
        player.positionY = nextY;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: posição iria para (${nextX}, ${nextY}).`
            : `Posição já está em (${nextX}, ${nextY}).`,
        };
      }
      case 'move-to-region-spawn': {
        const region = await this.serverConfigService.getRegion(player.regionId);
        const targetX = region?.spawnPositionX ?? 0;
        const targetY = region?.spawnPositionY ?? 0;
        const changed = player.positionX !== targetX || player.positionY !== targetY;
        player.positionX = targetX;
        player.positionY = targetY;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: jogador iria para o spawn oficial de ${player.regionId}.`
            : `Jogador já está no spawn oficial de ${player.regionId}.`,
        };
      }
      case 'clear-prison': {
        const prison = await this.prisonSystem.getStatus(player.id);
        return {
          changed: prison.isImprisoned,
          operationType: operation.type,
          summary: prison.isImprisoned
            ? 'Dry-run: prisão ativa seria removida.'
            : 'Jogador já está fora da prisão.',
        };
      }
      case 'set-prison-minutes':
        return {
          changed: true,
          operationType: operation.type,
          summary:
            requireNonNegative(operation.value, operation.type) === 0
              ? 'Dry-run: prisão seria zerada.'
              : `Dry-run: prisão seria forçada por ${operation.value} minuto(s).`,
        };
      case 'clear-hospital': {
        const hospital = await this.overdoseSystem.getHospitalizationStatus(player.id);
        return {
          changed: hospital.isHospitalized,
          operationType: operation.type,
          summary: hospital.isHospitalized
            ? 'Dry-run: hospitalização ativa seria removida.'
            : 'Jogador já está fora do hospital.',
        };
      }
      case 'set-hospital-minutes':
        return {
          changed: true,
          operationType: operation.type,
          summary:
            requireNonNegative(operation.value, operation.type) === 0
              ? 'Dry-run: hospitalização seria zerada.'
              : `Dry-run: hospitalização seria forçada por ${operation.value} minuto(s).`,
        };
      case 'grant-item': {
        const definition = await resolveInventoryDefinitionByCodeOrId(operation.itemType, operation.codeOrId);
        if (!definition) {
          throw new PlayerOpsError(`Item não encontrado para ${operation.itemType}:${operation.codeOrId}.`);
        }
        return {
          changed: requireWholeNumber(operation.quantity, operation.type) > 0,
          operationType: operation.type,
          summary: `Dry-run: item ${operation.itemType}:${definition.code} seria concedido x${operation.quantity}.`,
        };
      }
      case 'remove-item': {
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length === 0) {
          throw new PlayerOpsError('Nenhum item do inventário encontrado para remover.');
        }
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: ${inventoryItems.length} item(ns) seriam removidos do inventário.`,
        };
      }
      case 'set-item-quantity': {
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length !== 1) {
          throw new PlayerOpsError('Ajuste de quantidade exige exatamente um item de inventário como alvo.');
        }
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: quantidade do item seria ajustada para ${operation.quantity}.`,
        };
      }
      case 'equip-item': {
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length !== 1) {
          throw new PlayerOpsError('Equipar exige exatamente um item de inventário como alvo.');
        }
        const target = inventoryItems[0]!;
        if (target.itemType !== 'weapon' && target.itemType !== 'vest') {
          throw new PlayerOpsError('Somente armas e coletes podem ser equipados.');
        }
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: ${target.itemType === 'weapon' ? 'arma' : 'colete'} seria equipado(a).`,
        };
      }
      case 'unequip-item': {
        if ('slot' in operation.value) {
          return {
            changed: true,
            operationType: operation.type,
            summary: `Dry-run: slot ${operation.value.slot} seria desequipado.`,
          };
        }
        const inventoryItems = await this.resolveInventoryTargets(player.id, operation.value);
        if (inventoryItems.length !== 1) {
          throw new PlayerOpsError('Desequipar exige exatamente um item de inventário como alvo.');
        }
        return {
          changed: true,
          operationType: operation.type,
          summary: 'Dry-run: item seria desequipado.',
        };
      }
      case 'repair-all': {
        const repairedCount = await this.repairAllPreview(player.id);
        return {
          changed: repairedCount > 0,
          operationType: operation.type,
          summary:
            repairedCount > 0
              ? `Dry-run: ${repairedCount} item(ns) seriam reparados.`
              : 'Nenhum item reparável encontrado.',
        };
      }
      default:
        return exhaustiveGuard(operation);
    }
  }

  private async repairAll(playerId: string): Promise<number> {
    const rows = await db
      .select({
        durability: playerInventory.durability,
        id: playerInventory.id,
        itemId: playerInventory.itemId,
        itemType: playerInventory.itemType,
      })
      .from(playerInventory)
      .where(and(eq(playerInventory.playerId, playerId), or(eq(playerInventory.itemType, 'weapon'), eq(playerInventory.itemType, 'vest'))));

    let repairedCount = 0;
    for (const row of rows) {
      if (!row.itemId || (row.itemType !== 'weapon' && row.itemType !== 'vest')) {
        continue;
      }
      const definition = await this.repository.getInventoryDefinition(row.itemType, row.itemId);
      if (!definition || definition.durabilityMax === null) {
        continue;
      }
      if ((row.durability ?? definition.durabilityMax) >= definition.durabilityMax) {
        continue;
      }
      await db
        .update(playerInventory)
        .set({
          durability: definition.durabilityMax,
        })
        .where(eq(playerInventory.id, row.id));
      repairedCount += 1;
    }

    return repairedCount;
  }

  private async repairAllPreview(playerId: string): Promise<number> {
    const rows = await db
      .select({
        durability: playerInventory.durability,
        id: playerInventory.id,
        itemId: playerInventory.itemId,
        itemType: playerInventory.itemType,
      })
      .from(playerInventory)
      .where(and(eq(playerInventory.playerId, playerId), or(eq(playerInventory.itemType, 'weapon'), eq(playerInventory.itemType, 'vest'))));

    let repairedCount = 0;
    for (const row of rows) {
      if (!row.itemId || (row.itemType !== 'weapon' && row.itemType !== 'vest')) {
        continue;
      }
      const definition = await this.repository.getInventoryDefinition(row.itemType, row.itemId);
      if (!definition || definition.durabilityMax === null) {
        continue;
      }
      if ((row.durability ?? definition.durabilityMax) >= definition.durabilityMax) {
        continue;
      }
      repairedCount += 1;
    }

    return repairedCount;
  }

  private async resolveInventoryTargets(
    playerId: string,
    reference: InventorySpec | { inventoryItemId: string },
  ): Promise<Array<{ id: string; itemType: InventoryItemType }>> {
    if ('inventoryItemId' in reference) {
      const [entry] = await db
        .select({
          id: playerInventory.id,
          itemType: playerInventory.itemType,
        })
        .from(playerInventory)
        .where(and(eq(playerInventory.id, reference.inventoryItemId), eq(playerInventory.playerId, playerId)))
        .limit(1);
      return entry ? [entry] : [];
    }

    const definition = await resolveInventoryDefinitionByCodeOrId(reference.itemType, reference.identifier);
    if (!definition) {
      return [];
    }

    return db
      .select({
        id: playerInventory.id,
        itemType: playerInventory.itemType,
      })
      .from(playerInventory)
      .where(
        and(
          eq(playerInventory.playerId, playerId),
          eq(playerInventory.itemType, reference.itemType),
          eq(playerInventory.itemId, definition.id),
        ),
      );
  }

  private async snapshotPlayer(playerId: string): Promise<PlayerOpsSnapshot> {
    const player = await this.requirePlayerById(playerId);
    const [inventory, prison, hospital] = await Promise.all([
      readInventorySnapshot(playerId),
      this.prisonSystem.getStatus(playerId),
      this.overdoseSystem.getHospitalizationStatus(playerId),
    ]);

    return {
      addiction: player.addiction,
      bankMoney: Number.parseFloat(player.bankMoney),
      characterReady: Boolean(player.characterCreatedAt),
      conceito: player.conceito,
      email: player.email,
      factionId: player.factionId,
      hospital: {
        endsAt: hospital.endsAt,
        isHospitalized: hospital.isHospitalized,
        reason: hospital.reason,
        remainingSeconds: hospital.remainingSeconds,
      },
      hp: player.hp,
      inventory,
      level: player.level,
      money: Number.parseFloat(player.money),
      brisa: player.brisa,
      disposicao: player.disposicao,
      nickname: player.nickname,
      position: {
        regionId: player.regionId,
        x: player.positionX,
        y: player.positionY,
      },
      prison: {
        endsAt: prison.endsAt,
        heatScore: prison.heatScore,
        heatTier: prison.heatTier,
        isImprisoned: prison.isImprisoned,
        reason: prison.reason,
        remainingSeconds: prison.remainingSeconds,
      },
      cansaco: player.cansaco,
      vocation: player.vocation,
      wealth: {
        bankMoney: Number.parseFloat(player.bankMoney),
        money: Number.parseFloat(player.money),
      },
    };
  }

  private async resolvePlayer(selector: PlayerOpsSelector): Promise<PlayerOpsPlayerRecord> {
    const filters = [];

    if (selector.playerId) {
      filters.push(eq(players.id, selector.playerId));
    }

    if (selector.nickname) {
      filters.push(eq(players.nickname, selector.nickname));
    }

    if (selector.email) {
      filters.push(eq(players.email, selector.email));
    }

    if (selector.player) {
      if (selector.player.includes('@')) {
        filters.push(eq(players.email, selector.player));
      } else if (isUuidLike(selector.player)) {
        filters.push(eq(players.id, selector.player));
      } else {
        filters.push(eq(players.nickname, selector.player));
      }
    }

    if (filters.length === 0) {
      throw new PlayerOpsError('Informe --player, --player-id, --nickname ou --email.');
    }

    const [player] = await db
      .select({
        addiction: players.addiction,
        bankMoney: players.bankMoney,
        characterCreatedAt: players.characterCreatedAt,
        conceito: players.conceito,
        email: players.email,
        factionId: players.factionId,
        hp: players.hp,
        id: players.id,
        level: players.level,
        money: players.money,
        brisa: players.brisa,
        disposicao: players.disposicao,
        nickname: players.nickname,
        positionX: players.positionX,
        positionY: players.positionY,
        regionId: players.regionId,
        cansaco: players.cansaco,
        vocation: players.vocation,
      })
      .from(players)
      .where(or(...filters))
      .limit(1);

    if (!player) {
      throw new PlayerOpsError('Jogador não encontrado para o seletor informado.');
    }

    return {
      ...player,
      regionId: player.regionId as RegionId,
      vocation: player.vocation as VocationType,
    };
  }

  private async requirePlayerById(playerId: string): Promise<PlayerOpsPlayerRecord> {
    return this.resolvePlayer({ playerId });
  }

  private async invalidatePlayerCache(playerId: string): Promise<void> {
    await invalidatePlayerProfileCache(this.keyValueStore, playerId);
  }

  private async updatePlayer(
    playerId: string,
    values: Partial<{
      addiction: number;
      bankMoney: string;
      conceito: number;
      hp: number;
      level: number;
      money: string;
      brisa: number;
      disposicao: number;
      positionX: number;
      positionY: number;
      regionId: RegionId;
      cansaco: number;
      vocation: VocationType;
    }>,
  ): Promise<void> {
    await db.update(players).set(values).where(eq(players.id, playerId));
  }
}

async function resolveInventoryDefinitionByCodeOrId(
  itemType: SupportedInventoryItemType,
  codeOrId: string,
): Promise<{ code: string; id: string } | null> {
  const matchesUuid = isUuid(codeOrId);

  if (itemType === 'weapon') {
    const [row] = await db
      .select({ code: weapons.code, id: weapons.id })
      .from(weapons)
      .where(matchesUuid ? or(eq(weapons.code, codeOrId), eq(weapons.id, codeOrId)) : eq(weapons.code, codeOrId))
      .limit(1);
    return row ?? null;
  }

  if (itemType === 'vest') {
    const [row] = await db
      .select({ code: vests.code, id: vests.id })
      .from(vests)
      .where(matchesUuid ? or(eq(vests.code, codeOrId), eq(vests.id, codeOrId)) : eq(vests.code, codeOrId))
      .limit(1);
    return row ?? null;
  }

  if (itemType === 'drug') {
    const [row] = await db
      .select({ code: drugs.code, id: drugs.id })
      .from(drugs)
      .where(matchesUuid ? or(eq(drugs.code, codeOrId), eq(drugs.id, codeOrId)) : eq(drugs.code, codeOrId))
      .limit(1);
    return row ?? null;
  }

  const [row] = await db
    .select({ code: components.code, id: components.id })
    .from(components)
    .where(matchesUuid ? or(eq(components.code, codeOrId), eq(components.id, codeOrId)) : eq(components.code, codeOrId))
    .limit(1);
  return row ?? null;
}

function previewStat(
  player: PlayerOpsPlayerRecord,
  operation:
    | { type: 'set-addiction'; value: number }
    | { type: 'set-hp'; value: number }
    | { type: 'set-brisa'; value: number }
    | { type: 'set-disposicao'; value: number }
    | { type: 'set-cansaco'; value: number },
  key: 'addiction' | 'hp' | 'brisa' | 'disposicao' | 'cansaco',
  label: string,
): { changed: boolean; operationType: PlayerOpsOperation['type']; summary: string } {
  const nextValue = clampStat(operation.value, 0, 100, operation.type);
  const changed = player[key] !== nextValue;
  player[key] = nextValue;
  return {
    changed,
    operationType: operation.type,
    summary: changed ? `Dry-run: ${label} iria para ${nextValue}.` : `${label} já está em ${nextValue}.`,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function readInventorySnapshot(playerId: string): Promise<InventorySnapshotItem[]> {
  const rows = await db
    .select({
      code: weapons.code,
      durability: playerInventory.durability,
      equippedSlot: playerInventory.equippedSlot,
      id: playerInventory.id,
      itemId: playerInventory.itemId,
      itemType: playerInventory.itemType,
      quantity: playerInventory.quantity,
      vestCode: vests.code,
    })
    .from(playerInventory)
    .leftJoin(weapons, and(eq(playerInventory.itemType, 'weapon'), eq(playerInventory.itemId, weapons.id)))
    .leftJoin(vests, and(eq(playerInventory.itemType, 'vest'), eq(playerInventory.itemId, vests.id)))
    .where(eq(playerInventory.playerId, playerId));

  const drugRows = await db
    .select({
      code: drugs.code,
      id: drugs.id,
    })
    .from(drugs);
  const componentRows = await db
    .select({
      code: components.code,
      id: components.id,
    })
    .from(components);

  const extraCodeMap = new Map<string, string>();
  for (const row of drugRows) extraCodeMap.set(`drug:${row.id}`, row.code);
  for (const row of componentRows) extraCodeMap.set(`component:${row.id}`, row.code);

  return rows.map((row) => ({
    code:
      row.itemType === 'weapon'
        ? row.code
        : row.itemType === 'vest'
          ? row.vestCode
          : row.itemId
            ? extraCodeMap.get(`${row.itemType}:${row.itemId}`) ?? null
            : null,
    durability: row.durability,
    equippedSlot: row.equippedSlot,
    id: row.id,
    itemType: row.itemType,
    quantity: row.quantity,
  }));
}

function clampMoney(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function toMoneyString(value: number): string {
  return clampMoney(value).toFixed(2);
}

function requireNonNegative(value: number, operationType: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new PlayerOpsError(`${operationType} exige número maior ou igual a zero.`);
  }

  return value;
}

function requireWholeNumber(value: number, operationType: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new PlayerOpsError(`${operationType} exige inteiro maior ou igual a zero.`);
  }

  return value;
}

function clampStat(value: number, min: number, max: number, operationType: string): number {
  if (!Number.isFinite(value)) {
    throw new PlayerOpsError(`${operationType} exige número válido.`);
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatMoney(value: number): string {
  return clampMoney(value).toFixed(2);
}

function formatSignedMoney(value: number): string {
  const formatted = formatMoney(Math.abs(value));
  return value >= 0 ? `+R$ ${formatted}` : `-R$ ${formatted}`;
}

function exhaustiveGuard(value: never): never {
  throw new PlayerOpsError(`Operação de player não suportada: ${JSON.stringify(value)}`);
}
