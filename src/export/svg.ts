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
  const lastNode = nodesOrdered[nodesOrdered.length - 1];
  const height = lastNode
    ? CANVAS_MARGIN + lastNode.position.y + computeNodeHeight(lastNode)
    : CANVAS_MARGIN;
  const width = 960;
  const centerX = width / 3;

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
    const parentY = CANVAS_MARGIN / 2 + parent.position.y;
    const childY = CANVAS_MARGIN / 2 + child.position.y;
    const parentHeight = computeNodeHeight(parent);
    const axisX = centerX;
    const top = parentY + parentHeight;
    const bottom = childY;
    const midY = top + (bottom - top) / 2;
    const showArrow = settings.arrowsGlobal && interval.arrow;

    svgParts.push(
      `<line x1="${axisX}" y1="${top}" x2="${axisX}" y2="${bottom}" stroke="#111111" stroke-width="2"${
        showArrow ? ' marker-end="url(#arrowhead)"' : ''
      } />`
    );

    const boxX = axisX + EXCLUSION_OFFSET_X;
    const exclusion = interval.exclusion ?? { label: 'Excluded', total: null, reasons: [] };
    const exclusionHeight = computeExclusionHeight(exclusion);
    const exclusionLines = getExclusionDisplayLines(exclusion);
    const exclusionTotalHeight = LINE_HEIGHT * exclusionLines.length;
    const boxY = midY - exclusionHeight / 2;
    const exclusionStartY = boxY + exclusionHeight / 2 - exclusionTotalHeight / 2 + 6;

    svgParts.push(
      `<line x1="${axisX}" y1="${midY}" x2="${boxX}" y2="${midY}" stroke="#111111" stroke-width="2"${
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
    const x = centerX - BOX_WIDTH / 2;
    const y = CANVAS_MARGIN / 2 + node.position.y;
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
