import {
  PLAYER_CONTACT_LIMITS,
  normalizeAuthNickname,
  type PlayerContactCreateInput,
  type PlayerContactFactionSyncResult,
  type PlayerContactMutationResponse,
  type PlayerContactRemovalResponse,
  type PlayerContactsResponse,
} from '@cs-rio/shared';

import { resolveLevelTitle } from './auth.js';
import { DatabaseContactRepository } from './contact/repository.js';
import {
  ContactError,
  type ContactOwnerRecord,
  type ContactRepository,
  type ContactServiceOptions,
  type ContactSummaryRecord,
  type FactionContactSyncContract,
} from './contact/types.js';

export { DatabaseContactRepository } from './contact/repository.js';
export { ContactError } from './contact/types.js';
export type {
  ContactCandidateRecord,
  ContactOwnerRecord,
  ContactRepository,
  ContactSaveInput,
  ContactServiceOptions,
  ContactSummaryRecord,
  FactionContactSyncContract,
} from './contact/types.js';

export class ContactService implements FactionContactSyncContract {
  private readonly now: () => Date;

  private readonly repository: ContactRepository;

  constructor(options: ContactServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseContactRepository();
  }

  async listContacts(playerId: string): Promise<PlayerContactsResponse> {
    const owner = await this.getReadyOwner(playerId);
    const contacts = await this.repository.listContacts(owner.id);
    return buildContactsResponse(contacts);
  }

  async addContact(
    playerId: string,
    input: PlayerContactCreateInput,
  ): Promise<PlayerContactMutationResponse> {
    const owner = await this.getReadyOwner(playerId);
    const nickname = normalizeAuthNickname(input.nickname);
    const candidate = await this.repository.findContactCandidateByNickname(nickname);

    if (!candidate) {
      throw new ContactError('not_found', 'Jogador alvo nao encontrado.');
    }

    if (!candidate.characterCreatedAt) {
      throw new ContactError('conflict', 'O jogador alvo ainda nao criou personagem.');
    }

    if (candidate.id === owner.id) {
      throw new ContactError('validation', 'Voce nao pode adicionar a si mesmo aos contatos.');
    }

    const contacts = await this.repository.listContacts(owner.id);
    const existing = contacts.find((contact) => contact.contactId === candidate.id) ?? null;

    if (input.type === 'partner') {
      if (!owner.factionId) {
        throw new ContactError('conflict', 'Voce precisa estar em uma faccao para registrar parceiros.');
      }

      if (!candidate.factionId || candidate.factionId !== owner.factionId) {
        throw new ContactError(
          'conflict',
          'Parceiros precisam estar na mesma faccao que voce no momento do vinculo.',
        );
      }
    }

    const existingType = existing?.type ?? null;

    if (existingType === input.type) {
      if (!existing) {
        throw new ContactError('not_found', 'Falha ao recarregar o contato existente.');
      }

      return {
        contact: serializeContact(existing),
        contacts: serializeContacts(contacts),
        limits: buildContactLimitSummary(contacts),
        message:
          input.type === 'partner'
            ? 'Este parceiro ja estava registrado na sua rede.'
            : 'Este contato ja estava registrado na sua lista.',
      };
    }

    if (existingType === 'partner' && input.type === 'known') {
      if (!existing) {
        throw new ContactError('not_found', 'Falha ao recarregar o parceiro existente.');
      }

      return {
        contact: serializeContact(existing),
        contacts: serializeContacts(contacts),
        limits: buildContactLimitSummary(contacts),
        message: 'O contato ja esta registrado como parceiro da sua rede.',
      };
    }

    enforceContactLimits(contacts, input.type, existingType);

    await this.repository.saveContact({
      contactId: candidate.id,
      playerId: owner.id,
      since: existing?.since ?? this.now(),
      type: input.type,
    });

    const nextContacts = await this.repository.listContacts(owner.id);
    const contact = nextContacts.find((entry) => entry.contactId === candidate.id);

    if (!contact) {
      throw new ContactError('not_found', 'Falha ao atualizar a lista de contatos.');
    }

    return {
      contact: serializeContact(contact),
      contacts: serializeContacts(nextContacts),
      limits: buildContactLimitSummary(nextContacts),
      message:
        input.type === 'partner'
          ? 'Parceiro vinculado com sucesso na sua rede.'
          : 'Contato adicionado com sucesso na sua lista.',
    };
  }

  async removeContact(
    playerId: string,
    contactId: string,
  ): Promise<PlayerContactRemovalResponse> {
    const owner = await this.getReadyOwner(playerId);
    const contacts = await this.repository.listContacts(owner.id);
    const existing = contacts.find((contact) => contact.contactId === contactId);

    if (!existing) {
      throw new ContactError('not_found', 'Contato nao encontrado na sua lista.');
    }

    const removed = await this.repository.removeContact(owner.id, contactId);

    if (!removed) {
      throw new ContactError('not_found', 'Contato nao encontrado na sua lista.');
    }

    const nextContacts = await this.repository.listContacts(owner.id);

    return {
      contacts: serializeContacts(nextContacts),
      limits: buildContactLimitSummary(nextContacts),
      message:
        existing.type === 'partner'
          ? 'Parceiro removido da sua rede.'
          : 'Contato removido da sua lista.',
      removedContactId: existing.contactId,
      removedType: existing.type,
    };
  }

  async syncContactsAfterFactionChange(
    playerId: string,
    nextFactionId: string | null,
  ): Promise<PlayerContactFactionSyncResult> {
    const removedContactIds = await this.repository.removePartnerContactsOutsideFaction(playerId, nextFactionId);

    return {
      nextFactionId,
      playerId,
      removedContactIds,
      removedPartners: removedContactIds.length,
    };
  }

  private async getReadyOwner(playerId: string): Promise<ContactOwnerRecord> {
    const owner = await this.repository.getOwner(playerId);

    if (!owner) {
      throw new ContactError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!owner.characterCreatedAt) {
      throw new ContactError('conflict', 'Crie seu personagem antes de mexer nos contatos.');
    }

    return owner;
  }
}

export class NoopFactionContactSync implements FactionContactSyncContract {
  async syncContactsAfterFactionChange(
    playerId: string,
    nextFactionId: string | null,
  ): Promise<PlayerContactFactionSyncResult> {
    return {
      nextFactionId,
      playerId,
      removedContactIds: [],
      removedPartners: 0,
    };
  }
}

function buildContactLimitSummary(contacts: ContactSummaryRecord[]): PlayerContactsResponse['limits'] {
  const partnerUsed = contacts.filter((contact) => contact.type === 'partner').length;
  const knownUsed = contacts.filter((contact) => contact.type === 'known').length;

  return {
    known: {
      max: PLAYER_CONTACT_LIMITS.known,
      remaining: Math.max(0, PLAYER_CONTACT_LIMITS.known - knownUsed),
      used: knownUsed,
    },
    partner: {
      max: PLAYER_CONTACT_LIMITS.partner,
      remaining: Math.max(0, PLAYER_CONTACT_LIMITS.partner - partnerUsed),
      used: partnerUsed,
    },
  };
}

function buildContactsResponse(contacts: ContactSummaryRecord[]): PlayerContactsResponse {
  return {
    contacts: serializeContacts(contacts),
    limits: buildContactLimitSummary(contacts),
  };
}

function enforceContactLimits(
  contacts: ContactSummaryRecord[],
  nextType: PlayerContactCreateInput['type'],
  previousType: ContactSummaryRecord['type'] | null,
): void {
  const limits = buildContactLimitSummary(contacts);

  if (nextType === 'known' && previousType !== 'known' && limits.known.remaining < 1) {
    throw new ContactError('conflict', 'Sua lista de conhecidos ja atingiu o limite desta rodada.');
  }

  if (nextType === 'partner' && previousType !== 'partner' && limits.partner.remaining < 1) {
    throw new ContactError('conflict', 'Sua rede de parceiros ja atingiu o limite desta rodada.');
  }
}

function serializeContact(contact: ContactSummaryRecord) {
  return {
    contactId: contact.contactId,
    faction: contact.faction,
    level: contact.level,
    nickname: contact.nickname,
    origin: contact.origin,
    since: contact.since.toISOString(),
    title: resolveLevelTitle(contact.level),
    type: contact.type,
    vocation: contact.vocation,
  };
}

function serializeContacts(contacts: ContactSummaryRecord[]) {
  return [...contacts]
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'partner' ? -1 : 1;
      }

      return left.nickname.localeCompare(right.nickname, 'pt-BR');
    })
    .map((contact) => serializeContact(contact));
}
