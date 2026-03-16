import {
  LevelTitle,
  VocationType,
  type PlayerContactsResponse,
  type PrivateMessageThreadListResponse,
  type PrivateMessageThreadSummary,
} from '@cs-rio/shared';
import { describe, expect, it, vi } from 'vitest';

const secureStoreState = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreState.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreState.set(key, value);
  }),
}));

import {
  buildPendingPrivateMessageCues,
  buildPrivateMessageRoster,
} from '../src/features/private-messages';
import {
  loadSeenPrivateMessageIds,
  rememberSeenPrivateMessage,
} from '../src/features/private-message-storage';

describe('private message helpers', () => {
  it('builds notification cues only for incoming private messages that are still unseen', () => {
    const feed = {
      generatedAt: '2026-03-16T16:00:00.000Z',
      threads: [
        {
          contact: {
            contactId: 'partner-1',
            faction: null,
            level: 7,
            nickname: 'Radar',
            origin: 'same_faction',
            since: '2026-03-15T10:00:00.000Z',
            title: LevelTitle.Frente,
            type: 'partner',
            vocation: VocationType.Soldado,
          },
          lastMessage: {
            id: 'msg-1',
            message: 'Chega no barraco',
            senderId: 'partner-1',
            senderNickname: 'Radar',
            sentAt: '2026-03-16T15:50:00.000Z',
          },
          messageCount: 4,
          threadId: 'owner:partner-1',
          updatedAt: '2026-03-16T15:50:00.000Z',
        },
        {
          contact: {
            contactId: 'known-1',
            faction: null,
            level: 4,
            nickname: 'Buiu',
            origin: 'manual',
            since: '2026-03-15T12:00:00.000Z',
            title: LevelTitle.Vapor,
            type: 'known',
            vocation: VocationType.Cria,
          },
          lastMessage: {
            id: 'msg-2',
            message: 'ja to indo',
            senderId: 'owner',
            senderNickname: 'Você',
            sentAt: '2026-03-16T15:55:00.000Z',
          },
          messageCount: 2,
          threadId: 'known-1:owner',
          updatedAt: '2026-03-16T15:55:00.000Z',
        },
      ],
    } satisfies PrivateMessageThreadListResponse;

    expect(
      buildPendingPrivateMessageCues({
        feed,
        seenMessageIds: new Set<string>(),
      }),
    ).toEqual([
      {
        body: 'Chega no barraco',
        contactId: 'partner-1',
        contactNickname: 'Radar',
        key: 'private-message:partner-1:msg-1',
        messageId: 'msg-1',
        sentAt: '2026-03-16T15:50:00.000Z',
        title: 'Mensagem de Radar',
      },
    ]);
  });

  it('merges contact book with thread feed and keeps partner conversations ahead of loose contacts', () => {
    const contacts = {
      contacts: [
        {
          contactId: 'known-1',
          faction: null,
          level: 4,
          nickname: 'Buiu',
          origin: 'manual',
          since: '2026-03-15T12:00:00.000Z',
          title: LevelTitle.Vapor,
          type: 'known',
          vocation: VocationType.Cria,
        },
        {
          contactId: 'partner-1',
          faction: null,
          level: 7,
          nickname: 'Radar',
          origin: 'same_faction',
          since: '2026-03-15T10:00:00.000Z',
          title: LevelTitle.Frente,
          type: 'partner',
          vocation: VocationType.Soldado,
        },
      ],
      limits: {
        known: { max: 100, remaining: 99, used: 1 },
        partner: { max: 20, remaining: 19, used: 1 },
      },
    } satisfies PlayerContactsResponse;

    const threads = [
      {
        contact: {
          contactId: 'partner-1',
          faction: null,
          level: 7,
          nickname: 'Radar',
          origin: 'same_faction',
          since: '2026-03-15T10:00:00.000Z',
          title: LevelTitle.Frente,
          type: 'partner',
          vocation: VocationType.Soldado,
        },
        lastMessage: {
          id: 'msg-1',
          message: 'Chega no barraco',
          senderId: 'partner-1',
          senderNickname: 'Radar',
          sentAt: '2026-03-16T15:50:00.000Z',
        },
        messageCount: 4,
        threadId: 'owner:partner-1',
        updatedAt: '2026-03-16T15:50:00.000Z',
      },
    ] satisfies PrivateMessageThreadSummary[];

    const roster = buildPrivateMessageRoster({
      contacts,
      threads,
    });

    expect(roster[0]).toMatchObject({
      contact: {
        contactId: 'partner-1',
      },
      contactOriginLabel: 'Mesmo bonde',
      contactTypeLabel: 'Parceiro',
      unreadIncoming: true,
    });
    expect(roster[1]).toMatchObject({
      contact: {
        contactId: 'known-1',
      },
      preview: 'Sem mensagem privada ainda.',
      unreadIncoming: false,
    });
  });

  it('stores seen private message ids per player', async () => {
    secureStoreState.clear();

    expect((await loadSeenPrivateMessageIds('player-1')).size).toBe(0);

    const seenIds = await rememberSeenPrivateMessage('player-1', 'msg-77');

    expect(seenIds.has('msg-77')).toBe(true);
  });
});
