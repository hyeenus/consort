import { describe, expect, it } from 'vitest';
import { formatCount, formatInteger, parseCount } from '../model/numbers';
import { DEFAULT_STYLE, DiagramStyle } from '../model/style';

const styleN: DiagramStyle = { ...DEFAULT_STYLE, numberStyle: 'N', thousandsSep: 'space' };
const styleLower: DiagramStyle = { ...DEFAULT_STYLE, numberStyle: 'n', thousandsSep: 'space' };
const stylePlain: DiagramStyle = { ...DEFAULT_STYLE, numberStyle: 'plain', thousandsSep: 'comma' };

describe('formatCount', () => {
  it('formats with N and space separator', () => {
    expect(formatCount(12345, styleN)).toBe('N = 12 345');
  });

  it('supports lowercase n', () => {
    expect(formatCount(12345, styleLower)).toBe('n = 12 345');
  });

  it('supports plain numbers with comma separator', () => {
    expect(formatCount(12345, stylePlain)).toBe('12,345');
  });

  it('returns a dash placeholder for null', () => {
    expect(formatCount(null, styleN)).toBe('N = —');
  });
});

describe('formatInteger', () => {
  it('groups thousands with the chosen separator', () => {
    expect(formatInteger(1234567, 'space')).toBe('1 234 567');
    expect(formatInteger(1234567, 'comma')).toBe('1,234,567');
    expect(formatInteger(1234567, 'none')).toBe('1234567');
  });
});

describe('parseCount', () => {
  it('parses digits ignoring separators', () => {
    expect(parseCount('12 345')).toBe(12345);
  });

  it('returns null for invalid content', () => {
    expect(parseCount('abc')).toBeNull();
  });
});
