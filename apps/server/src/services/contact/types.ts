import type {
  PlayerContactFactionSyncResult,
  PlayerContactOrigin,
  PlayerContactType,
  PlayerFactionSummary,
  VocationType,
} from '@cs-rio/shared';
import { DomainError, inferDomainErrorCategory } from '../../errors/domain-error.js';

export interface ContactOwnerRecord {
  characterCreatedAt: Date | null;
  factionId: string | null;
  id: string;
  nickname: string;
}

export interface ContactCandidateRecord extends ContactOwnerRecord {
  level: number;
  vocation: VocationType;
}

export interface ContactSummaryRecord {
  contactId: string;
  faction: PlayerFactionSummary | null;
  level: number;
  nickname: string;
  origin: PlayerContactOrigin;
  since: Date;
  type: PlayerContactType;
  vocation: VocationType;
}

export interface ContactSaveInput {
  contactId: string;
  playerId: string;
  since: Date;
  type: PlayerContactType;
}

export interface ContactRepository {
  findContactCandidateByNickname(nickname: string): Promise<ContactCandidateRecord | null>;
  getOwner(playerId: string): Promise<ContactOwnerRecord | null>;
  listContacts(playerId: string): Promise<ContactSummaryRecord[]>;
  removeContact(playerId: string, contactId: string): Promise<boolean>;
  removePartnerContactsOutsideFaction(
    playerId: string,
    nextFactionId: string | null,
  ): Promise<string[]>;
  saveContact(input: ContactSaveInput): Promise<void>;
}

export interface ContactServiceOptions {
  now?: () => Date;
  repository?: ContactRepository;
}

export interface FactionContactSyncContract {
  syncContactsAfterFactionChange(
    playerId: string,
    nextFactionId: string | null,
  ): Promise<PlayerContactFactionSyncResult>;
}

type ContactErrorCode = 'conflict' | 'forbidden' | 'not_found' | 'unauthorized' | 'validation';

export function contactError(code: ContactErrorCode, message: string): DomainError {
  return new DomainError('contact', code, inferDomainErrorCategory(code), message);
}

export class ContactError extends DomainError {
  constructor(
    code: ContactErrorCode,
    message: string,
  ) {
    super('contact', code, inferDomainErrorCategory(code), message);
    this.name = 'ContactError';
  }
}
