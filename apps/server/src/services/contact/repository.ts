import { type PlayerContactOrigin, type PlayerContactType, type PlayerFactionSummary, type VocationType } from '@cs-rio/shared';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { contacts, factionMembers, factions, players } from '../../db/schema.js';
import type {
  ContactCandidateRecord,
  ContactOwnerRecord,
  ContactRepository,
  ContactSaveInput,
  ContactSummaryRecord,
} from './types.js';

type PlayerFactionSeed = {
  factionId: string | null;
  playerId: string;
};

export class DatabaseContactRepository implements ContactRepository {
  async findContactCandidateByNickname(nickname: string): Promise<ContactCandidateRecord | null> {
    const [player] = await db
      .select({
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
      level: players.level,
      nickname: players.nickname,
      vocation: players.vocation,
      })
      .from(players)
      .where(eq(players.nickname, nickname))
      .limit(1);

    if (!player) {
      return null;
    }

    return {
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      level: player.level,
      nickname: player.nickname,
      vocation: player.vocation as VocationType,
    };
  }

  async getOwner(playerId: string): Promise<ContactOwnerRecord | null> {
    const [player] = await db
      .select({
        characterCreatedAt: players.characterCreatedAt,
        factionId: players.factionId,
        id: players.id,
        nickname: players.nickname,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return null;
    }

    return {
      characterCreatedAt: player.characterCreatedAt,
      factionId: player.factionId,
      id: player.id,
      nickname: player.nickname,
    };
  }

  async listContacts(playerId: string): Promise<ContactSummaryRecord[]> {
    const rows = await db
      .select({
        contactId: contacts.contactId,
        contactFactionId: players.factionId,
        level: players.level,
        nickname: players.nickname,
        since: contacts.since,
        type: contacts.type,
        vocation: players.vocation,
      })
      .from(contacts)
      .innerJoin(players, eq(players.id, contacts.contactId))
      .where(eq(contacts.playerId, playerId));

    const factionSummaryByPlayerId = await resolveFactionSummaryMap(
      rows.map((row) => ({
        factionId: row.contactFactionId,
        playerId: row.contactId,
      })),
    );

    return rows.map((row) => ({
      contactId: row.contactId,
      faction: factionSummaryByPlayerId.get(row.contactId) ?? null,
      level: row.level,
      nickname: row.nickname,
      origin: resolveContactOrigin(row.type),
      since: row.since,
      type: row.type,
      vocation: row.vocation as VocationType,
    }));
  }

  async removeContact(playerId: string, contactId: string): Promise<boolean> {
    const [removed] = await db
      .delete(contacts)
      .where(
        and(
          eq(contacts.playerId, playerId),
          eq(contacts.contactId, contactId),
        ),
      )
      .returning({
        contactId: contacts.contactId,
      });

    return Boolean(removed);
  }

  async removePartnerContactsOutsideFaction(
    playerId: string,
    nextFactionId: string | null,
  ): Promise<string[]> {
    const partnerContacts = await db
      .select({
        contactFactionId: players.factionId,
        contactId: contacts.contactId,
      })
      .from(contacts)
      .innerJoin(players, eq(players.id, contacts.contactId))
      .where(
        and(
          eq(contacts.playerId, playerId),
          eq(contacts.type, 'partner'),
        ),
      );

    const removableIds = partnerContacts
      .filter((contact) => contact.contactFactionId !== nextFactionId)
      .map((contact) => contact.contactId);

    if (removableIds.length === 0) {
      return [];
    }

    await db
      .delete(contacts)
      .where(
        and(
          eq(contacts.playerId, playerId),
          eq(contacts.type, 'partner'),
          inArray(contacts.contactId, removableIds),
        ),
      );

    return removableIds;
  }

  async saveContact(input: ContactSaveInput): Promise<void> {
    const [existing] = await db
      .select({
        contactId: contacts.contactId,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.playerId, input.playerId),
          eq(contacts.contactId, input.contactId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(contacts)
        .set({
          type: input.type,
        })
        .where(
          and(
            eq(contacts.playerId, input.playerId),
            eq(contacts.contactId, input.contactId),
          ),
        );
      return;
    }

    await db.insert(contacts).values({
      contactId: input.contactId,
      playerId: input.playerId,
      since: input.since,
      type: input.type,
    });
  }
}

async function resolveFactionSummaryMap(
  seeds: PlayerFactionSeed[],
): Promise<Map<string, PlayerFactionSummary | null>> {
  const byPlayerId = new Map<string, PlayerFactionSummary | null>();
  const uniqueSeeds = [...new Map(seeds.map((seed) => [seed.playerId, seed])).values()];

  if (uniqueSeeds.length === 0) {
    return byPlayerId;
  }

  const membershipRows = await db
    .select({
      abbreviation: factions.abbreviation,
      factionId: factionMembers.factionId,
      name: factions.name,
      playerId: factionMembers.playerId,
      rank: factionMembers.rank,
    })
    .from(factionMembers)
    .innerJoin(factions, eq(factions.id, factionMembers.factionId))
    .where(inArray(factionMembers.playerId, uniqueSeeds.map((seed) => seed.playerId)));

  const membershipByPlayerId = new Map(membershipRows.map((row) => [row.playerId, row] as const));

  const fallbackFactionIds = uniqueSeeds
    .map((seed) => seed.factionId)
    .filter((factionId): factionId is string => Boolean(factionId));
  const fallbackFactions =
    fallbackFactionIds.length > 0
      ? await db
          .select({
            abbreviation: factions.abbreviation,
            id: factions.id,
            name: factions.name,
          })
          .from(factions)
          .where(inArray(factions.id, [...new Set(fallbackFactionIds)]))
      : [];
  const fallbackFactionById = new Map(fallbackFactions.map((row) => [row.id, row] as const));

  for (const seed of uniqueSeeds) {
    const membership = membershipByPlayerId.get(seed.playerId);

    if (membership) {
      byPlayerId.set(seed.playerId, {
        abbreviation: membership.abbreviation,
        id: membership.factionId,
        name: membership.name,
        rank: membership.rank,
      });
      continue;
    }

    if (!seed.factionId) {
      byPlayerId.set(seed.playerId, null);
      continue;
    }

    const fallbackFaction = fallbackFactionById.get(seed.factionId);
    byPlayerId.set(
      seed.playerId,
      fallbackFaction
        ? {
            abbreviation: fallbackFaction.abbreviation,
            id: fallbackFaction.id,
            name: fallbackFaction.name,
            rank: null,
          }
        : null,
    );
  }

  return byPlayerId;
}

function resolveContactOrigin(type: PlayerContactType): PlayerContactOrigin {
  return type === 'partner' ? 'same_faction' : 'manual';
}
