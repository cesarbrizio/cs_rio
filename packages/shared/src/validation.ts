export const AUTH_EMAIL_MAX_LENGTH = 320;
export const AUTH_NICKNAME_MIN_LENGTH = 3;
export const AUTH_NICKNAME_MAX_LENGTH = 16;
export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_PASSWORD_MAX_LENGTH = 128;
export const DEFAULT_TOKEN_MAX_LENGTH = 128;

export const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const AUTH_NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/u;
export const NON_EMPTY_TOKEN_PATTERN = /^\S(?:[\s\S]*\S)?$/u;

export function normalizeEmail(value: string): string {
  return normalizeTrimmedText(value).toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);

  if (!AUTH_EMAIL_PATTERN.test(normalized)) {
    return false;
  }

  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return false;
  }

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  if (!localPart || !domainPart) {
    return false;
  }

  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    localPart.includes('..') ||
    domainPart.includes('..')
  ) {
    return false;
  }

  return true;
}

export function normalizeAuthNickname(value: string): string {
  return normalizeTrimmedText(value);
}

export function isValidAuthNickname(value: string): boolean {
  return AUTH_NICKNAME_PATTERN.test(normalizeAuthNickname(value));
}

export function normalizePasswordInput(value: string): string {
  return normalizeTrimmedText(value);
}

export function hasValidPasswordLength(value: string): boolean {
  const normalized = normalizePasswordInput(value);
  return (
    normalized.length >= AUTH_PASSWORD_MIN_LENGTH &&
    normalized.length <= AUTH_PASSWORD_MAX_LENGTH
  );
}

export function normalizeTrimmedText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeCollapsedText(value: string | null | undefined): string {
  return normalizeTrimmedText(value).replace(/\s+/g, ' ');
}

export function normalizeOptionalFilter(
  value: string | null | undefined,
  maxLength = DEFAULT_TOKEN_MAX_LENGTH,
): string | undefined {
  const normalized = normalizeTrimmedText(value);

  if (!normalized || normalized.length > maxLength) {
    return undefined;
  }

  return normalized;
}

export function normalizeOptionalToken(
  value: string | null | undefined,
  maxLength = DEFAULT_TOKEN_MAX_LENGTH,
): string | undefined {
  const normalized = normalizeOptionalFilter(value, maxLength);

  if (!normalized || !NON_EMPTY_TOKEN_PATTERN.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function normalizeRoundedMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizePositiveMoney(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = normalizeRoundedMoney(value);
  return normalized > 0 ? normalized : null;
}

export function normalizeNonNegativeMoney(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = normalizeRoundedMoney(value);
  return normalized >= 0 ? normalized : null;
}

export function normalizePositiveInteger(
  value: number,
  minimum = 1,
  maximum = Number.MAX_SAFE_INTEGER,
): number | null {
  if (!Number.isInteger(value)) {
    return null;
  }

  if (value < minimum || value > maximum) {
    return null;
  }

  return value;
}
