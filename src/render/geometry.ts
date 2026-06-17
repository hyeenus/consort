// Single source of geometric truth. Both the interactive canvas and the SVG/PNG
// export build their visuals from the scene produced here, so what you see is
// exactly what you publish.
import { AppSettings, GraphState, Interval, BoxNode, PhaseBox } from '../model/types';
import { orderNodes } from '../model/graph';
import {
  computeExclusionHeight,
  getExclusionDisplayContent,
  getNodeDisplayLines,
  nodeRenderHeight,
  nodeRenderWidth,
} from '../model/layout';
import { lineHeightFor } from '../model/style';
import { CANVAS_MARGIN, phaseGap, phaseNeatGap, phaseRailWidth } from '../model/constants';

export interface TextLine {
  text: string;
  bold: boolean;
}

export interface NodeVisual {
  id: string;
  node: BoxNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  lines: TextLine[];
  isRoot: boolean;
}

export interface ConnectorVisual {
  intervalId: string;
  path: string;
  showArrow: boolean;
}

export interface ExclusionVisual {
  intervalId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  lines: TextLine[];
  connector: { x1: number; y1: number; x2: number; y2: number };
  showArrow: boolean;
}

export interface DeltaVisual {
  intervalId: string;
  x: number;
  y: number;
  label: string;
}

export interface PhaseVisual {
  id: string;
  phase: PhaseBox;
  x: number;
  y: number;
  width: number;
  height: number;
  textX: number;
  textY: number;
  lines: string[];
}

export interface DiagramScene {
  width: number;
  height: number;
  lineHeight: number;
  nodes: NodeVisual[];
  connectors: ConnectorVisual[];
  exclusions: ExclusionVisual[];
  deltas: DeltaVisual[];
  phases: PhaseVisual[];
  phaseRailX: number;
}

function hasVisibleExclusion(interval: Interval): boolean {
  const exclusion = interval.exclusion;
  if (!exclusion) {
    return false;
  }
  if (exclusion.label && exclusion.label.trim() && exclusion.label.trim() !== 'Excluded') {
    return true;
  }
  if (exclusion.totalOverride && exclusion.totalOverride.trim().length > 0) {
    return true;
  }
  if (exclusion.total != null && exclusion.total !== 0) {
    return true;
  }
  return exclusion.reasons.some((reason) => {
    if (reason.kind === 'user') {
      return true;
    }
    if (reason.countOverride && reason.countOverride.trim().length > 0) {
      return true;
    }
    return reason.n != null && reason.n !== 0;
  });
}

function resolveExclusionSide(
  parentCenter: number,
  childCenter: number,
  totalChildren: number,
  childIndex: number,
  inheritedSide?: 'left' | 'right'
): 'left' | 'right' {
  if (inheritedSide) {
    return inheritedSide;
  }
  if (totalChildren > 1) {
    return childIndex < totalChildren / 2 ? 'left' : 'right';
  }
  if (childCenter < parentCenter - 0.1) {
    return 'left';
  }
  if (childCenter > parentCenter + 0.1) {
    return 'right';
  }
  return 'right';
}

/**
 * Vertical centre of the first line for a vertically-centred text block. Paired
 * with `dominant-baseline: central` on the text so the block is exactly centred.
 */
function firstLineCenterY(top: number, height: number, lineCount: number, lineHeight: number): number {
  const block = lineHeight * Math.max(1, lineCount);
  return top + height / 2 - block / 2 + lineHeight / 2;
}

function branchSideOf(node: BoxNode): 'left' | 'right' | undefined {
  return (node as unknown as { __branchSide?: 'left' | 'right' }).__branchSide;
}

// Per-interval geometry computed once in layout coordinates, then converted to
// absolute coordinates after the diagram extents (and so the centre) are known.
interface IntervalGeom {
  interval: Interval;
  showArrow: boolean;
  aligned: boolean;
  pcxL: number;
  ccxL: number;
  parentBottomL: number;
  childTopL: number;
  midYL: number;
  side: 'left' | 'right';
  isBranch: boolean;
  exclusion?: {
    lines: TextLine[];
    totalLineIndex: number | null;
    isLeft: boolean;
    boxLeftL: number;
    height: number;
    anchorXL: number;
    anchorYL: number;
  };
}

export function buildScene(graph: GraphState, settings: AppSettings): DiagramScene {
  const style = settings.style;
  const freeEdit = settings.freeEdit;
  const lineHeight = lineHeightFor(style);
  const ordered = orderNodes(graph);

  // --- Pass 1: node extents + per-interval geometry (all in layout coords) ---
  let minNodeLeft = Infinity;
  let maxNodeRight = -Infinity;
  let maxBottom = 0;
  ordered.forEach((node) => {
    const width = nodeRenderWidth(node, style);
    const height = nodeRenderHeight(node, style, { freeEdit });
    minNodeLeft = Math.min(minNodeLeft, node.position.x - width / 2);
    maxNodeRight = Math.max(maxNodeRight, node.position.x + width / 2);
    maxBottom = Math.max(maxBottom, node.position.y + height);
  });
  if (!Number.isFinite(minNodeLeft)) {
    minNodeLeft = -style.boxWidth / 2;
    maxNodeRight = style.boxWidth / 2;
    maxBottom = 0;
  }

  let exMinLeft = Infinity;
  let exMaxRight = -Infinity;
  const geoms: IntervalGeom[] = [];

  Object.values(graph.intervals).forEach((interval) => {
    const parent = graph.nodes[interval.parentId];
    const child = graph.nodes[interval.childId];
    if (!parent || !child) {
      return;
    }
    const parentHeight = nodeRenderHeight(parent, style, { freeEdit });
    const pcxL = parent.position.x;
    const ccxL = child.position.x;
    const parentBottomL = parent.position.y + parentHeight;
    const childTopL = child.position.y;
    const midYL = (parentBottomL + childTopL) / 2;
    const aligned = Math.abs(pcxL - ccxL) < 0.5;

    const siblings = parent.childIds ?? [];
    const totalChildren = siblings.length;
    const childIndex = siblings.indexOf(child.id);
    const isBranch = totalChildren > 1;
    const side = resolveExclusionSide(pcxL, ccxL, totalChildren, childIndex, branchSideOf(child));

    const geom: IntervalGeom = {
      interval,
      showArrow: style.arrowheads && interval.arrow,
      aligned,
      pcxL,
      ccxL,
      parentBottomL,
      childTopL,
      midYL,
      side,
      isBranch,
    };

    const allowExclusion = totalChildren <= 1 || hasVisibleExclusion(interval);
    if (allowExclusion && interval.exclusion) {
      const display = getExclusionDisplayContent(interval.exclusion, style, { freeEdit });
      if (display.lines.length) {
        const isLeft = side === 'left';
        const height = computeExclusionHeight(interval.exclusion, style, { freeEdit });
        const anchorXL = aligned ? pcxL : ccxL;
        const anchorHalf = Math.max(nodeRenderWidth(parent, style), nodeRenderWidth(child, style)) / 2;
        const boxLeftL = isLeft
          ? anchorXL - anchorHalf - style.exclusionGap - style.exclusionWidth
          : anchorXL + anchorHalf + style.exclusionGap;
        exMinLeft = Math.min(exMinLeft, boxLeftL);
        exMaxRight = Math.max(exMaxRight, boxLeftL + style.exclusionWidth);
        geom.exclusion = {
          lines: display.lines.map((text, index) => ({
            text,
            bold: display.totalLineIndex != null && index === display.totalLineIndex,
          })),
          totalLineIndex: display.totalLineIndex,
          isLeft,
          boxLeftL,
          height,
          anchorXL,
          anchorYL: midYL,
        };
      }
    }
    geoms.push(geom);
  });

  // --- Extents, phase rail placement, and the absolute transform ---
  const railW = phaseRailWidth(style);
  const railGap = phaseGap(style);
  const hasPhases = (graph.phases ?? []).length > 0;

  const leftmost = Math.min(minNodeLeft, exMinLeft);
  const rightmost = Math.max(maxNodeRight, exMaxRight);
  const railReserve = hasPhases ? railGap + railW : 0;
  const contentLeft = leftmost - railReserve;

  const width = rightmost - contentLeft + CANVAS_MARGIN;
  const centerX = -contentLeft + CANVAS_MARGIN / 2;
  const verticalOffset = CANVAS_MARGIN / 2;
  const height = maxBottom + CANVAS_MARGIN;
  const toX = (x: number) => centerX + x;
  const toY = (y: number) => verticalOffset + y;
  const phaseRailX = toX(leftmost) - railGap - railW;

  // --- Pass 2: build absolute visuals ---
  const nodes: NodeVisual[] = ordered.map((node) => {
    const w = nodeRenderWidth(node, style);
    const h = nodeRenderHeight(node, style, { freeEdit });
    const cx = toX(node.position.x);
    const rawLines = getNodeDisplayLines(node, style, { freeEdit });
    const lastIndex = node.hideCount ? -1 : rawLines.length - 1;
    return {
      id: node.id,
      node,
      x: cx - w / 2,
      y: toY(node.position.y),
      width: w,
      height: h,
      centerX: cx,
      isRoot: graph.startNodeId === node.id,
      lines: rawLines.map((text, index) => ({ text, bold: index === lastIndex && style.countWeight >= 600 })),
    };
  });

  const connectors: ConnectorVisual[] = [];
  const exclusions: ExclusionVisual[] = [];
  const deltas: DeltaVisual[] = [];

  geoms.forEach((geom) => {
    const pcx = toX(geom.pcxL);
    const ccx = toX(geom.ccxL);
    const parentBottom = toY(geom.parentBottomL);
    const childTop = toY(geom.childTopL);
    const midY = toY(geom.midYL);
    const path = geom.aligned
      ? `M ${pcx} ${parentBottom} L ${pcx} ${childTop}`
      : `M ${pcx} ${parentBottom} L ${pcx} ${midY} L ${ccx} ${midY} L ${ccx} ${childTop}`;
    connectors.push({ intervalId: geom.interval.id, path, showArrow: geom.showArrow });

    if (geom.exclusion) {
      const ex = geom.exclusion;
      const boxX = toX(ex.boxLeftL);
      const anchorX = toX(ex.anchorXL);
      const anchorY = toY(ex.anchorYL);
      const boxY = anchorY - ex.height / 2;
      const connectorTargetX = ex.isLeft ? boxX + style.exclusionWidth : boxX;
      exclusions.push({
        intervalId: geom.interval.id,
        x: boxX,
        y: boxY,
        width: style.exclusionWidth,
        height: ex.height,
        centerX: boxX + style.exclusionWidth / 2,
        connector: { x1: anchorX, y1: anchorY, x2: connectorTargetX, y2: anchorY },
        showArrow: geom.showArrow,
        lines: ex.lines,
      });
    }

    if (geom.interval.delta && !freeEdit) {
      const parent = graph.nodes[geom.interval.parentId];
      const child = graph.nodes[geom.interval.childId];
      const offset =
        Math.max(parent ? nodeRenderWidth(parent, style) : style.boxWidth, child ? nodeRenderWidth(child, style) : style.boxWidth) /
          2 +
        style.fontSize * 3;
      const deltaSide = geom.side === 'left' ? 1 : -1;
      const deltaX = geom.isBranch ? (pcx + ccx) / 2 : pcx + deltaSide * offset;
      const label = geom.interval.delta > 0 ? `Δ +${geom.interval.delta}` : `Δ ${geom.interval.delta}`;
      deltas.push({ intervalId: geom.interval.id, x: deltaX, y: midY, label });
    }
  });

  // --- Phases: taller bands that meet at the mid-gap between boxes ---
  const phases: PhaseVisual[] = [];
  if (hasPhases) {
    const mainNodes = ordered
      .filter((node) => node.column === 0)
      .sort((a, b) => a.position.y - b.position.y);
    const tops = mainNodes.map((node) => toY(node.position.y));
    const bottoms = mainNodes.map((node, index) => tops[index] + nodeRenderHeight(node, style, { freeEdit }));
    const indexOf = new Map(mainNodes.map((node, index) => [node.id, index] as const));
    const last = mainNodes.length - 1;
    const neatGap = phaseNeatGap(style);

    (graph.phases ?? []).forEach((phase) => {
      const si = indexOf.get(phase.startNodeId);
      const ei = indexOf.get(phase.endNodeId);
      if (si == null || ei == null) {
        return;
      }
      const topMode = phase.topMode ?? 'gap';
      const bottomMode = phase.bottomMode ?? 'gap';
      const topY =
        topMode === 'border' || si === 0 ? tops[si] : (bottoms[si - 1] + tops[si]) / 2 + neatGap / 2;
      const bottomY =
        bottomMode === 'border' || ei === last ? bottoms[ei] : (bottoms[ei] + tops[ei + 1]) / 2 - neatGap / 2;
      const finalBottom = Math.max(bottomY, topY + 1);
      const textX = phaseRailX + railW / 2;
      const textY = (topY + finalBottom) / 2;
      const label = phase.label?.trim().length ? phase.label : 'Phase';
      phases.push({
        id: phase.id,
        phase,
        x: phaseRailX,
        y: topY,
        width: railW,
        height: finalBottom - topY,
        textX,
        textY,
        lines: label.split(/\n+/),
      });
    });
  }

  return {
    width,
    height,
    lineHeight,
    nodes,
    connectors,
    exclusions,
    deltas,
    phases,
    phaseRailX,
  };
}

/** First-line centre helper exported for renderers. */
export { firstLineCenterY };
