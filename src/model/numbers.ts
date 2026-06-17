import { DiagramStyle, NumberStyle, ThousandsSep } from './style';

const SEPARATORS: Record<ThousandsSep, string> = {
  space: ' ', // regular space — CONSORT convention 12 345
  comma: ',',
  period: '.',
  none: '',
};

export function formatInteger(n: number | null, sep: ThousandsSep = 'space'): string {
  if (n === null || Number.isNaN(n)) {
    return '—';
  }
  const separator = SEPARATORS[sep] ?? SEPARATORS.space;
  const negative = n < 0;
  const digits = Math.abs(Math.trunc(n)).toString().split('');
  const out: string[] = [];
  let counter = 0;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    out.unshift(digits[i]);
    counter += 1;
    if (counter === 3 && i !== 0 && separator) {
      out.unshift(separator);
      counter = 0;
    }
  }
  return `${negative ? '-' : ''}${out.join('')}`;
}

function prefixFor(numberStyle: NumberStyle): string {
  switch (numberStyle) {
    case 'n':
      return 'n = ';
    case 'plain':
      return '';
    case 'N':
    default:
      return 'N = ';
  }
}

/** Format a count line according to the active diagram style. */
export function formatCount(n: number | null, style: DiagramStyle): string {
  const value = formatInteger(n, style.thousandsSep);
  return `${prefixFor(style.numberStyle)}${value}`;
}

/** Format only the numeric portion (used inside exclusion reason rows). */
export function formatNumber(n: number | null, style: DiagramStyle): string {
  return formatInteger(n, style.thousandsSep);
}

export function parseCount(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const digitsOnly = trimmed.replace(/[^0-9-]/g, '');
  if (!digitsOnly.length || digitsOnly === '-') {
    return null;
  }
  const value = Number(digitsOnly);
  return Number.isNaN(value) ? null : value;
}
