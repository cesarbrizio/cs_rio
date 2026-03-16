import {
  PRIVATE_MESSAGE_MAX_LENGTH,
  PRIVATE_MESSAGE_THREAD_HISTORY_LIMIT,
  type PrivateMessageSendInput,
  type PrivateMessageSendResponse,
  type PrivateMessageSummary,
  type PrivateMessageThreadListResponse,
  type PrivateMessageThreadResponse,
} from '@cs-rio/shared';

import { resolveLevelTitle } from './auth.js';
import { DatabaseContactRepository } from './contact/repository.js';
import { DatabasePrivateMessageRepository } from './private-message/repository.js';
import {
  PrivateMessageError,
  type ContactOwnerRecord,
  type ContactRepository,
  type ContactSummaryRecord,
  type PrivateMessageRecord,
  type PrivateMessageRepository,
  type PrivateMessageServiceOptions,
} from './private-message/types.js';

export { DatabasePrivateMessageRepository } from './private-message/repository.js';
export { PrivateMessageError } from './private-message/types.js';
export type {
  ContactOwnerRecord,
  ContactRepository,
  ContactSummaryRecord,
  PrivateMessageInsertInput,
  PrivateMessageInsertResult,
  PrivateMessageRecord,
  PrivateMessageRepository,
  PrivateMessageServiceOptions,
  PrivateMessageThreadRecord,
} from './private-message/types.js';

export class PrivateMessageService {
  private readonly contactRepository: ContactRepository;

  private readonly now: () => Date;

  private readonly repository: PrivateMessageRepository;

  constructor(options: PrivateMessageServiceOptions = {}) {
    this.contactRepository = options.contactRepository ?? new DatabaseContactRepository();
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabasePrivateMessageRepository();
  }

  async listThreads(playerId: string): Promise<PrivateMessageThreadListResponse> {
    const owner = await this.getReadyOwner(playerId);
    const contacts = await this.contactRepository.listContacts(owner.id);
    const threadIds = contacts.map((contact) => resolvePrivateMessageThreadId(owner.id, contact.contactId));
    const threadSummaries = await this.repository.listThreadSummaries(threadIds);
    const threadSummaryById = new Map(threadSummaries.map((summary) => [summary.channelId, summary] as const));

    return {
      generatedAt: this.now().toISOString(),
      threads: [...contacts]
        .map((contact) => {
          const threadId = resolvePrivateMessageThreadId(owner.id, contact.contactId);
          const summary = threadSummaryById.get(threadId) ?? null;

          return {
            contact: serializeContact(contact),
            lastMessage: summary?.lastMessage
              ? serializePrivateMessage(summary.lastMessage)
              : null,
            messageCount: summary?.messageCount ?? 0,
            threadId,
            updatedAt: summary?.updatedAt?.toISOString() ?? null,
          };
        })
        .sort(sortPrivateThreadsForDisplay),
    };
  }

  async getThread(playerId: string, contactId: string): Promise<PrivateMessageThreadResponse> {
    const owner = await this.getReadyOwner(playerId);
    const contact = await this.getContact(owner.id, contactId);
    const threadId = resolvePrivateMessageThreadId(owner.id, contact.contactId);
    const messages = await this.repository.listMessages(threadId, PRIVATE_MESSAGE_THREAD_HISTORY_LIMIT);

    return {
      contact: serializeContact(contact),
      generatedAt: this.now().toISOString(),
      messages: [...messages]
        .sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime())
        .map((entry) => serializePrivateMessage(entry)),
      threadId,
    };
  }

  async sendMessage(
    playerId: string,
    contactId: string,
    input: PrivateMessageSendInput,
  ): Promise<PrivateMessageSendResponse> {
    const owner = await this.getReadyOwner(playerId);
    const contact = await this.getContact(owner.id, contactId);
    const message = normalizePrivateMessageBody(input.message);

    if (!message) {
      throw new PrivateMessageError(
        'validation',
        `A mensagem privada precisa ter entre 1 e ${PRIVATE_MESSAGE_MAX_LENGTH} caracteres.`,
      );
    }

    const sentAt = this.now();
    const threadId = resolvePrivateMessageThreadId(owner.id, contact.contactId);
    const savedMessage = await this.repository.insertMessage({
      channelId: threadId,
      message,
      senderId: owner.id,
      sentAt,
    });
    const thread = await this.getThread(owner.id, contact.contactId);

    return {
      ...thread,
      message: 'Mensagem privada enviada para a sua rede.',
      sentMessage: serializePrivateMessage({
        id: savedMessage.id,
        message: savedMessage.message,
        senderId: savedMessage.senderId,
        senderNickname: owner.nickname,
        sentAt: savedMessage.sentAt,
      }),
    };
  }

  private async getContact(playerId: string, contactId: string): Promise<ContactSummaryRecord> {
    const contacts = await this.contactRepository.listContacts(playerId);
    const contact = contacts.find((entry) => entry.contactId === contactId) ?? null;

    if (!contact) {
      throw new PrivateMessageError(
        'forbidden',
        'Voce so pode trocar mensagem privada com contatos ativos da sua rede.',
      );
    }

    return contact;
  }

  private async getReadyOwner(playerId: string): Promise<ContactOwnerRecord> {
    const owner = await this.contactRepository.getOwner(playerId);

    if (!owner) {
      throw new PrivateMessageError('unauthorized', 'Jogador nao encontrado.');
    }

    if (!owner.characterCreatedAt) {
      throw new PrivateMessageError(
        'conflict',
        'Crie seu personagem antes de usar a mensageria privada.',
      );
    }

    return owner;
  }
}

export function resolvePrivateMessageThreadId(playerId: string, contactId: string): string {
  return [playerId, contactId].sort((left, right) => left.localeCompare(right)).join(':');
}

function normalizePrivateMessageBody(message: string | null | undefined): string | null {
  if (typeof message !== 'string') {
    return null;
  }

  const normalized = message.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0 || normalized.length > PRIVATE_MESSAGE_MAX_LENGTH) {
    return null;
  }

  return normalized;
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

function serializePrivateMessage(message: PrivateMessageRecord): PrivateMessageSummary {
  return {
    id: message.id,
    message: message.message,
    senderId: message.senderId,
    senderNickname: message.senderNickname,
    sentAt: message.sentAt.toISOString(),
  };
}

function sortPrivateThreadsForDisplay(
  left: PrivateMessageThreadListResponse['threads'][number],
  right: PrivateMessageThreadListResponse['threads'][number],
): number {
  const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
  const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  if (left.contact.type !== right.contact.type) {
    return left.contact.type === 'partner' ? -1 : 1;
  }

  return left.contact.nickname.localeCompare(right.contact.nickname, 'pt-BR');
}
