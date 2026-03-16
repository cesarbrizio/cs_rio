import { DomainError, inferDomainErrorCategory } from '../../errors/domain-error.js';
import type { ContactOwnerRecord, ContactRepository, ContactSummaryRecord } from '../contact/types.js';

export interface PrivateMessageRecord {
  id: string;
  message: string;
  senderId: string;
  senderNickname: string;
  sentAt: Date;
}

export interface PrivateMessageThreadRecord {
  channelId: string;
  lastMessage: PrivateMessageRecord | null;
  messageCount: number;
  updatedAt: Date | null;
}

export interface PrivateMessageInsertInput {
  channelId: string;
  message: string;
  senderId: string;
  sentAt: Date;
}

export interface PrivateMessageInsertResult {
  id: string;
  message: string;
  senderId: string;
  sentAt: Date;
}

export interface PrivateMessageRepository {
  insertMessage(input: PrivateMessageInsertInput): Promise<PrivateMessageInsertResult>;
  listMessages(channelId: string, limit: number): Promise<PrivateMessageRecord[]>;
  listThreadSummaries(channelIds: string[]): Promise<PrivateMessageThreadRecord[]>;
}

export interface PrivateMessageServiceOptions {
  contactRepository?: ContactRepository;
  now?: () => Date;
  repository?: PrivateMessageRepository;
}

type PrivateMessageErrorCode =
  | 'conflict'
  | 'forbidden'
  | 'not_found'
  | 'unauthorized'
  | 'validation';

export function privateMessageError(code: PrivateMessageErrorCode, message: string): DomainError {
  return new DomainError('private-message', code, inferDomainErrorCategory(code), message);
}

export class PrivateMessageError extends DomainError {
  constructor(
    code: PrivateMessageErrorCode,
    message: string,
  ) {
    super('private-message', code, inferDomainErrorCategory(code), message);
    this.name = 'PrivateMessageError';
  }
}

export type { ContactOwnerRecord, ContactRepository, ContactSummaryRecord };
