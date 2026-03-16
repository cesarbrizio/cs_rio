import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PRIVATE_MESSAGE_MAX_LENGTH,
  type PlayerFactionSummary,
  VocationType,
} from '@cs-rio/shared';

import { installGlobalHttpErrorHandler } from '../src/api/http-errors.js';
import { createPrivateMessageRoutes } from '../src/api/routes/private-messages.js';
import {
  PrivateMessageService,
  type ContactOwnerRecord,
  type ContactRepository,
  type ContactSummaryRecord,
  type PrivateMessageInsertInput,
  type PrivateMessageInsertResult,
  type PrivateMessageRecord,
  type PrivateMessageRepository,
} from '../src/services/private-message.js';

interface ContactRecord {
  contactId: string;
  playerId: string;
  since: Date;
  type: 'known' | 'partner';
}

interface PlayerSeed extends ContactOwnerRecord {
  level: number;
  vocation: VocationType;
}

const FACTION_SUMMARIES: Record<string, PlayerFactionSummary> = {
  faccao_a: {
    abbreviation: 'FA',
    id: 'faccao_a',
    name: 'Faccao A',
    rank: 'cria',
  },
};

const FIXED_NOW = new Date('2026-03-16T16:00:00.000Z');

class InMemoryContactRepository implements ContactRepository {
  private readonly contacts = new Map<string, ContactRecord>();

  private readonly players = new Map<string, PlayerSeed>();

  seedPlayer(player: PlayerSeed): void {
    this.players.set(player.id, { ...player });
  }

  seedContact(contact: ContactRecord): void {
    this.contacts.set(this.resolveKey(contact.playerId, contact.contactId), { ...contact });
  }

  async findContactCandidateByNickname(): Promise<never> {
    throw new Error('Nao usado neste teste.');
  }

  async getOwner(playerId: string): Promise<ContactOwnerRecord | null> {
    const player = this.players.get(playerId) ?? null;

    return player
      ? {
          characterCreatedAt: player.characterCreatedAt,
          factionId: player.factionId,
          id: player.id,
          nickname: player.nickname,
        }
      : null;
  }

  async listContacts(playerId: string): Promise<ContactSummaryRecord[]> {
    return [...this.contacts.values()]
      .filter((entry) => entry.playerId === playerId)
      .map((entry) => {
        const player = this.players.get(entry.contactId);

        if (!player) {
          throw new Error(`Contato ${entry.contactId} nao encontrado.`);
        }

        return {
          contactId: entry.contactId,
          faction: player.factionId ? FACTION_SUMMARIES[player.factionId] ?? null : null,
          level: player.level,
          nickname: player.nickname,
          origin: entry.type === 'partner' ? 'same_faction' : 'manual',
          since: entry.since,
          type: entry.type,
          vocation: player.vocation,
        } satisfies ContactSummaryRecord;
      });
  }

  async removeContact(): Promise<boolean> {
    throw new Error('Nao usado neste teste.');
  }

  async removePartnerContactsOutsideFaction(): Promise<string[]> {
    throw new Error('Nao usado neste teste.');
  }

  async saveContact(): Promise<void> {
    throw new Error('Nao usado neste teste.');
  }

  private resolveKey(playerId: string, contactId: string): string {
    return `${playerId}:${contactId}`;
  }
}

interface MessageRecord extends PrivateMessageRecord {
  channelId: string;
}

class InMemoryPrivateMessageRepository implements PrivateMessageRepository {
  private readonly messages: MessageRecord[] = [];

  async insertMessage(input: PrivateMessageInsertInput): Promise<PrivateMessageInsertResult> {
    const nextMessage: MessageRecord = {
      channelId: input.channelId,
      id: `msg-${this.messages.length + 1}`,
      message: input.message,
      senderId: input.senderId,
      senderNickname: input.senderId,
      sentAt: input.sentAt,
    };

    this.messages.push(nextMessage);

    return {
      id: nextMessage.id,
      message: nextMessage.message,
      senderId: nextMessage.senderId,
      sentAt: nextMessage.sentAt,
    };
  }

  async listMessages(channelId: string, limit: number): Promise<PrivateMessageRecord[]> {
    return this.messages
      .filter((entry) => entry.channelId === channelId)
      .sort((left, right) => right.sentAt.getTime() - left.sentAt.getTime())
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id,
        message: entry.message,
        senderId: entry.senderId,
        senderNickname: entry.senderNickname,
        sentAt: entry.sentAt,
      }));
  }

  async listThreadSummaries(channelIds: string[]) {
    return channelIds
      .map((channelId) => {
        const entries = this.messages
          .filter((entry) => entry.channelId === channelId)
          .sort((left, right) => right.sentAt.getTime() - left.sentAt.getTime());

        if (entries.length === 0) {
          return null;
        }

        return {
          channelId,
          lastMessage: {
            id: entries[0].id,
            message: entries[0].message,
            senderId: entries[0].senderId,
            senderNickname: entries[0].senderNickname,
            sentAt: entries[0].sentAt,
          },
          messageCount: entries.length,
          updatedAt: entries[0].sentAt,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }

  seedMessage(entry: MessageRecord): void {
    this.messages.push(entry);
  }
}

describe('private message routes', () => {
  let app: FastifyInstance;
  let contactRepository: InMemoryContactRepository;
  let messageRepository: InMemoryPrivateMessageRepository;

  beforeEach(async () => {
    contactRepository = new InMemoryContactRepository();
    messageRepository = new InMemoryPrivateMessageRepository();
    const privateMessageService = new PrivateMessageService({
      contactRepository,
      now: () => FIXED_NOW,
      repository: messageRepository,
    });

    app = Fastify();
    app.decorateRequest('playerId', undefined);
    app.addHook('preHandler', async (request) => {
      const playerId = request.headers['x-player-id'];

      if (typeof playerId === 'string') {
        request.playerId = playerId;
      }
    });
    installGlobalHttpErrorHandler(app);
    await app.register(createPrivateMessageRoutes({ privateMessageService }), {
      prefix: '/api',
    });

    contactRepository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: 'faccao_a',
      id: 'owner',
      level: 6,
      nickname: 'Owner_01',
      vocation: VocationType.Gerente,
    });
    contactRepository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: 'faccao_a',
      id: 'partner_01',
      level: 7,
      nickname: 'Partner_01',
      vocation: VocationType.Soldado,
    });
    contactRepository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: null,
      id: 'known_01',
      level: 4,
      nickname: 'Known_01',
      vocation: VocationType.Cria,
    });
    contactRepository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: null,
      id: 'outsider_01',
      level: 3,
      nickname: 'Outsider_01',
      vocation: VocationType.Cria,
    });

    contactRepository.seedContact({
      contactId: 'partner_01',
      playerId: 'owner',
      since: new Date('2026-03-14T10:00:00.000Z'),
      type: 'partner',
    });
    contactRepository.seedContact({
      contactId: 'known_01',
      playerId: 'owner',
      since: new Date('2026-03-15T10:00:00.000Z'),
      type: 'known',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires auth context for private message routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/private-messages/threads',
    });

    expect(response.statusCode).toBe(401);
  });

  it('lists thread feed for the player contacts', async () => {
    messageRepository.seedMessage({
      channelId: 'owner:partner_01',
      id: 'msg-1',
      message: 'Chega no morro hoje.',
      senderId: 'partner_01',
      senderNickname: 'Partner_01',
      sentAt: new Date('2026-03-16T15:30:00.000Z'),
    });

    const response = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'GET',
      url: '/api/private-messages/threads',
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();

    expect(payload.threads).toHaveLength(2);
    expect(payload.threads[0]).toMatchObject({
      contact: {
        contactId: 'partner_01',
        nickname: 'Partner_01',
      },
      messageCount: 1,
      threadId: 'owner:partner_01',
    });
    expect(payload.threads[0].lastMessage).toMatchObject({
      id: 'msg-1',
      senderId: 'partner_01',
    });
    expect(payload.threads[1]).toMatchObject({
      contact: {
        contactId: 'known_01',
        nickname: 'Known_01',
      },
      lastMessage: null,
      messageCount: 0,
    });
  });

  it('returns the selected thread and appends a normalized sent message', async () => {
    const sendResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'POST',
      payload: {
        message: '   cola   na   pista   ',
      },
      url: '/api/private-messages/threads/known_01',
    });

    expect(sendResponse.statusCode).toBe(200);
    expect(sendResponse.json()).toMatchObject({
      message: 'Mensagem privada enviada para a sua rede.',
      sentMessage: {
        message: 'cola na pista',
        senderId: 'owner',
        senderNickname: 'Owner_01',
      },
      threadId: 'known_01:owner',
    });

    const threadResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'GET',
      url: '/api/private-messages/threads/known_01',
    });

    expect(threadResponse.statusCode).toBe(200);
    expect(threadResponse.json().messages).toEqual([
      expect.objectContaining({
        message: 'cola na pista',
        senderId: 'owner',
      }),
    ]);
  });

  it('rejects sending private messages outside the contact network', async () => {
    const response = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'POST',
      payload: {
        message: 'ta por ai?',
      },
      url: '/api/private-messages/threads/outsider_01',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'Voce so pode trocar mensagem privada com contatos ativos da sua rede.',
    });
  });

  it('validates message length on send', async () => {
    const response = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'POST',
      payload: {
        message: 'x'.repeat(PRIVATE_MESSAGE_MAX_LENGTH + 1),
      },
      url: '/api/private-messages/threads/known_01',
    });

    expect(response.statusCode).toBe(400);
  });
});
