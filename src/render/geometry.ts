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
import { CANVAS_MARGIN, phaseGap, phaseRailWidth } from '../model/constants';

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

export function buildScene(graph: GraphState, settings: AppSettings): DiagramScene {
  const style = settings.style;
  const freeEdit = settings.freeEdit;
  const lineHeight = lineHeightFor(style);
  const ordered = orderNodes(graph);

  // 1. Bounding box of the auto-positioned diagram (in raw layout coords).
  let minX = Infinity;
  let maxX = -Infinity;
  let maxBottom = 0;
  let minNodeLeft = Infinity;
  const reach = style.exclusionGap + style.exclusionWidth;
  ordered.forEach((node) => {
    const width = nodeRenderWidth(node, style);
    const height = nodeRenderHeight(node, style, { freeEdit });
    const half = width / 2;
    minX = Math.min(minX, node.position.x - half - reach);
    maxX = Math.max(maxX, node.position.x + half + reach);
    maxBottom = Math.max(maxBottom, node.position.y + height);
    minNodeLeft = Math.min(minNodeLeft, node.position.x - half);
  });
  if (!Number.isFinite(minX)) {
    const fallback = style.boxWidth / 2 + reach;
    minX = -fallback;
    maxX = fallback;
    minNodeLeft = -style.boxWidth / 2;
    maxBottom = 0;
  }

  const railW = phaseRailWidth(style);
  const railGap = phaseGap(style);
  const hasPhases = (graph.phases ?? []).length > 0;
  if (hasPhases && Number.isFinite(minNodeLeft)) {
    minX = Math.min(minX, minNodeLeft - (railW + railGap));
  }

  const width = maxX - minX + CANVAS_MARGIN;
  const centerX = -minX + CANVAS_MARGIN / 2;
  const verticalOffset = CANVAS_MARGIN / 2;
  const height = maxBottom + CANVAS_MARGIN;

  const toX = (x: number) => centerX + x;
  const toY = (y: number) => verticalOffset + y;

  // 2. Nodes.
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

  // 3. Connectors + exclusions + deltas.
  const connectors: ConnectorVisual[] = [];
  const exclusions: ExclusionVisual[] = [];
  const deltas: DeltaVisual[] = [];

  Object.values(graph.intervals).forEach((interval) => {
    const parent = graph.nodes[interval.parentId];
    const child = graph.nodes[interval.childId];
    if (!parent || !child) {
      return;
    }
    const pcx = toX(parent.position.x);
    const ccx = toX(child.position.x);
    const parentBottom = toY(parent.position.y) + nodeRenderHeight(parent, style, { freeEdit });
    const childTop = toY(child.position.y);
    const showArrow = style.arrowheads && interval.arrow;

    const siblings = parent.childIds ?? [];
    const totalChildren = siblings.length;
    const childIndex = siblings.indexOf(child.id);
    const isBranch = totalChildren > 1;
    const aligned = Math.abs(pcx - ccx) < 0.5;
    const midY = (parentBottom + childTop) / 2;

    // Always-orthogonal routing.
    let path: string;
    let anchorX: number;
    if (aligned) {
      path = `M ${pcx} ${parentBottom} L ${pcx} ${childTop}`;
      anchorX = pcx;
    } else {
      path = `M ${pcx} ${parentBottom} L ${pcx} ${midY} L ${ccx} ${midY} L ${ccx} ${childTop}`;
      anchorX = ccx;
    }
    const anchorY = midY;
    connectors.push({ intervalId: interval.id, path, showArrow });

    const allowExclusion = totalChildren <= 1 || hasVisibleExclusion(interval);
    const side = resolveExclusionSide(
      parent.position.x,
      child.position.x,
      totalChildren,
      childIndex,
      branchSideOf(child)
    );

    if (allowExclusion && interval.exclusion) {
      const display = getExclusionDisplayContent(interval.exclusion, style, { freeEdit });
      if (display.lines.length) {
        const isLeft = side === 'left';
        const exHeight = computeExclusionHeight(interval.exclusion, style, { freeEdit });
        // Clear the main column by exclusionGap measured from the box edge, so
        // the exclusion box never overlaps the flow regardless of box width.
        const anchorHalf = Math.max(nodeRenderWidth(parent, style), nodeRenderWidth(child, style)) / 2;
        const boxX = isLeft
          ? anchorX - anchorHalf - style.exclusionGap - style.exclusionWidth
          : anchorX + anchorHalf + style.exclusionGap;
        const boxY = anchorY - exHeight / 2;
        const connectorTargetX = isLeft ? boxX + style.exclusionWidth : boxX;
        exclusions.push({
          intervalId: interval.id,
          x: boxX,
          y: boxY,
          width: style.exclusionWidth,
          height: exHeight,
          centerX: boxX + style.exclusionWidth / 2,
          connector: { x1: anchorX, y1: anchorY, x2: connectorTargetX, y2: anchorY },
          showArrow,
          lines: display.lines.map((text, index) => ({
            text,
            bold: display.totalLineIndex != null && index === display.totalLineIndex,
          })),
        });
      }
    }

    if (interval.delta && !freeEdit) {
      const deltaSide = side === 'left' ? 1 : -1; // place opposite the exclusion
      const offset = Math.max(nodeRenderWidth(parent, style), nodeRenderWidth(child, style)) / 2 + style.fontSize * 3;
      const deltaX = isBranch ? (pcx + ccx) / 2 : pcx + deltaSide * offset;
      const label = interval.delta > 0 ? `Δ +${interval.delta}` : `Δ ${interval.delta}`;
      deltas.push({ intervalId: interval.id, x: deltaX, y: anchorY, label });
    }
  });

  // 4. Phases on the left rail.
  const phaseAnchors = new Map<string, { top: number; bottom: number }>();
  ordered
    .filter((node) => node.column === 0)
    .forEach((node) => {
      const top = toY(node.position.y);
      phaseAnchors.set(node.id, { top, bottom: top + nodeRenderHeight(node, style, { freeEdit }) });
    });

  const phaseRailX = centerX + minNodeLeft - railGap - railW;
  const phases: PhaseVisual[] = [];
  if (hasPhases) {
    (graph.phases ?? []).forEach((phase) => {
      const start = phaseAnchors.get(phase.startNodeId);
      const end = phaseAnchors.get(phase.endNodeId);
      if (!start || !end) {
        return;
      }
      const topY = start.top;
      const bottomY = Math.max(end.bottom, topY + 1);
      const ph = bottomY - topY;
      const textX = phaseRailX + railW / 2;
      const textY = topY + ph / 2;
      const label = phase.label?.trim().length ? phase.label : 'Phase';
      phases.push({
        id: phase.id,
        phase,
        x: phaseRailX,
        y: topY,
        width: railW,
        height: ph,
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
