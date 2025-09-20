import { AppSettings, GraphState } from '../model/types';
import { orderNodes } from '../model/graph';
import { BOX_WIDTH, EXCLUSION_OFFSET_X, EXCLUSION_WIDTH } from '../model/constants';
import {
  computeExclusionHeight,
  computeNodeHeight,
  getExclusionDisplayLines,
  getNodeDisplayLines,
  LINE_HEIGHT,
} from '../model/layout';

const CANVAS_MARGIN = 120;

export function generateSvg(graph: GraphState, settings: AppSettings): string {
  const nodesOrdered = orderNodes(graph);
  let minX = Infinity;
  let maxX = -Infinity;
  let maxBottom = 0;
  const exclusionReach = EXCLUSION_OFFSET_X + EXCLUSION_WIDTH;
  nodesOrdered.forEach((node) => {
    const center = node.position.x;
    const halfWidth = BOX_WIDTH / 2;
    const top = node.position.y;
    const bottom = top + computeNodeHeight(node);
    minX = Math.min(minX, center - halfWidth - exclusionReach);
    maxX = Math.max(maxX, center + halfWidth + exclusionReach);
    maxBottom = Math.max(maxBottom, bottom);
  });
  if (!Number.isFinite(minX)) {
    const fallbackHalf = BOX_WIDTH / 2 + exclusionReach;
    minX = -fallbackHalf;
    maxX = fallbackHalf;
  }
  const width = Math.max(960, maxX - minX + CANVAS_MARGIN);
  const centerX = -minX + CANVAS_MARGIN / 2;
  const verticalOffset = CANVAS_MARGIN / 2;
  const height = maxBottom + CANVAS_MARGIN;

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
    const parentHeight = computeNodeHeight(parent);
    const parentBottomY = parentTopY + parentHeight;
    const childTop = childTopY;
    const showArrow = settings.arrowsGlobal && interval.arrow;

    const isStraight = Math.abs(parentCenterX - childCenterX) < 0.1;
    let anchorX = parentCenterX;
    let anchorY = parentBottomY + (childTop - parentBottomY) / 2;
    let deltaOffsetX = -60;

    if (isStraight) {
      svgParts.push(
        `<line x1="${parentCenterX}" y1="${parentBottomY}" x2="${childCenterX}" y2="${childTop}" stroke="#111111" stroke-width="2"${
          showArrow ? ' marker-end="url(#arrowhead)"' : ''
        } />`
      );
    } else {
      const junctionY = parentBottomY + (childTop - parentBottomY) / 2;
      svgParts.push(
        `<path d="M ${parentCenterX} ${parentBottomY} L ${parentCenterX} ${junctionY} L ${childCenterX} ${junctionY} L ${childCenterX} ${childTop}" stroke="#111111" fill="none" stroke-width="2"${
          showArrow ? ' marker-end="url(#arrowhead)"' : ''
        } />`
      );
      anchorX = parentCenterX;
      anchorY = junctionY;
      deltaOffsetX = childCenterX > parentCenterX ? 60 : -60;
    }

    if (interval.delta) {
      const deltaX = anchorX + deltaOffsetX;
      const deltaY = anchorY - 10;
      const label = interval.delta > 0 ? `Δ = +${interval.delta}` : `Δ = ${interval.delta}`;
      svgParts.push(
        `<g class="delta-badge"><rect x="${deltaX - 32}" y="${deltaY - 12}" width="64" height="24" rx="12" fill="#d92c2c" />` +
          `<text x="${deltaX}" y="${deltaY + 4}" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">${label}</text></g>`
      );
    }

    const allowExclusion = (parent.childIds ?? []).length <= 2;
    if (!allowExclusion) {
      return;
    }

    const exclusion = interval.exclusion ?? { label: 'Excluded', total: null, reasons: [] };
    const exclusionLines = getExclusionDisplayLines(exclusion);
    if (!exclusionLines.length) {
      return;
    }

    const isLeft = childCenterX < parentCenterX;
    const lineEndX = isLeft ? anchorX - EXCLUSION_OFFSET_X : anchorX + EXCLUSION_OFFSET_X;
    const boxX = isLeft ? lineEndX - EXCLUSION_WIDTH : lineEndX;
    const exclusionHeight = computeExclusionHeight(exclusion);
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
    exclusionLines.forEach((line, index) => {
      const dy = index === 0 ? 0 : LINE_HEIGHT;
      const isCountLine = line.startsWith('N =');
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
    const nodeHeight = computeNodeHeight(node);
    svgParts.push(
      `<rect x="${x}" y="${y}" width="${BOX_WIDTH}" height="${nodeHeight}" rx="8" ry="8" fill="#ffffff" stroke="#111111" stroke-width="2" />`
    );
    const nodeLines = getNodeDisplayLines(node);
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
