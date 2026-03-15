import { describe, expect, it } from 'vitest';

import {
  AUTH_EMAIL_MAX_LENGTH,
  AUTH_NICKNAME_MAX_LENGTH,
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  hasValidPasswordLength,
  isValidAuthNickname,
  isValidEmail,
  normalizeAuthNickname,
  normalizeCollapsedText,
  normalizeEmail,
  normalizeOptionalFilter,
  normalizeOptionalToken,
  normalizeNonNegativeMoney,
  normalizePositiveInteger,
  normalizePositiveMoney,
  normalizeRoundedMoney,
} from '../src/validation.js';

describe('shared validation helpers', () => {
  it('normalizes and validates auth email and nickname consistently', () => {
    expect(normalizeEmail('  TEST@Example.COM ')).toBe('test@example.com');
    expect(isValidEmail('  TEST@Example.COM ')).toBe(true);
    expect(normalizeAuthNickname('  flucesar  ')).toBe('flucesar');
    expect(isValidAuthNickname('  flucesar  ')).toBe(true);
    expect(isValidAuthNickname('x')).toBe(false);
  });

  it('rejects malformed emails and keeps valid unicode addresses', () => {
    expect(isValidEmail('josé@example.com')).toBe(true);
    expect(isValidEmail('UPPER.CASE+tag@example.com')).toBe(true);
    expect(isValidEmail('.startdot@example.com')).toBe(false);
    expect(isValidEmail('enddot.@example.com')).toBe(false);
    expect(isValidEmail('foo@bar..com')).toBe(false);
    expect(isValidEmail('foo@@bar.com')).toBe(false);
    expect(isValidEmail('a b@example.com')).toBe(false);
  });

  it('keeps nickname rules strict and text normalization unicode-safe', () => {
    expect(isValidAuthNickname('Nome_Completo')).toBe(true);
    expect(isValidAuthNickname('ab')).toBe(false);
    expect(isValidAuthNickname('nome com espaco')).toBe(false);
    expect(isValidAuthNickname('çesár')).toBe(false);
    expect(isValidAuthNickname('x'.repeat(AUTH_NICKNAME_MAX_LENGTH + 1))).toBe(false);
    expect(normalizeCollapsedText('  Comando\u00A0\u00A0Vermelho \n ')).toBe('Comando Vermelho');
    expect(normalizeCollapsedText('\t Facção \u2003 ativa \n')).toBe('Facção ativa');
  });

  it('validates password length after trimming', () => {
    expect(hasValidPasswordLength('   12345678   ')).toBe(true);
    expect(hasValidPasswordLength('   1234   ')).toBe(false);
    expect(hasValidPasswordLength(` ${'a'.repeat(AUTH_PASSWORD_MIN_LENGTH)} `)).toBe(true);
    expect(hasValidPasswordLength(' '.repeat(4) + 'a'.repeat(AUTH_PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it('normalizes collapsed text and optional filters', () => {
    expect(normalizeCollapsedText('  Comando   Vermelho \n ')).toBe('Comando Vermelho');
    expect(normalizeOptionalFilter('   ')).toBeUndefined();
    expect(normalizeOptionalFilter('  item-1  ')).toBe('item-1');
    expect(normalizeOptionalToken('  token-1  ')).toBe('token-1');
    expect(normalizeOptionalToken('   ')).toBeUndefined();
    expect(normalizeOptionalFilter('a'.repeat(AUTH_EMAIL_MAX_LENGTH + 1), AUTH_EMAIL_MAX_LENGTH)).toBeUndefined();
    expect(normalizeOptionalToken(' token com espaco ')).toBe('token com espaco');
  });

  it('normalizes money helpers on precision extremes and invalid numbers', () => {
    expect(normalizeRoundedMoney(12.345)).toBe(12.35);
    expect(normalizeRoundedMoney(1.005)).toBe(1.01);
    expect(normalizeRoundedMoney(2.675)).toBe(2.68);
    expect(normalizePositiveMoney(0)).toBeNull();
    expect(normalizePositiveMoney(12.345)).toBe(12.35);
    expect(normalizePositiveMoney(Number.NaN)).toBeNull();
    expect(normalizePositiveMoney(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeNonNegativeMoney(0)).toBe(0);
    expect(normalizeNonNegativeMoney(-0.01)).toBeNull();
  });

  it('normalizes quantity helpers across integer boundaries', () => {
    expect(normalizePositiveInteger(3, 1, 5)).toBe(3);
    expect(normalizePositiveInteger(0, 1, 5)).toBeNull();
    expect(normalizePositiveInteger(3.2, 1, 5)).toBeNull();
    expect(normalizePositiveInteger(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(normalizePositiveInteger(10, 1, 5)).toBeNull();
  });
});
