import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type PlayerFactionSummary, VocationType } from '@cs-rio/shared';

import { installGlobalHttpErrorHandler } from '../src/api/http-errors.js';
import { createContactRoutes } from '../src/api/routes/contacts.js';
import {
  ContactService,
  type ContactCandidateRecord,
  type ContactOwnerRecord,
  type ContactRepository,
  type ContactSaveInput,
  type ContactSummaryRecord,
} from '../src/services/contact.js';

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
  faccao_b: {
    abbreviation: 'FB',
    id: 'faccao_b',
    name: 'Faccao B',
    rank: 'cria',
  },
};

const FIXED_NOW = new Date('2026-03-16T14:00:00.000Z');

class InMemoryContactRepository implements ContactRepository {
  private readonly contacts = new Map<string, ContactRecord>();

  private readonly players = new Map<string, PlayerSeed>();

  seedPlayer(player: PlayerSeed): void {
    this.players.set(player.id, {
      ...player,
    });
  }

  seedContact(contact: ContactRecord): void {
    this.contacts.set(this.resolveKey(contact.playerId, contact.contactId), {
      ...contact,
    });
  }

  setFaction(playerId: string, factionId: string | null): void {
    const player = this.players.get(playerId);

    if (!player) {
      return;
    }

    player.factionId = factionId;
  }

  async findContactCandidateByNickname(nickname: string): Promise<ContactCandidateRecord | null> {
    const player = [...this.players.values()].find((entry) => entry.nickname === nickname) ?? null;

    return player
      ? {
          characterCreatedAt: player.characterCreatedAt,
          factionId: player.factionId,
          id: player.id,
          level: player.level,
          nickname: player.nickname,
          vocation: player.vocation,
        }
      : null;
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
    const entries = [...this.contacts.values()].filter((entry) => entry.playerId === playerId);

    return entries
      .map((entry) => {
        const player = this.players.get(entry.contactId);

        if (!player) {
          return null;
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
      })
      .filter((entry): entry is ContactSummaryRecord => entry !== null);
  }

  async removeContact(playerId: string, contactId: string): Promise<boolean> {
    return this.contacts.delete(this.resolveKey(playerId, contactId));
  }

  async removePartnerContactsOutsideFaction(
    playerId: string,
    nextFactionId: string | null,
  ): Promise<string[]> {
    const removed: string[] = [];

    for (const entry of [...this.contacts.values()]) {
      if (entry.playerId !== playerId || entry.type !== 'partner') {
        continue;
      }

      const player = this.players.get(entry.contactId);
      const contactFactionId = player?.factionId ?? null;

      if (contactFactionId === nextFactionId) {
        continue;
      }

      this.contacts.delete(this.resolveKey(playerId, entry.contactId));
      removed.push(entry.contactId);
    }

    return removed;
  }

  async saveContact(input: ContactSaveInput): Promise<void> {
    const existing = this.contacts.get(this.resolveKey(input.playerId, input.contactId));

    this.contacts.set(this.resolveKey(input.playerId, input.contactId), {
      contactId: input.contactId,
      playerId: input.playerId,
      since: existing?.since ?? input.since,
      type: input.type,
    });
  }

  private resolveKey(playerId: string, contactId: string): string {
    return `${playerId}:${contactId}`;
  }
}

describe('contact routes', () => {
  let app: FastifyInstance;
  let contactService: ContactService;
  let repository: InMemoryContactRepository;

  beforeEach(async () => {
    repository = new InMemoryContactRepository();
    contactService = new ContactService({
      now: () => FIXED_NOW,
      repository,
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
    await app.register(createContactRoutes({ contactService }), {
      prefix: '/api',
    });

    repository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: 'faccao_a',
      id: 'owner',
      level: 6,
      nickname: 'Owner_01',
      vocation: VocationType.Gerente,
    });
    repository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: null,
      id: 'known_01',
      level: 4,
      nickname: 'Known_01',
      vocation: VocationType.Cria,
    });
    repository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: 'faccao_a',
      id: 'partner_01',
      level: 7,
      nickname: 'Partner_01',
      vocation: VocationType.Soldado,
    });
    repository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: 'faccao_b',
      id: 'rival_01',
      level: 7,
      nickname: 'Rival_01',
      vocation: VocationType.Soldado,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires player auth context for contact routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/contacts',
    });

    expect(response.statusCode).toBe(401);
  });

  it('adds known and partner contacts and exposes limits in the roster', async () => {
    const knownResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'POST',
      payload: {
        nickname: 'Known_01',
        type: 'known',
      },
      url: '/api/contacts',
    });

    expect(knownResponse.statusCode).toBe(200);
    expect(knownResponse.json()).toMatchObject({
      contact: {
        contactId: 'known_01',
        nickname: 'Known_01',
        origin: 'manual',
        title: 'vapor',
        type: 'known',
      },
      limits: {
        known: {
          remaining: 99,
          used: 1,
        },
        partner: {
          remaining: 20,
          used: 0,
        },
      },
    });

    const partnerResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'POST',
      payload: {
        nickname: 'Partner_01',
        type: 'partner',
      },
      url: '/api/contacts',
    });

    expect(partnerResponse.statusCode).toBe(200);
    expect(partnerResponse.json()).toMatchObject({
      contact: {
        contactId: 'partner_01',
        faction: {
          abbreviation: 'FA',
          id: 'faccao_a',
        },
        nickname: 'Partner_01',
        origin: 'same_faction',
        title: 'frente',
        type: 'partner',
      },
      limits: {
        known: {
          remaining: 99,
          used: 1,
        },
        partner: {
          remaining: 19,
          used: 1,
        },
      },
    });

    const rosterResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'GET',
      url: '/api/contacts',
    });

    expect(rosterResponse.statusCode).toBe(200);
    expect(rosterResponse.json().contacts.map((entry: { nickname: string }) => entry.nickname)).toEqual([
      'Partner_01',
      'Known_01',
    ]);
  });

  it('rejects partner links outside the current faction and enforces partner cap', async () => {
    const rivalResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'POST',
      payload: {
        nickname: 'Rival_01',
        type: 'partner',
      },
      url: '/api/contacts',
    });

    expect(rivalResponse.statusCode).toBe(409);
    expect(rivalResponse.json()).toMatchObject({
      category: 'domain',
      message: 'Parceiros precisam estar na mesma faccao que voce no momento do vinculo.',
    });

    for (let index = 0; index < 20; index += 1) {
      const id = `partner_seed_${index}`;
      repository.seedPlayer({
        characterCreatedAt: FIXED_NOW,
        factionId: 'faccao_a',
        id,
        level: 5,
        nickname: `PartnerSeed_${index}`,
        vocation: VocationType.Cria,
      });
      repository.seedContact({
        contactId: id,
        playerId: 'owner',
        since: FIXED_NOW,
        type: 'partner',
      });
    }

    repository.seedPlayer({
      characterCreatedAt: FIXED_NOW,
      factionId: 'faccao_a',
      id: 'partner_overflow',
      level: 5,
      nickname: 'Partner_Overflow',
      vocation: VocationType.Cria,
    });

    const overflowResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'POST',
      payload: {
        nickname: 'Partner_Overflow',
        type: 'partner',
      },
      url: '/api/contacts',
    });

    expect(overflowResponse.statusCode).toBe(409);
    expect(overflowResponse.json()).toMatchObject({
      category: 'domain',
      message: 'Sua rede de parceiros ja atingiu o limite desta rodada.',
    });
  });

  it('removes contacts and syncs rival partners out after faction changes', async () => {
    await contactService.addContact('owner', {
      nickname: 'Known_01',
      type: 'known',
    });
    await contactService.addContact('owner', {
      nickname: 'Partner_01',
      type: 'partner',
    });
    repository.seedContact({
      contactId: 'rival_01',
      playerId: 'owner',
      since: FIXED_NOW,
      type: 'partner',
    });

    const syncResult = await contactService.syncContactsAfterFactionChange('owner', 'faccao_a');

    expect(syncResult).toEqual({
      nextFactionId: 'faccao_a',
      playerId: 'owner',
      removedContactIds: ['rival_01'],
      removedPartners: 1,
    });

    const removalResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'DELETE',
      url: '/api/contacts/known_01',
    });

    expect(removalResponse.statusCode).toBe(200);
    expect(removalResponse.json()).toMatchObject({
      message: 'Contato removido da sua lista.',
      removedContactId: 'known_01',
      removedType: 'known',
    });

    const rosterResponse = await app.inject({
      headers: {
        'x-player-id': 'owner',
      },
      method: 'GET',
      url: '/api/contacts',
    });

    expect(rosterResponse.statusCode).toBe(200);
    expect(rosterResponse.json().contacts.map((entry: { nickname: string }) => entry.nickname)).toEqual([
      'Partner_01',
    ]);
  });
});
