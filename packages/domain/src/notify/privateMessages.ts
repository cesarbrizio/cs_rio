import {
  type PlayerContactSummary,
  type PlayerContactsResponse,
  type PrivateMessageThreadListResponse,
  type PrivateMessageThreadSummary,
} from '@cs-rio/shared';

export interface PrivateMessageCue {
  body: string;
  contactId: string;
  contactNickname: string;
  key: string;
  messageId: string;
  sentAt: string;
  title: string;
}

export interface PrivateMessageRosterEntry extends PrivateMessageThreadSummary {
  contactOriginLabel: string;
  contactTypeLabel: string;
  preview: string;
  unreadIncoming: boolean;
  updatedAtLabel: string;
}

export function buildPendingPrivateMessageCues(input: {
  feed: PrivateMessageThreadListResponse;
  seenMessageIds: ReadonlySet<string>;
}): PrivateMessageCue[] {
  return input.feed.threads
    .map(buildPrivateMessageCue)
    .filter((cue): cue is PrivateMessageCue => cue !== null)
    .filter((cue) => !input.seenMessageIds.has(cue.messageId))
    .sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime());
}

export function buildPrivateMessageCue(
  thread: PrivateMessageThreadSummary,
): PrivateMessageCue | null {
  if (!thread.lastMessage) {
    return null;
  }

  if (thread.lastMessage.senderId !== thread.contact.contactId) {
    return null;
  }

  return {
    body: thread.lastMessage.message,
    contactId: thread.contact.contactId,
    contactNickname: thread.contact.nickname,
    key: `private-message:${thread.contact.contactId}:${thread.lastMessage.id}`,
    messageId: thread.lastMessage.id,
    sentAt: thread.lastMessage.sentAt,
    title: `Mensagem de ${thread.contact.nickname}`,
  };
}

export function buildPrivateMessageRoster(input: {
  contacts: PlayerContactsResponse | null;
  threads: PrivateMessageThreadSummary[];
}): PrivateMessageRosterEntry[] {
  const contacts = input.contacts?.contacts ?? [];
  const threadByContactId = new Map(input.threads.map((thread) => [thread.contact.contactId, thread] as const));

  return contacts
    .map((contact) => buildRosterEntry(contact, threadByContactId.get(contact.contactId) ?? null))
    .sort((left, right) => {
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;

      if (left.unreadIncoming !== right.unreadIncoming) {
        return left.unreadIncoming ? -1 : 1;
      }

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      if (left.contact.type !== right.contact.type) {
        return left.contact.type === 'partner' ? -1 : 1;
      }

      return left.contact.nickname.localeCompare(right.contact.nickname, 'pt-BR');
    });
}

export function formatPrivateMessageTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'Sem conversa ainda';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Agora';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}

function resolveContactOriginLabel(origin: PlayerContactSummary['origin']): string {
  return origin === 'same_faction' ? 'Mesmo bonde' : 'Manual';
}

function resolveContactTypeLabel(type: PlayerContactSummary['type']): string {
  return type === 'partner' ? 'Parceiro' : 'Conhecido';
}

function buildRosterEntry(
  contact: PlayerContactSummary,
  thread: PrivateMessageThreadSummary | null,
): PrivateMessageRosterEntry {
  const preview = thread?.lastMessage
    ? `${thread.lastMessage.senderId === contact.contactId ? contact.nickname : 'Voce'}: ${thread.lastMessage.message}`
    : 'Sem mensagem privada ainda.';

  return {
    contact,
    contactOriginLabel: resolveContactOriginLabel(contact.origin),
    contactTypeLabel: resolveContactTypeLabel(contact.type),
    lastMessage: thread?.lastMessage ?? null,
    messageCount: thread?.messageCount ?? 0,
    preview,
    threadId: thread?.threadId ?? contact.contactId,
    unreadIncoming: Boolean(thread?.lastMessage && thread.lastMessage.senderId === contact.contactId),
    updatedAt: thread?.updatedAt ?? null,
    updatedAtLabel: formatPrivateMessageTimestamp(thread?.updatedAt ?? null),
  };
}
