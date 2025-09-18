import React, { useMemo } from 'react';
import classNames from 'classnames';
import { GraphState, AppSettings, Interval } from '../model/types';
import { orderNodes } from '../model/graph';
import { BOX_HEIGHT, BOX_WIDTH, EXCLUSION_OFFSET_X, EXCLUSION_WIDTH } from '../model/constants';
import { formatCount } from '../model/numbers';

interface CanvasProps {
  graph: GraphState;
  settings: AppSettings;
  onSelect: (id: string | undefined) => void;
  onCreateBelow: (nodeId: string) => void;
}

const CANVAS_MARGIN = 120;
const EXCLUSION_HEIGHT = 120;

export const Canvas: React.FC<CanvasProps> = ({ graph, settings, onSelect, onCreateBelow }) => {
  const nodesOrdered = useMemo(() => orderNodes(graph), [graph]);

  const height = nodesOrdered.length * (BOX_HEIGHT + 64) + CANVAS_MARGIN;
  const width = 960;
  const centerX = width / 3;

  const intervalEntries = useMemo(() => Object.values(graph.intervals), [graph.intervals]);

  return (
    <div className="canvas-container">
      <svg className="canvas-svg" width={width} height={height}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 z" fill="#111" />
          </marker>
        </defs>
        {intervalEntries.map((interval) => {
          const parent = graph.nodes[interval.parentId];
          const child = graph.nodes[interval.childId];
          if (!parent || !child) {
            return null;
          }
          const parentY = CANVAS_MARGIN / 2 + parent.position.y;
          const childY = CANVAS_MARGIN / 2 + child.position.y;
          const x = centerX;
          const top = parentY + BOX_HEIGHT;
          const bottom = childY;
          const midY = top + (bottom - top) / 2;
          const isSelected = graph.selectedId === interval.id;
          const stroke = isSelected ? '#0057ff' : '#111';

          return (
            <g key={interval.id} onClick={() => onSelect(interval.id)} className="canvas-interval">
              <line
                x1={x}
                y1={top}
                x2={x}
                y2={bottom}
                stroke={stroke}
                strokeWidth={isSelected ? 3 : 2}
                markerEnd={shouldShowArrow(settings, interval) ? 'url(#arrowhead)' : undefined}
              />
              {renderDeltaBadge(interval, x - 80, midY)}
              {renderExclusion(interval, x, midY, stroke, isSelected, onSelect)}
            </g>
          );
        })}

        {nodesOrdered.map((node) => {
          const x = centerX - BOX_WIDTH / 2;
          const y = CANVAS_MARGIN / 2 + node.position.y;
          const isSelected = graph.selectedId === node.id;
          const nodeLines = [...(node.textLines.length ? node.textLines : [''])];
          nodeLines.push(formatCount(node.n));
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} className={classNames('canvas-node', { selected: isSelected })}>
              <rect
                x={x}
                y={y}
                width={BOX_WIDTH}
                height={BOX_HEIGHT}
                rx={8}
                ry={8}
                fill="#fff"
                stroke={isSelected ? '#0057ff' : '#111'}
                strokeWidth={isSelected ? 3 : 2}
              />
              {renderCenteredLines(nodeLines, centerX, y, BOX_HEIGHT, {
                textClass: 'node-text',
                countClass: 'node-count',
              })}
              <g
                className="add-handle"
                onClick={(event) => {
                  event.stopPropagation();
                  onCreateBelow(node.id);
                }}
              >
                <rect
                  x={centerX - 16}
                  y={y + BOX_HEIGHT + 12}
                  width={32}
                  height={32}
                  rx={8}
                  fill="#0057ff"
                  stroke="#0057ff"
                />
                <text x={centerX} y={y + BOX_HEIGHT + 32} textAnchor="middle" fontSize={20} fill="#ffffff">
                  +
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

function shouldShowArrow(settings: AppSettings, interval: Interval) {
  return settings.arrowsGlobal && interval.arrow;
}

function renderDeltaBadge(interval: Interval, x: number, y: number) {
  if (!interval.delta) {
    return null;
  }
  const label = interval.delta > 0 ? `Δ = +${interval.delta}` : `Δ = ${interval.delta}`;
  return (
    <g className="delta-badge">
      <rect x={x - 32} y={y - 12} width={64} height={24} rx={12} fill="#d92c2c" />
      <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold">
        {label}
      </text>
    </g>
  );
}

function renderExclusion(
  interval: Interval,
  axisX: number,
  midY: number,
  stroke: string,
  isSelected: boolean,
  onSelect: (id: string | undefined) => void
) {
  const boxX = axisX + EXCLUSION_OFFSET_X;
  const boxY = midY - EXCLUSION_HEIGHT / 2;
  const exclusion = interval.exclusion ?? {
    label: 'Excluded',
    total: null,
    reasons: [],
  };
  const highlightStroke = isSelected ? '#0057ff' : '#111';

  const lines = buildExclusionLines(exclusion);

  return (
    <g
      className="exclusion"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(interval.id);
      }}
    >
      <line x1={axisX} y1={midY} x2={boxX} y2={midY} stroke={stroke} strokeWidth={isSelected ? 3 : 2} />
      <rect
        x={boxX}
        y={boxY}
        width={EXCLUSION_WIDTH}
        height={EXCLUSION_HEIGHT}
        rx={8}
        ry={8}
        fill="#fff"
        stroke={highlightStroke}
        strokeWidth={isSelected ? 3 : 2}
      />
      {renderCenteredLines(lines, boxX + EXCLUSION_WIDTH / 2, boxY, EXCLUSION_HEIGHT, {
        textClass: 'exclusion-text',
        countClass: 'node-count',
      })}
    </g>
  );
}

function renderCenteredLines(
  lines: string[],
  centerX: number,
  topY: number,
  containerHeight: number,
  classes: { textClass: string; countClass?: string }
) {
  const sanitized = lines.length ? lines : [''];
  const lineHeight = 20;
  const totalHeight = lineHeight * sanitized.length;
  const startY = topY + containerHeight / 2 - totalHeight / 2 + 6;

  return (
    <text x={centerX} y={startY} className={classes.textClass} textAnchor="middle">
      {sanitized.map((line, index) => {
        const isCountLine = index === sanitized.length - 1 && line.startsWith('N =');
        return (
          <tspan
            key={index}
            x={centerX}
            dy={index === 0 ? 0 : lineHeight}
            className={isCountLine ? classes.countClass : undefined}
          >
            {line}
          </tspan>
        );
      })}
    </text>
  );
}

function buildExclusionLines(exclusion: Interval['exclusion']) {
  if (!exclusion) {
    return ['Excluded', 'N = —'];
  }
  const lines: string[] = [];
  lines.push(exclusion.label || 'Excluded');
  if (!exclusion.reasons || exclusion.reasons.length === 0) {
    lines.push(formatCount(exclusion.total ?? null));
    return lines;
  }
  exclusion.reasons.forEach((reason) => {
    const reasonLabel = reason.label ? reason.label : '—';
    lines.push(`${reasonLabel}: ${formatReasonValue(reason.n ?? null)}`);
  });
  return lines;
}

function formatReasonValue(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return formatCount(value).replace('N = ', '');
}
