import { BoxNode, ExclusionBox, ExclusionReason, NodeId, CountFormat } from './types';
import { BOX_WIDTH } from './constants';
import { formatCount } from './numbers';

export const LINE_HEIGHT = 20;
export const NODE_MIN_HEIGHT = 120;
export const EXCLUSION_MIN_HEIGHT = 120;
export const LEVEL_GAP_Y = 64;
export const BRANCH_GAP_X = 32;
const NODE_VERTICAL_PADDING = 32;
const EXCLUSION_VERTICAL_PADDING = 32;
const NODE_MAX_CHARS = 26;
const EXCLUSION_MAX_CHARS = 22;

interface DisplayOptions {
  freeEdit?: boolean;
}

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

export function getNodeDisplayLines(
  node: BoxNode,
  countFormat: CountFormat = 'upper',
  options: DisplayOptions = {}
): string[] {
  const baseLines = node.textLines.length ? node.textLines : [''];
  const wrappedContent = wrapTextLines(baseLines, NODE_MAX_CHARS);
  const countLine =
    options.freeEdit && node.countOverride !== undefined && node.countOverride !== null
      ? node.countOverride
      : formatCount(node.n, countFormat);
  return [...wrappedContent, countLine];
}

export function computeNodeHeight(
  node: BoxNode,
  countFormat: CountFormat = 'upper',
  options: DisplayOptions = {}
): number {
  const totalLines = getNodeDisplayLines(node, countFormat, options).length;
  return Math.max(NODE_MIN_HEIGHT, totalLines * LINE_HEIGHT + NODE_VERTICAL_PADDING);
}

function getVisibleReasons(exclusion: ExclusionBox | undefined, options: DisplayOptions): ExclusionReason[] {
  const reasons = exclusion?.reasons ?? [];
  return reasons.filter((reason) => {
    if (reason.kind === 'auto') {
      if (options.freeEdit && reason.countOverride != null) {
        return reason.countOverride.trim().length > 0;
      }
      return reason.n != null && reason.n !== 0;
    }
    return true;
  });
}

export function getExclusionDisplayLines(
  exclusion: ExclusionBox | undefined,
  countFormat: CountFormat = 'upper',
  options: DisplayOptions = {}
): string[] {
  const label = exclusion?.label ?? 'Excluded';
  const visibleReasons = getVisibleReasons(exclusion, options);
  const totalOverridePresent = options.freeEdit && exclusion?.totalOverride !== undefined && exclusion.totalOverride !== null;
  const hasComputedTotal = exclusion?.total != null;
  const hasDisplayableTotal = options.freeEdit
    ? totalOverridePresent || hasComputedTotal
    : exclusion?.total != null && exclusion.total !== 0;

  if (!visibleReasons.length && !hasDisplayableTotal) {
    return [];
  }

  const lines: string[] = [label];
  if (totalOverridePresent || hasComputedTotal || visibleReasons.length) {
    const totalLine =
      totalOverridePresent && exclusion
        ? exclusion.totalOverride ?? ''
        : formatCount(exclusion?.total ?? null, countFormat);
    lines.push(totalLine);
  }

  visibleReasons.forEach((reason) => {
    const labelText = reason.label && reason.label.trim().length > 0 ? reason.label : '—';
    const hasOverride = options.freeEdit && reason.countOverride !== undefined && reason.countOverride !== null;
    const valueText = hasOverride ? reason.countOverride ?? '' : formatCount(reason.n ?? null, countFormat);
    const countSegment = hasOverride
      ? valueText
      : countFormat === 'upper'
      ? `(${valueText})`
      : valueText;
    const reasonLine = labelText ? `${labelText} ${countSegment}` : countSegment;
    const wrapped = wrapTextLines([reasonLine], EXCLUSION_MAX_CHARS);
    lines.push(...wrapped);
  });

  return lines;
}

export function computeExclusionHeight(
  exclusion: ExclusionBox | undefined,
  countFormat: CountFormat = 'upper',
  options: DisplayOptions = {}
): number {
  const totalLines = getExclusionDisplayLines(exclusion, countFormat, options).length;
  return Math.max(EXCLUSION_MIN_HEIGHT, totalLines * LINE_HEIGHT + EXCLUSION_VERTICAL_PADDING);
}

function ensureChildIds(node: BoxNode): NodeId[] {
  if (!node.childIds) {
    node.childIds = [];
  }
  return node.childIds;
}

export function getNodeDimensions(
  node: BoxNode,
  parent: BoxNode | undefined,
  countFormat: CountFormat = 'upper',
  options: DisplayOptions = {}
): { width: number; height: number } {
  const baseHeight = computeNodeHeight(node, countFormat, options);
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
  countFormat: CountFormat = 'upper',
  options: DisplayOptions = {}
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
    const { width: nodeWidth } = getNodeDimensions(node, parentNode, countFormat, options);
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
    const { width: nodeWidth, height: nodeHeight } = getNodeDimensions(node, parentNode, countFormat, options);
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
