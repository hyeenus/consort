import { AppSettings, GraphState } from '../model/types';
import { orderNodes } from '../model/graph';
import { BOX_WIDTH, EXCLUSION_OFFSET_X, EXCLUSION_WIDTH, PHASE_GAP, PHASE_WIDTH } from '../model/constants';
import {
  computeExclusionHeight,
  computeNodeHeight,
  getExclusionDisplayContent,
  getNodeDisplayLines,
  LINE_HEIGHT,
} from '../model/layout';

const CANVAS_MARGIN = 120;

function hasVisibleExclusion(interval: GraphState['intervals'][string]): boolean {
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
    const threshold = totalChildren / 2;
    return childIndex < threshold ? 'left' : 'right';
  }
  if (childCenter < parentCenter - 0.1) {
    return 'left';
  }
  if (childCenter > parentCenter + 0.1) {
    return 'right';
  }
  return 'right';
}

function computeLeftExclusionBound(graph: GraphState, settings: AppSettings): number | undefined {
  let minLeft: number | undefined;
  Object.values(graph.intervals).forEach((interval) => {
    const parent = graph.nodes[interval.parentId];
    const child = graph.nodes[interval.childId];
    if (!parent || !child) {
      return;
    }
    const parentChildren = parent.childIds ?? [];
    const totalChildren = parentChildren.length;
    const childIndex = parentChildren.indexOf(child.id);
    const isBranchChild = totalChildren > 1;
    const allowExclusion = totalChildren <= 1 || hasVisibleExclusion(interval);
    if (!allowExclusion) {
      return;
    }
    const exclusion = interval.exclusion ?? { label: 'Excluded', total: null, reasons: [] };
    const display = getExclusionDisplayContent(exclusion, settings.countFormat, { freeEdit: settings.freeEdit });
    if (!display.lines.length) {
      return;
    }
    const inheritedSide = (child as unknown as { __branchSide?: 'left' | 'right' }).__branchSide;
    const side = resolveExclusionSide(parent.position.x, child.position.x, totalChildren, childIndex, inheritedSide);
    if (side !== 'left') {
      return;
    }
    const isStraight = !isBranchChild || Math.abs(parent.position.x - child.position.x) < 0.1;
    const anchorX = isStraight ? parent.position.x : child.position.x;
    const boxLeft = anchorX - EXCLUSION_OFFSET_X - EXCLUSION_WIDTH;
    minLeft = minLeft === undefined ? boxLeft : Math.min(minLeft, boxLeft);
  });
  return minLeft;
}

export function generateSvg(graph: GraphState, settings: AppSettings): string {
  const nodesOrdered = orderNodes(graph);
  let minX = Infinity;
  let maxX = -Infinity;
  let maxBottom = 0;
  let minNodeLeft = Infinity;
  const exclusionReach = EXCLUSION_OFFSET_X + EXCLUSION_WIDTH;
  nodesOrdered.forEach((node) => {
    const center = node.position.x;
    const halfWidth = BOX_WIDTH / 2;
    const top = node.position.y;
    const bottom = top + computeNodeHeight(node, settings.countFormat, { freeEdit: settings.freeEdit });
    minX = Math.min(minX, center - halfWidth - exclusionReach);
    maxX = Math.max(maxX, center + halfWidth + exclusionReach);
    maxBottom = Math.max(maxBottom, bottom);
    minNodeLeft = Math.min(minNodeLeft, center - halfWidth);
  });
  if (!Number.isFinite(minX)) {
    const fallbackHalf = BOX_WIDTH / 2 + exclusionReach;
    minX = -fallbackHalf;
    maxX = fallbackHalf;
  }
  if (!Number.isFinite(minNodeLeft)) {
    minNodeLeft = -BOX_WIDTH / 2;
  }
  if (Number.isFinite(minNodeLeft)) {
    minX = Math.min(minX, minNodeLeft - (PHASE_WIDTH + PHASE_GAP));
  }
  const width = Math.max(960, maxX - minX + CANVAS_MARGIN);
  const centerX = -minX + CANVAS_MARGIN / 2;
  const verticalOffset = CANVAS_MARGIN / 2;
  const height = maxBottom + CANVAS_MARGIN;
  const leftExclusionBound = computeLeftExclusionBound(graph, settings);
  const diagramLeft = leftExclusionBound !== undefined ? Math.min(minNodeLeft, leftExclusionBound) : minNodeLeft;
  const phaseRailX = centerX + diagramLeft - PHASE_GAP - PHASE_WIDTH;

  const svgParts: string[] = [];

  svgParts.push(
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">`
  );

  svgParts.push(
    '<defs>',
    '<marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">',
    '<path d="M0,0 L6,3 L0,6 z" fill="#111111" />',
    '</marker>',
    '</defs>'
  );

  Object.values(graph.intervals).forEach((interval) => {
    const parent = graph.nodes[interval.parentId];
    const child = graph.nodes[interval.childId];
    if (!parent || !child) {
      return;
    }
    const parentCenterX = centerX + parent.position.x;
    const childCenterX = centerX + child.position.x;
    const parentTopY = verticalOffset + parent.position.y;
    const childTopY = verticalOffset + child.position.y;
    const parentHeight = computeNodeHeight(parent, settings.countFormat, { freeEdit: settings.freeEdit });
    const parentBottomY = parentTopY + parentHeight;
    const childTop = childTopY;
    const showArrow = settings.arrowsGlobal && interval.arrow;

    const parentChildren = parent.childIds ?? [];
    const childIndex = parentChildren.indexOf(child.id);
    const totalChildren = parentChildren.length;
    const isBranchChild = totalChildren > 1;
    const hasVisibleExclusion = (() => {
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
      if (
        exclusion.reasons.some((reason) => {
          if (reason.kind === 'user') {
            return true;
          }
          if (reason.countOverride && reason.countOverride.trim().length > 0) {
            return true;
          }
          return reason.n != null && reason.n !== 0;
        })
      ) {
        return true;
      }
      return false;
    })();
    const allowExclusion = totalChildren <= 1 || hasVisibleExclusion;
    const inheritedSide = (child as unknown as { __branchSide?: 'left' | 'right' }).__branchSide;
    const determineExclusionSide = (): 'left' | 'right' => {
      if (inheritedSide) {
        return inheritedSide;
      }
      if (isBranchChild) {
        const threshold = totalChildren / 2;
        return childIndex < threshold ? 'left' : 'right';
      }
      if (childCenterX < parentCenterX - 0.1) {
        return 'left';
      }
      if (childCenterX > parentCenterX + 0.1) {
        return 'right';
      }
      return 'right';
    };

    const exclusionSide = determineExclusionSide();

    const isStraight = !isBranchChild || Math.abs(parentCenterX - childCenterX) < 0.1;
    const gap = Math.max(0, childTop - parentBottomY);
    const defaultAnchorY = parentBottomY + gap / 2;
    let anchorX = parentCenterX;
    let anchorY = defaultAnchorY;

    if (isStraight) {
      svgParts.push(
        `<line x1="${parentCenterX}" y1="${parentBottomY}" x2="${childCenterX}" y2="${childTop}" stroke="#111111" stroke-width="2"${
          showArrow ? ' marker-end="url(#arrowhead)"' : ''
        } />`
      );
    } else {
      const junctionY = defaultAnchorY;
      svgParts.push(
        `<path d="M ${parentCenterX} ${parentBottomY} L ${parentCenterX} ${junctionY} L ${childCenterX} ${junctionY} L ${childCenterX} ${childTop}" stroke="#111111" fill="none" stroke-width="2"${
          showArrow ? ' marker-end="url(#arrowhead)"' : ''
        } />`
      );
      anchorX = childCenterX;
      anchorY = junctionY;
    }

    if (!allowExclusion) {
      return;
    }

    const exclusion = interval.exclusion ?? { label: 'Excluded', total: null, reasons: [] };
    const exclusionDisplay = getExclusionDisplayContent(exclusion, settings.countFormat, {
      freeEdit: settings.freeEdit,
    });
    const exclusionLines = exclusionDisplay.lines;
    if (!exclusionLines.length) {
      return;
    }

    const isLeft = exclusionSide === 'left';
    const lineEndX = isLeft ? anchorX - EXCLUSION_OFFSET_X : anchorX + EXCLUSION_OFFSET_X;
    const boxX = isLeft ? lineEndX - EXCLUSION_WIDTH : lineEndX;
    const exclusionHeight = computeExclusionHeight(exclusion, settings.countFormat, { freeEdit: settings.freeEdit });
    const boxY = anchorY - exclusionHeight / 2;
    const exclusionStartY = boxY + exclusionHeight / 2 - (LINE_HEIGHT * exclusionLines.length) / 2 + 6;
    const lineTargetX = isLeft ? lineEndX : boxX;

    svgParts.push(
      `<line x1="${anchorX}" y1="${anchorY}" x2="${lineTargetX}" y2="${anchorY}" stroke="#111111" stroke-width="2"${
        showArrow ? ' marker-end="url(#arrowhead)"' : ''
      } />`,
      `<rect x="${boxX}" y="${boxY}" width="${EXCLUSION_WIDTH}" height="${exclusionHeight}" rx="8" ry="8" fill="#ffffff" stroke="#111111" stroke-width="2" />`,
      `<text x="${boxX + EXCLUSION_WIDTH / 2}" y="${exclusionStartY}" fill="#111111" font-family="system-ui, sans-serif" font-size="16" text-anchor="middle">`
    );
    const countLineIndex = exclusionDisplay.totalLineIndex;
    exclusionLines.forEach((line, index) => {
      const dy = index === 0 ? 0 : LINE_HEIGHT;
      const isCountLine = countLineIndex != null && index === countLineIndex;
      svgParts.push(
        `<tspan x="${boxX + EXCLUSION_WIDTH / 2}" dy="${dy}"${isCountLine ? ' font-weight="600"' : ''}>${escapeText(
          line
        )}</tspan>`
      );
    });
    svgParts.push('</text>');
  });

  nodesOrdered.forEach((node) => {
    const x = centerX + node.position.x - BOX_WIDTH / 2;
    const y = verticalOffset + node.position.y;
    const nodeHeight = computeNodeHeight(node, settings.countFormat, { freeEdit: settings.freeEdit });
    svgParts.push(
      `<rect x="${x}" y="${y}" width="${BOX_WIDTH}" height="${nodeHeight}" rx="8" ry="8" fill="#ffffff" stroke="#111111" stroke-width="2" />`
    );
    const nodeLines = getNodeDisplayLines(node, settings.countFormat, { freeEdit: settings.freeEdit });
    const totalHeight = LINE_HEIGHT * nodeLines.length;
    const startY = y + nodeHeight / 2 - totalHeight / 2 + 6;
    svgParts.push(`<text x="${x + BOX_WIDTH / 2}" y="${startY}" fill="#111111" font-family="system-ui, sans-serif" font-size="16" text-anchor="middle">`);
    nodeLines.forEach((line, index) => {
      const dy = index === 0 ? 0 : LINE_HEIGHT;
      const isCountLine = index === nodeLines.length - 1;
      svgParts.push(
        `<tspan x="${x + BOX_WIDTH / 2}" dy="${dy}"${isCountLine ? ' font-weight="600"' : ''}>${escapeText(
          line
        )}</tspan>`
      );
    });
    svgParts.push('</text>');
  });

  const anchorMap = new Map(
    nodesOrdered
      .filter((node) => node.column === 0)
      .map((node) => {
        const top = verticalOffset + node.position.y;
        const bottom = top + computeNodeHeight(node, settings.countFormat, { freeEdit: settings.freeEdit });
        return [node.id, { top, bottom }] as const;
      })
  );

  (graph.phases ?? []).forEach((phase) => {
    const start = anchorMap.get(phase.startNodeId);
    const end = anchorMap.get(phase.endNodeId);
    if (!start || !end) {
      return;
    }
    const topY = start.top;
    const bottomY = Math.max(end.bottom, topY + 1);
    const phaseHeight = bottomY - topY;
    const textX = phaseRailX + PHASE_WIDTH / 2;
    const textY = topY + phaseHeight / 2;
    const label = phase.label?.trim().length ? phase.label : 'Phase';
    const lines = label.split(/\n+/);

    svgParts.push(
      `<rect x="${phaseRailX}" y="${topY}" width="${PHASE_WIDTH}" height="${phaseHeight}" rx="8" ry="8" fill="#ffffff" stroke="#111111" stroke-width="2" />`,
      `<text x="${textX}" y="${textY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#111111" transform="rotate(-90 ${textX} ${textY})">`
    );
    lines.forEach((line, index) => {
      const dy = index === 0 ? 0 : LINE_HEIGHT;
      svgParts.push(`<tspan x="${textX}" dy="${dy}">${escapeText(line)}</tspan>`);
    });
    svgParts.push('</text>');
  });

  svgParts.push('</svg>');
  return svgParts.join('');
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
