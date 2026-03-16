import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { chatMessages, players } from '../../db/schema.js';
import type {
  PrivateMessageInsertInput,
  PrivateMessageInsertResult,
  PrivateMessageRecord,
  PrivateMessageRepository,
  PrivateMessageThreadRecord,
} from './types.js';

export class DatabasePrivateMessageRepository implements PrivateMessageRepository {
  async insertMessage(input: PrivateMessageInsertInput): Promise<PrivateMessageInsertResult> {
    const [message] = await db
      .insert(chatMessages)
      .values({
        channelId: input.channelId,
        channelType: 'private',
        message: input.message,
        senderId: input.senderId,
        sentAt: input.sentAt,
      })
      .returning({
        id: chatMessages.id,
        message: chatMessages.message,
        senderId: chatMessages.senderId,
        sentAt: chatMessages.sentAt,
      });

    if (!message) {
      throw new Error('Falha ao persistir a mensagem privada.');
    }

    return {
      id: message.id,
      message: message.message,
      senderId: message.senderId,
      sentAt: message.sentAt,
    };
  }

  async listMessages(channelId: string, limit: number): Promise<PrivateMessageRecord[]> {
    const rows = await db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        senderId: chatMessages.senderId,
        senderNickname: players.nickname,
        sentAt: chatMessages.sentAt,
      })
      .from(chatMessages)
      .innerJoin(players, eq(players.id, chatMessages.senderId))
      .where(
        and(
          eq(chatMessages.channelType, 'private'),
          eq(chatMessages.channelId, channelId),
        ),
      )
      .orderBy(desc(chatMessages.sentAt), desc(chatMessages.id))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      message: row.message,
      senderId: row.senderId,
      senderNickname: row.senderNickname,
      sentAt: row.sentAt,
    }));
  }

  async listThreadSummaries(channelIds: string[]): Promise<PrivateMessageThreadRecord[]> {
    const uniqueChannelIds = [...new Set(channelIds)];

    if (uniqueChannelIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        channelId: chatMessages.channelId,
        id: chatMessages.id,
        message: chatMessages.message,
        senderId: chatMessages.senderId,
        senderNickname: players.nickname,
        sentAt: chatMessages.sentAt,
      })
      .from(chatMessages)
      .innerJoin(players, eq(players.id, chatMessages.senderId))
      .where(
        and(
          eq(chatMessages.channelType, 'private'),
          inArray(chatMessages.channelId, uniqueChannelIds),
        ),
      )
      .orderBy(desc(chatMessages.sentAt), desc(chatMessages.id));

    const summaries = new Map<string, PrivateMessageThreadRecord>();

    for (const row of rows) {
      const existing = summaries.get(row.channelId);

      if (existing) {
        existing.messageCount += 1;
        continue;
      }

      summaries.set(row.channelId, {
        channelId: row.channelId,
        lastMessage: {
          id: row.id,
          message: row.message,
          senderId: row.senderId,
          senderNickname: row.senderNickname,
          sentAt: row.sentAt,
        },
        messageCount: 1,
        updatedAt: row.sentAt,
      });
    }

    return uniqueChannelIds
      .map((channelId) => summaries.get(channelId))
      .filter((summary): summary is PrivateMessageThreadRecord => summary !== undefined);
  }
}
