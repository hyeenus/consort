import { CountFormat } from './types';

const DEFAULT_LOCALE = 'en-space';

const separators: Record<string, string> = {
  'en-space': ' ',
};

export function formatInteger(n: number | null): string {
  if (n === null || Number.isNaN(n)) {
    return '—';
  }
  const sep = separators[DEFAULT_LOCALE];
  const parts = Math.trunc(n)
    .toString()
    .split('');
  const out: string[] = [];
  let counter = 0;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    out.unshift(parts[i]);
    counter += 1;
    if (counter === 3 && i !== 0) {
      out.unshift(sep);
      counter = 0;
    }
  }
  return out.join('');
}

export function formatCount(n: number | null, format: CountFormat = 'upper'): string {
  const value = formatInteger(n);
  if (format === 'parenthetical') {
    return `(n = ${value})`;
  }
  return `N = ${value}`;
}

export function parseCount(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const digitsOnly = trimmed.replace(/[^0-9-]/g, '');
  if (!digitsOnly.length) {
    return null;
  }
  const value = Number(digitsOnly);
  if (Number.isNaN(value)) {
    return null;
  }
  return value;
}
