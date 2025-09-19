import { AppSettings, ExclusionBox, GraphState } from '../model/types';
import { orderNodes } from '../model/graph';
import { BOX_HEIGHT, BOX_WIDTH, EXCLUSION_OFFSET_X, EXCLUSION_WIDTH } from '../model/constants';
import { formatCount } from '../model/numbers';

const CANVAS_MARGIN = 120;
const EXCLUSION_HEIGHT = 120;

export function generateSvg(graph: GraphState, settings: AppSettings): string {
  const nodesOrdered = orderNodes(graph);
  const height = nodesOrdered.length * (BOX_HEIGHT + 64) + CANVAS_MARGIN;
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
    const axisX = centerX;
    const top = parentY + BOX_HEIGHT;
    const bottom = childY;
    const midY = top + (bottom - top) / 2;
    const showArrow = settings.arrowsGlobal && interval.arrow;

    svgParts.push(
      `<line x1="${axisX}" y1="${top}" x2="${axisX}" y2="${bottom}" stroke="#111111" stroke-width="2"${
        showArrow ? ' marker-end="url(#arrowhead)"' : ''
      } />`
    );

    const boxX = axisX + EXCLUSION_OFFSET_X;
    const boxY = midY - EXCLUSION_HEIGHT / 2;
    const exclusion = interval.exclusion ?? { label: 'Excluded', total: null, reasons: [] };
    const exclusionLines = buildExclusionLines(exclusion);
    const exclusionLineHeight = 20;
    const exclusionTotalHeight = exclusionLineHeight * exclusionLines.length;
    const exclusionStartY = boxY + EXCLUSION_HEIGHT / 2 - exclusionTotalHeight / 2 + 6;

    svgParts.push(
      `<line x1="${axisX}" y1="${midY}" x2="${boxX}" y2="${midY}" stroke="#111111" stroke-width="2"${
        showArrow ? ' marker-end="url(#arrowhead)"' : ''
      } />`,
      `<rect x="${boxX}" y="${boxY}" width="${EXCLUSION_WIDTH}" height="${EXCLUSION_HEIGHT}" rx="8" ry="8" fill="#ffffff" stroke="#111111" stroke-width="2" />`,
      `<text x="${boxX + EXCLUSION_WIDTH / 2}" y="${exclusionStartY}" fill="#111111" font-family="system-ui, sans-serif" font-size="16" text-anchor="middle">`
    );
    exclusionLines.forEach((line, index) => {
      const dy = index === 0 ? 0 : exclusionLineHeight;
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
    svgParts.push(
      `<rect x="${x}" y="${y}" width="${BOX_WIDTH}" height="${BOX_HEIGHT}" rx="8" ry="8" fill="#ffffff" stroke="#111111" stroke-width="2" />`
    );
    const nodeLines = [...(node.textLines.length ? node.textLines : ['']), formatCount(node.n)];
    const lineHeight = 20;
    const totalHeight = lineHeight * nodeLines.length;
    const startY = y + BOX_HEIGHT / 2 - totalHeight / 2 + 6;
    svgParts.push(`<text x="${x + BOX_WIDTH / 2}" y="${startY}" fill="#111111" font-family="system-ui, sans-serif" font-size="16" text-anchor="middle">`);
    nodeLines.forEach((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
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

function buildExclusionLines(exclusion: ExclusionBox): string[] {
  const lines: string[] = [];
  lines.push(exclusion.label || 'Excluded');
  const visibleReasons = (exclusion.reasons ?? []).filter((reason) => {
    if (reason.kind === 'auto') {
      return reason.n != null && reason.n !== 0;
    }
    return true;
  });
  if (!visibleReasons.length) {
    lines.push(formatCount(exclusion.total ?? null));
    return lines;
  }
  visibleReasons.forEach((reason) => {
    const label = reason.label || '—';
    const value = formatReasonValue(reason.n ?? null);
    lines.push(`${label}: ${value}`);
  });
  return lines;
}

function formatReasonValue(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return formatCount(value).replace('N = ', '');
}
