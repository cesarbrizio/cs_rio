import type {
  FactionBankDepositInput,
  FactionBankResponse,
  FactionBankWithdrawInput,
} from '@cs-rio/shared';

import {
  buildFactionBankLedgerEntries,
  canDepositToFactionBank,
  canViewFactionBank,
  canWithdrawFromFactionBank,
  normalizeFactionBankDescription,
  validateFactionBankAmount,
} from './faction/repository.js';
import {
  FactionError,
  type FactionMembershipSnapshot,
  type FactionPlayerRecord,
  type FactionRepository,
} from './faction/types.js';

export interface FactionBankSnapshotReader {
  (playerId: string, factionId: string): Promise<FactionMembershipSnapshot>;
}

export interface FactionBankReadyPlayerReader {
  (playerId: string): Promise<FactionPlayerRecord>;
}

export interface FactionBankProfileInvalidator {
  (playerIds: string[]): Promise<void>;
}

export interface FactionBankServiceOptions {
  getFactionSnapshot: FactionBankSnapshotReader;
  getReadyPlayer: FactionBankReadyPlayerReader;
  invalidatePlayerProfiles: FactionBankProfileInvalidator;
  now: () => Date;
  repository: FactionRepository;
}

export class FactionBankService {
  constructor(private readonly options: FactionBankServiceOptions) {}

  async depositToFactionBank(
    playerId: string,
    factionId: string,
    input: FactionBankDepositInput,
  ): Promise<FactionBankResponse> {
    const player = await this.options.getReadyPlayer(playerId);
    const snapshot = await this.options.getFactionSnapshot(playerId, factionId);

    if (!canDepositToFactionBank(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao pode depositar no banco da faccao.');
    }

    const amount = validateFactionBankAmount(input.amount);

    if (player.money < amount) {
      throw new FactionError('insufficient_funds', 'Dinheiro em maos insuficiente para realizar o deposito.');
    }

    const deposited = await this.options.repository.depositToFactionBank(playerId, factionId, {
      amount,
      description: normalizeFactionBankDescription(input.description, `Deposito manual de ${player.nickname}.`),
      now: this.options.now(),
    });

    if (!deposited) {
      throw new FactionError('not_found', 'Faccao ou jogador nao encontrados para concluir o deposito.');
    }

    await this.options.invalidatePlayerProfiles([playerId]);

    return this.getFactionBank(playerId, factionId);
  }

  async getFactionBank(playerId: string, factionId: string): Promise<FactionBankResponse> {
    await this.options.getReadyPlayer(playerId);
    const snapshot = await this.options.getFactionSnapshot(playerId, factionId);

    if (!canViewFactionBank(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao pode acessar o banco da faccao.');
    }

    return {
      faction: snapshot.faction,
      ledger: buildFactionBankLedgerEntries(
        await this.options.repository.listFactionBankLedger(factionId, 50),
      ),
      permissions: {
        canDeposit: canDepositToFactionBank(snapshot.actor.rank),
        canView: true,
        canWithdraw: canWithdrawFromFactionBank(snapshot.actor.rank),
      },
      playerFactionId: snapshot.faction.id,
    };
  }

  async withdrawFromFactionBank(
    playerId: string,
    factionId: string,
    input: FactionBankWithdrawInput,
  ): Promise<FactionBankResponse> {
    const player = await this.options.getReadyPlayer(playerId);
    const snapshot = await this.options.getFactionSnapshot(playerId, factionId);

    if (!canWithdrawFromFactionBank(snapshot.actor.rank)) {
      throw new FactionError('forbidden', 'Seu cargo nao pode sacar do banco da faccao.');
    }

    const amount = validateFactionBankAmount(input.amount);

    if (snapshot.faction.bankMoney < amount) {
      throw new FactionError('insufficient_funds', 'Saldo insuficiente no banco da faccao.');
    }

    const withdrawn = await this.options.repository.withdrawFromFactionBank(playerId, factionId, {
      amount,
      description: normalizeFactionBankDescription(input.description, `Saque autorizado por ${player.nickname}.`),
      now: this.options.now(),
    });

    if (!withdrawn) {
      throw new FactionError('not_found', 'Faccao ou jogador nao encontrados para concluir o saque.');
    }

    await this.options.invalidatePlayerProfiles([playerId]);

    return this.getFactionBank(playerId, factionId);
  }
}
