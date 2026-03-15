import { describe, expect, it } from 'vitest';

import {
  hasValidPasswordLength,
  isValidAuthNickname,
  isValidEmail,
  normalizeAuthNickname,
  normalizeCollapsedText,
  normalizeEmail,
  normalizeOptionalFilter,
  normalizeOptionalToken,
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

  it('validates password length after trimming', () => {
    expect(hasValidPasswordLength('   12345678   ')).toBe(true);
    expect(hasValidPasswordLength('   1234   ')).toBe(false);
  });

  it('normalizes collapsed text and optional filters', () => {
    expect(normalizeCollapsedText('  Comando   Vermelho \n ')).toBe('Comando Vermelho');
    expect(normalizeOptionalFilter('   ')).toBeUndefined();
    expect(normalizeOptionalFilter('  item-1  ')).toBe('item-1');
    expect(normalizeOptionalToken('  token-1  ')).toBe('token-1');
    expect(normalizeOptionalToken('   ')).toBeUndefined();
  });

  it('normalizes money and quantity helpers', () => {
    expect(normalizeRoundedMoney(12.345)).toBe(12.35);
    expect(normalizePositiveMoney(0)).toBeNull();
    expect(normalizePositiveMoney(12.345)).toBe(12.35);
    expect(normalizePositiveInteger(3, 1, 5)).toBe(3);
    expect(normalizePositiveInteger(0, 1, 5)).toBeNull();
  });
});
