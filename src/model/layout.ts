import { BoxNode, ExclusionBox, ExclusionReason, NodeId, CountFormat } from './types';
import { BOX_WIDTH } from './constants';
import { formatCount, formatInteger } from './numbers';

export const LINE_HEIGHT = 20;
export const NODE_MIN_HEIGHT = 120;
export const EXCLUSION_MIN_HEIGHT = 120;
export const LEVEL_GAP_Y = 64;
export const BRANCH_GAP_X = 32;
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

export function getNodeDisplayLines(node: BoxNode, countFormat: CountFormat = 'upper'): string[] {
  const baseLines = node.textLines.length ? node.textLines : [''];
  const wrappedContent = wrapTextLines(baseLines, NODE_MAX_CHARS);
  return [...wrappedContent, formatCount(node.n, countFormat)];
}

export function computeNodeHeight(node: BoxNode, countFormat: CountFormat = 'upper'): number {
  const totalLines = getNodeDisplayLines(node, countFormat).length;
  return Math.max(NODE_MIN_HEIGHT, totalLines * LINE_HEIGHT + NODE_VERTICAL_PADDING);
}

function formatReasonValue(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return formatInteger(value);
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

export function getExclusionDisplayLines(exclusion?: ExclusionBox, countFormat: CountFormat = 'upper'): string[] {
  const label = exclusion?.label ?? 'Excluded';
  const visibleReasons = getVisibleReasons(exclusion);
  if (!visibleReasons.length) {
    if (exclusion?.total == null || exclusion.total === 0) {
      return [];
    }
    return [label, formatCount(exclusion.total, countFormat)];
  }

  const lines: string[] = [label];
  visibleReasons.forEach((reason) => {
    const prefix = reason.label ? `${reason.label}:` : '—:';
    const wrapped = wrapTextLines([`${prefix} ${formatReasonValue(reason.n ?? null)}`], EXCLUSION_MAX_CHARS);
    lines.push(...wrapped);
  });

  return lines.length ? lines : [label];
}

export function computeExclusionHeight(exclusion?: ExclusionBox, countFormat: CountFormat = 'upper'): number {
  const totalLines = getExclusionDisplayLines(exclusion, countFormat).length;
  return Math.max(EXCLUSION_MIN_HEIGHT, totalLines * LINE_HEIGHT + EXCLUSION_VERTICAL_PADDING);
}

function ensureChildIds(node: BoxNode): NodeId[] {
  if (!node.childIds) {
    node.childIds = [];
  }
  return node.childIds;
}

export function getNodeDimensions(node: BoxNode, parent?: BoxNode, countFormat: CountFormat = 'upper'): { width: number; height: number } {
  const baseHeight = computeNodeHeight(node, countFormat);
  if (parent && (parent.childIds?.length ?? 0) > 1) {
    const parentWidth = (parent as unknown as { __layoutWidth?: number }).__layoutWidth;
    const width = Math.min(parentWidth ?? BOX_WIDTH, BOX_WIDTH);
    return { width, height: baseHeight };
  }
  return { width: BOX_WIDTH, height: baseHeight };
}

type BranchSide = 'left' | 'right' | undefined;

export function layoutTree(
  nodes: Record<NodeId, BoxNode>,
  startNodeId: NodeId | null,
  countFormat: CountFormat = 'upper'
): { order: NodeId[] } {
  if (!startNodeId || !nodes[startNodeId]) {
    return { order: [] };
  }

  const widths = new Map<NodeId, number>();

  const computeWidth = (nodeId: NodeId, parentNode?: BoxNode): number => {
    const node = nodes[nodeId];
    if (!node) {
      return 0;
    }
    const children = ensureChildIds(node);
    const { width: nodeWidth } = getNodeDimensions(node, parentNode, countFormat);
    if (!children.length) {
      widths.set(nodeId, nodeWidth);
      return nodeWidth;
    }
    let total = 0;
    children.forEach((childId, index) => {
      const childWidth = computeWidth(childId, node);
      if (index > 0) {
        total += BRANCH_GAP_X;
      }
      total += childWidth;
    });
    const width = Math.max(nodeWidth, total);
    widths.set(nodeId, width);
    return width;
  };

  const order: NodeId[] = [];

  const assign = (
    nodeId: NodeId,
    center: number,
    currentY: number,
    parentNode?: BoxNode,
    inheritedSide: BranchSide = undefined
  ) => {
    const node = nodes[nodeId];
    if (!node) {
      return;
    }
    ensureChildIds(node);
    const { width: nodeWidth, height: nodeHeight } = getNodeDimensions(node, parentNode, countFormat);
    (node as unknown as { __layoutWidth?: number; __layoutHeight?: number }).__layoutWidth = nodeWidth;
    (node as unknown as { __layoutWidth?: number; __layoutHeight?: number }).__layoutHeight = nodeHeight;
    (node as unknown as { __branchSide?: BranchSide }).__branchSide = inheritedSide;
    node.position.x = center;
    node.position.y = currentY;
    order.push(nodeId);
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
      let childSide: BranchSide = inheritedSide;
      if (node.childIds.length > 1) {
        if (childCenter < center - 0.1) {
          childSide = 'left';
        } else if (childCenter > center + 0.1) {
          childSide = 'right';
        } else {
          childSide = inheritedSide ?? 'right';
        }
      }
      assign(childId, childCenter, nextY, node, childSide);
      start += childWidth + BRANCH_GAP_X;
    });
  };

  computeWidth(startNodeId, undefined);
  assign(startNodeId, 0, 0, undefined, undefined);

  return { order };
}
