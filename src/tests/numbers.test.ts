import { describe, expect, it } from 'vitest';
import { formatCount, parseCount } from '../model/numbers';

describe('formatCount', () => {
  it('formats numbers with spaces every three digits', () => {
    expect(formatCount(12345)).toBe('N = 12 345');
  });

  it('returns dash placeholder for null', () => {
    expect(formatCount(null)).toBe('N = —');
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
