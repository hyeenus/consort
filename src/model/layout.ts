import { BoxNode, ExclusionBox, ExclusionReason } from './types';
import { formatCount } from './numbers';

export const LINE_HEIGHT = 20;
export const NODE_MIN_HEIGHT = 120;
export const EXCLUSION_MIN_HEIGHT = 120;
const NODE_VERTICAL_PADDING = 32;
const EXCLUSION_VERTICAL_PADDING = 32;
const NODE_MAX_CHARS = 26;
const EXCLUSION_MAX_CHARS = 22;

function splitLongWord(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) {
    return [word];
  }
  const chunks: string[] = [];
  for (let index = 0; index < word.length; index += maxChars) {
    chunks.push(word.slice(index, index + maxChars));
  }
  return chunks;
}

function wrapLine(line: string, maxChars: number): string[] {
  const trimmed = line.trim();
  if (!trimmed) {
    return [''];
  }
  const words = trimmed.split(/\s+/);
  const wrapped: string[] = [];
  let current = '';

  words.forEach((word) => {
    const segments = splitLongWord(word, maxChars);
    segments.forEach((segment) => {
      if (!current) {
        current = segment;
      } else if (`${current} ${segment}`.length <= maxChars) {
        current = `${current} ${segment}`;
      } else {
        wrapped.push(current);
        current = segment;
      }
    });
  });

  if (current) {
    wrapped.push(current);
  }

  return wrapped.length ? wrapped : [''];
}

export function wrapTextLines(lines: string[], maxChars: number): string[] {
  const wrapped: string[] = [];
  lines.forEach((line) => {
    wrapLine(line, maxChars).forEach((segment) => wrapped.push(segment));
  });
  return wrapped.length ? wrapped : [''];
}

export function getNodeDisplayLines(node: BoxNode): string[] {
  const baseLines = node.textLines.length ? node.textLines : [''];
  const wrappedContent = wrapTextLines(baseLines, NODE_MAX_CHARS);
  return [...wrappedContent, formatCount(node.n)];
}

export function computeNodeHeight(node: BoxNode): number {
  const totalLines = getNodeDisplayLines(node).length;
  return Math.max(NODE_MIN_HEIGHT, totalLines * LINE_HEIGHT + NODE_VERTICAL_PADDING);
}

function formatReasonValue(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return formatCount(value).replace('N = ', '');
}

function getVisibleReasons(exclusion?: ExclusionBox): ExclusionReason[] {
  const reasons = exclusion?.reasons ?? [];
  return reasons.filter((reason) => {
    if (reason.kind === 'auto') {
      return reason.n != null && reason.n !== 0;
    }
    return true;
  });
}

export function getExclusionDisplayLines(exclusion?: ExclusionBox): string[] {
  const label = exclusion?.label ?? 'Excluded';
  const visibleReasons = getVisibleReasons(exclusion);
  if (!visibleReasons.length) {
    return [label, formatCount(exclusion?.total ?? null)];
  }

  const lines: string[] = [label];
  visibleReasons.forEach((reason) => {
    const prefix = reason.label ? `${reason.label}:` : '—:';
    const wrapped = wrapTextLines([`${prefix} ${formatReasonValue(reason.n ?? null)}`], EXCLUSION_MAX_CHARS);
    lines.push(...wrapped);
  });

  return lines.length ? lines : [label];
}

export function computeExclusionHeight(exclusion?: ExclusionBox): number {
  const totalLines = getExclusionDisplayLines(exclusion).length;
  return Math.max(EXCLUSION_MIN_HEIGHT, totalLines * LINE_HEIGHT + EXCLUSION_VERTICAL_PADDING);
}
