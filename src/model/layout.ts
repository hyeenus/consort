import { BoxNode, ExclusionBox, ExclusionReason, NodeId } from './types';
import {
  DiagramStyle,
  lineHeightFor,
  maxCharsFor,
  paddingYFor,
} from './style';
import { formatCount, formatNumber } from './numbers';

export interface LayoutOptions {
  freeEdit?: boolean;
}

export interface ExclusionDisplayContent {
  lines: string[];
  totalLineIndex: number | null;
}

// Internal layout annotations stashed on nodes (read by canvas + export). ----
interface LayoutAnnotated {
  __layoutWidth?: number;
  __layoutHeight?: number;
  __branchSide?: 'left' | 'right' | undefined;
}

function annotate(node: BoxNode): BoxNode & LayoutAnnotated {
  return node as BoxNode & LayoutAnnotated;
}

export function nodeRenderWidth(node: BoxNode, style: DiagramStyle): number {
  const override = node.widthOverride;
  if (override != null && override > 0) {
    return override;
  }
  return annotate(node).__layoutWidth ?? style.boxWidth;
}

export function nodeRenderHeight(node: BoxNode, style: DiagramStyle, options: LayoutOptions = {}): number {
  return annotate(node).__layoutHeight ?? computeNodeHeight(node, style, options);
}

// Text wrapping -----------------------------------------------------------

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
  const trimmed = line.replace(/\s+$/u, '');
  if (!trimmed.trim()) {
    return [''];
  }
  const words = trimmed.trim().split(/\s+/);
  const wrapped: string[] = [];
  let current = '';
  words.forEach((word) => {
    splitLongWord(word, maxChars).forEach((segment) => {
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

// Node content ------------------------------------------------------------

export function getNodeDisplayLines(node: BoxNode, style: DiagramStyle, options: LayoutOptions = {}): string[] {
  const width = nodeRenderWidth(node, style);
  const maxChars = maxCharsFor(width, style);
  const baseLines = node.textLines.length ? node.textLines : [''];
  const wrapped = wrapTextLines(baseLines, maxChars);
  if (node.hideCount) {
    return wrapped;
  }
  const countLine =
    options.freeEdit && node.countOverride != null
      ? node.countOverride
      : formatCount(node.n, style);
  return [...wrapped, countLine];
}

export function computeNodeHeight(node: BoxNode, style: DiagramStyle, options: LayoutOptions = {}): number {
  const lineHeight = lineHeightFor(style);
  const padY = paddingYFor(style);
  const lines = getNodeDisplayLines(node, style, options).length;
  const minHeight = lineHeight * 2 + padY * 2;
  return Math.max(minHeight, lines * lineHeight + padY * 2);
}

// Exclusion content -------------------------------------------------------

function getVisibleReasons(exclusion: ExclusionBox | undefined, options: LayoutOptions): ExclusionReason[] {
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

export function getExclusionDisplayContent(
  exclusion: ExclusionBox | undefined,
  style: DiagramStyle,
  options: LayoutOptions = {}
): ExclusionDisplayContent {
  const label = exclusion?.label ?? 'Excluded';
  const maxChars = maxCharsFor(style.exclusionWidth, style);
  const visibleReasons = getVisibleReasons(exclusion, options);
  const totalLine =
    options.freeEdit && exclusion?.totalOverride != null
      ? exclusion.totalOverride
      : formatCount(exclusion?.total ?? null, style);
  const hasTotalOverride = exclusion?.totalOverride != null && exclusion.totalOverride.trim().length > 0;
  const totalValue = exclusion?.total ?? null;
  const hasNumericTotal = totalValue != null && totalValue !== 0;
  const shouldShowTotal = !options.freeEdit || hasTotalOverride || hasNumericTotal;
  const totalIsZeroOrBlank = (totalValue == null || totalValue === 0) && !hasTotalOverride;

  if (!visibleReasons.length) {
    if (!shouldShowTotal || totalIsZeroOrBlank) {
      return { lines: [], totalLineIndex: null };
    }
    return { lines: wrapTextLines([label], maxChars).concat(totalLine), totalLineIndex: -1 };
  }

  const lines: string[] = wrapTextLines([label], maxChars);
  let totalLineIndex: number | null = null;
  if (shouldShowTotal) {
    totalLineIndex = lines.length;
    lines.push(totalLine);
  }
  visibleReasons.forEach((reason) => {
    const baseLabel = reason.label?.trim().length ? reason.label.trim() : '—';
    const hasReasonOverride =
      options.freeEdit && reason.countOverride != null && reason.countOverride.trim().length > 0;
    const countText = hasReasonOverride ? reason.countOverride! : formatNumber(reason.n ?? null, style);
    wrapTextLines([`${baseLabel}: ${countText}`], maxChars).forEach((segment) => lines.push(segment));
  });

  // -1 sentinel above means "the line right after the label block"; resolve it.
  if (totalLineIndex === -1) {
    totalLineIndex = wrapTextLines([label], maxChars).length;
  }
  return { lines, totalLineIndex };
}

export function getExclusionDisplayLines(
  exclusion: ExclusionBox | undefined,
  style: DiagramStyle,
  options: LayoutOptions = {}
): string[] {
  return getExclusionDisplayContent(exclusion, style, options).lines;
}

export function computeExclusionHeight(
  exclusion: ExclusionBox | undefined,
  style: DiagramStyle,
  options: LayoutOptions = {}
): number {
  const lineHeight = lineHeightFor(style);
  const padY = paddingYFor(style);
  const { lines } = getExclusionDisplayContent(exclusion, style, options);
  const minHeight = lineHeight * 2 + padY * 2;
  return Math.max(minHeight, lines.length * lineHeight + padY * 2);
}

// Tree layout -------------------------------------------------------------

function ensureChildIds(node: BoxNode): NodeId[] {
  if (!node.childIds) {
    node.childIds = [];
  }
  return node.childIds;
}

export function getNodeDimensions(
  node: BoxNode,
  style: DiagramStyle,
  options: LayoutOptions = {}
): { width: number; height: number } {
  const width = node.widthOverride != null && node.widthOverride > 0 ? node.widthOverride : style.boxWidth;
  return { width, height: computeNodeHeight(node, style, options) };
}

type BranchSide = 'left' | 'right' | undefined;

export function layoutTree(
  nodes: Record<NodeId, BoxNode>,
  startNodeId: NodeId | null,
  style: DiagramStyle,
  options: LayoutOptions = {}
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
    const { width: nodeWidth } = getNodeDimensions(node, style, options);
    if (!children.length) {
      widths.set(nodeId, nodeWidth);
      return nodeWidth;
    }
    let total = 0;
    children.forEach((childId, index) => {
      if (index > 0) {
        total += style.branchGap;
      }
      total += computeWidth(childId);
    });
    const width = Math.max(nodeWidth, total);
    widths.set(nodeId, width);
    return width;
  };

  const order: NodeId[] = [];
  const assign = (nodeId: NodeId, center: number, currentY: number, inheritedSide: BranchSide) => {
    const node = nodes[nodeId];
    if (!node) {
      return;
    }
    ensureChildIds(node);
    const { width: nodeWidth, height: nodeHeight } = getNodeDimensions(node, style, options);
    const annotated = annotate(node);
    annotated.__layoutWidth = nodeWidth;
    annotated.__layoutHeight = nodeHeight;
    annotated.__branchSide = inheritedSide;
    node.position.x = center;
    node.position.y = currentY;
    order.push(nodeId);
    if (!node.childIds.length) {
      return;
    }
    const childWidths = node.childIds.map((childId) => widths.get(childId) ?? style.boxWidth);
    const totalWidth =
      childWidths.reduce((acc, value) => acc + value, 0) + style.branchGap * (childWidths.length - 1);
    let start = center - totalWidth / 2;
    const nextY = currentY + nodeHeight + style.verticalGap;
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
      assign(childId, childCenter, nextY, childSide);
      start += childWidth + style.branchGap;
    });
  };

  computeWidth(startNodeId);
  assign(startNodeId, 0, 0, undefined);
  applyManualOffsets(nodes, startNodeId, order);

  return { order };
}

/**
 * Apply manual drag offsets on top of the auto-layout. A node's own offset is
 * added to it and propagated to its whole subtree, so dragging a parent moves
 * its descendants too, while nudging a leaf moves only that leaf.
 */
function applyManualOffsets(nodes: Record<NodeId, BoxNode>, startNodeId: NodeId, order: NodeId[]): void {
  const accumulated = new Map<NodeId, { x: number; y: number }>();
  const parentOf = new Map<NodeId, NodeId>();
  order.forEach((id) => {
    const node = nodes[id];
    node?.childIds?.forEach((childId) => parentOf.set(childId, id));
  });
  // order is DFS pre-order: parents always precede children.
  order.forEach((id) => {
    const node = nodes[id];
    if (!node) {
      return;
    }
    const parentId = parentOf.get(id);
    const inherited = parentId ? accumulated.get(parentId) ?? { x: 0, y: 0 } : { x: 0, y: 0 };
    const own = node.manualOffset ?? { x: 0, y: 0 };
    const total = { x: inherited.x + own.x, y: inherited.y + own.y };
    accumulated.set(id, total);
    node.position.x += total.x;
    node.position.y += total.y;
  });
}
