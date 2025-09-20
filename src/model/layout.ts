import { BoxNode, ExclusionBox, ExclusionReason, NodeId } from './types';
import { BOX_WIDTH } from './constants';
import { formatCount } from './numbers';

export const LINE_HEIGHT = 20;
export const NODE_MIN_HEIGHT = 120;
export const EXCLUSION_MIN_HEIGHT = 120;
export const LEVEL_GAP_Y = 64;
export const BRANCH_GAP_X = 80;
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
    if (exclusion?.total == null || exclusion.total === 0) {
      return [];
    }
    return [label, formatCount(exclusion.total)];
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

function ensureChildIds(node: BoxNode): NodeId[] {
  if (!node.childIds) {
    node.childIds = [];
  }
  return node.childIds;
}

export function layoutTree(
  nodes: Record<NodeId, BoxNode>,
  startNodeId: NodeId | null
): { order: NodeId[] } {
  if (!startNodeId || !nodes[startNodeId]) {
    return { order: [] };
  }

  const widths = new Map<NodeId, number>();

  const computeWidth = (nodeId: NodeId): number => {
    const node = nodes[nodeId];
    if (!node) {
      return 0;
    }
    const children = ensureChildIds(node);
    if (!children.length) {
      const width = BOX_WIDTH;
      widths.set(nodeId, width);
      return width;
    }
    let total = 0;
    children.forEach((childId, index) => {
      const childWidth = computeWidth(childId);
      if (index > 0) {
        total += BRANCH_GAP_X;
      }
      total += childWidth;
    });
    const width = Math.max(BOX_WIDTH, total);
    widths.set(nodeId, width);
    return width;
  };

  const order: NodeId[] = [];

  const assign = (nodeId: NodeId, center: number, currentY: number) => {
    const node = nodes[nodeId];
    if (!node) {
      return;
    }
    ensureChildIds(node);
    node.position.x = center;
    node.position.y = currentY;
    order.push(nodeId);
    const nodeHeight = computeNodeHeight(node);
    if (!node.childIds.length) {
      return;
    }
    const childWidths = node.childIds.map((childId) => widths.get(childId) ?? BOX_WIDTH);
    const totalWidth = childWidths.reduce((acc, value) => acc + value, 0) + BRANCH_GAP_X * (childWidths.length - 1);
    let start = center - totalWidth / 2;
    const nextY = currentY + nodeHeight + LEVEL_GAP_Y;
    node.childIds.forEach((childId, index) => {
      const childWidth = childWidths[index];
      const childCenter = start + childWidth / 2;
      assign(childId, childCenter, nextY);
      start += childWidth + BRANCH_GAP_X;
    });
  };

  computeWidth(startNodeId);
  assign(startNodeId, 0, 0);

  return { order };
}
