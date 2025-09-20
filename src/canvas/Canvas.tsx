import React, { useMemo } from 'react';
import classNames from 'classnames';
import { GraphState, AppSettings, Interval } from '../model/types';
import { orderNodes } from '../model/graph';
import { BOX_WIDTH, EXCLUSION_OFFSET_X, EXCLUSION_WIDTH } from '../model/constants';
import {
  computeExclusionHeight,
  computeNodeHeight,
  getExclusionDisplayLines,
  getNodeDisplayLines,
  LINE_HEIGHT,
} from '../model/layout';

interface CanvasProps {
  graph: GraphState;
  settings: AppSettings;
  onSelect: (id: string | undefined) => void;
  onCreateBelow: (nodeId: string) => void;
  onBranch: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}

const CANVAS_MARGIN = 120;

interface CanvasMetrics {
  width: number;
  height: number;
  centerX: number;
  verticalOffset: number;
}
export const Canvas: React.FC<CanvasProps> = ({ graph, settings, onSelect, onCreateBelow, onBranch, onRemove }) => {
  const nodesOrdered = useMemo(() => orderNodes(graph), [graph]);

  const metrics = useMemo(() => {
    if (!nodesOrdered.length) {
      return {
        width: 960,
        height: CANVAS_MARGIN,
        centerX: 480,
        verticalOffset: CANVAS_MARGIN / 2,
        minX: 0,
      };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let maxBottom = 0;
    nodesOrdered.forEach((node) => {
      const center = node.position.x;
      const halfWidth = BOX_WIDTH / 2;
      const top = node.position.y;
      const bottom = top + computeNodeHeight(node);
      minX = Math.min(minX, center - halfWidth);
      maxX = Math.max(maxX, center + halfWidth);
      maxBottom = Math.max(maxBottom, bottom);
    });
    const width = Math.max(960, maxX - minX + CANVAS_MARGIN);
    const centerX = -minX + CANVAS_MARGIN / 2;
    const height = maxBottom + CANVAS_MARGIN;
    return {
      width,
      height,
      centerX,
      verticalOffset: CANVAS_MARGIN / 2,
      minX,
    };
  }, [nodesOrdered]);

const intervalEntries = useMemo(() => Object.values(graph.intervals), [graph.intervals]);

  return (
    <div className="canvas-container">
      <svg className="canvas-svg" width={metrics.width} height={metrics.height}>
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
        {intervalEntries.map((interval) =>
          renderInterval({
            interval,
            graph,
            settings,
            onSelect,
            metrics,
          })
        )}

        {nodesOrdered.map((node) =>
          renderNode({
            node,
            graph,
            onSelect,
            onCreateBelow,
            onBranch,
            onRemove,
            metrics,
          })
        )}
      </svg>
    </div>
  );
};

function shouldShowArrow(settings: AppSettings, interval: Interval) {
  return settings.arrowsGlobal && interval.arrow;
}

interface RenderIntervalProps {
  interval: Interval;
  graph: GraphState;
  settings: AppSettings;
  onSelect: (id: string | undefined) => void;
  metrics: CanvasMetrics;
}

function renderInterval({ interval, graph, settings, onSelect, metrics }: RenderIntervalProps) {
  const parent = graph.nodes[interval.parentId];
  const child = graph.nodes[interval.childId];
  if (!parent || !child) {
    return null;
  }

  const parentCenterX = metrics.centerX + parent.position.x;
  const childCenterX = metrics.centerX + child.position.x;
  const parentTopY = metrics.verticalOffset + parent.position.y;
  const childTopY = metrics.verticalOffset + child.position.y;
  const parentHeight = computeNodeHeight(parent);
  const parentBottomY = parentTopY + parentHeight;
  const childTop = childTopY;
  const isSelected = graph.selectedId === interval.id;
  const stroke = isSelected ? '#0057ff' : '#111';

  let path = '';
  let labelX = parentCenterX;
  let labelY = parentBottomY + (childTop - parentBottomY) / 2;

  if (Math.abs(parentCenterX - childCenterX) < 0.1) {
    path = `M ${parentCenterX} ${parentBottomY} L ${childCenterX} ${childTop}`;
  } else {
    const junctionY = parentBottomY + (childTop - parentBottomY) / 2;
    path = `M ${parentCenterX} ${parentBottomY} L ${parentCenterX} ${junctionY} L ${childCenterX} ${junctionY} L ${childCenterX} ${childTop}`;
    labelX = (parentCenterX + childCenterX) / 2;
    labelY = junctionY - 10;
  }

  const allowExclusion = (parent.childIds ?? []).length <= 2;

  return (
    <g
      key={interval.id}
      onClick={() => onSelect(interval.id)}
      className="canvas-interval"
      style={{ cursor: 'pointer' }}
    >
      <path
        d={path}
        stroke={stroke}
        fill="none"
        strokeWidth={isSelected ? 3 : 2}
        markerEnd={shouldShowArrow(settings, interval) ? 'url(#arrowhead)' : undefined}
      />
      {renderDeltaBadge(interval, labelX, labelY)}
      {renderExclusion({
        interval,
        parent,
        child,
        onSelect,
        isSelected,
        metrics,
        allowExclusion,
      })}
    </g>
  );
}

interface RenderNodeProps {
  node: GraphState['nodes'][string];
  graph: GraphState;
  onSelect: (id: string | undefined) => void;
  onCreateBelow: (nodeId: string) => void;
  onBranch: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  metrics: CanvasMetrics;
}

function renderNode({ node, graph, onSelect, onCreateBelow, onBranch, onRemove, metrics }: RenderNodeProps) {
  const nodeCenterX = metrics.centerX + node.position.x;
  const x = nodeCenterX - BOX_WIDTH / 2;
  const y = metrics.verticalOffset + node.position.y;
  const isSelected = graph.selectedId === node.id;
  const displayLines = getNodeDisplayLines(node);
  const boxHeight = computeNodeHeight(node);
  const isRoot = graph.startNodeId === node.id;

  const buttonSize = 28;
  const spacing = 6;
  const controls = [
    { label: '+', onClick: () => onCreateBelow(node.id), hidden: false },
    { label: '⎇', onClick: () => onBranch(node.id), hidden: false },
    { label: '−', onClick: () => onRemove(node.id), hidden: isRoot },
  ].filter((btn) => !btn.hidden);

  const controlsTotalWidth = controls.length * buttonSize + Math.max(0, controls.length - 1) * spacing;
  let controlX = nodeCenterX - controlsTotalWidth / 2;

  return (
    <g
      key={node.id}
      onClick={() => onSelect(node.id)}
      className={classNames('canvas-node', { selected: isSelected })}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={x}
        y={y}
        width={BOX_WIDTH}
        height={boxHeight}
        rx={8}
        ry={8}
        fill="#fff"
        stroke={isSelected ? '#0057ff' : '#111'}
        strokeWidth={isSelected ? 3 : 2}
      />
      {renderCenteredLines(displayLines, nodeCenterX, y, boxHeight, {
        textClass: 'node-text',
        countClass: 'node-count',
      })}
      {controls.map((btn) => {
        const currentX = controlX;
        controlX += buttonSize + spacing;
        const title = btn.label === '+' ? 'Add step' : btn.label === '⎇' ? 'Add branch' : 'Remove';
        return (
          <g
            key={btn.label}
            className="node-control"
            onClick={(event) => {
              event.stopPropagation();
              btn.onClick();
            }}
          >
            <title>{title}</title>
            <rect
              x={currentX}
              y={y + boxHeight + 12}
              width={buttonSize}
              height={buttonSize}
              rx={8}
              fill="#0057ff"
              stroke="#0057ff"
            />
            <text x={currentX + buttonSize / 2} y={y + boxHeight + 12 + buttonSize / 2 + 6} textAnchor="middle" fontSize={16} fill="#ffffff">
              {btn.label}
            </text>
          </g>
        );
      })}
    </g>
  );
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

interface RenderExclusionProps {
  interval: Interval;
  parent: GraphState['nodes'][string];
  child: GraphState['nodes'][string];
  onSelect: (id: string | undefined) => void;
  isSelected: boolean;
  metrics: CanvasMetrics;
  allowExclusion: boolean;
}

function renderExclusion({ interval, parent, child, onSelect, isSelected, metrics, allowExclusion }: RenderExclusionProps) {
  if (!allowExclusion) {
    return null;
  }
  const exclusion = interval.exclusion ?? {
    label: 'Excluded',
    total: null,
    reasons: [],
  };
  const lines = getExclusionDisplayLines(exclusion);
  if (!lines.length) {
    return null;
  }

  const parentCenterX = metrics.centerX + parent.position.x;
  const childCenterX = metrics.centerX + child.position.x;
  const childTopY = metrics.verticalOffset + child.position.y;
  const childHeight = computeNodeHeight(child);
  const midY = childTopY + childHeight / 2;
  const isLeft = childCenterX < parentCenterX;
  const highlightStroke = isSelected ? '#0057ff' : '#111';
  const strokeColor = '#111';

  let lineStartX: number;
  let lineEndX: number;
  let boxX: number;

  if (isLeft) {
    lineStartX = childCenterX - BOX_WIDTH / 2;
    lineEndX = lineStartX - EXCLUSION_OFFSET_X;
    boxX = lineEndX - EXCLUSION_WIDTH;
  } else {
    lineStartX = childCenterX + BOX_WIDTH / 2;
    lineEndX = lineStartX + EXCLUSION_OFFSET_X;
    boxX = lineEndX;
  }

  const exclusionHeight = computeExclusionHeight(exclusion);
  const boxY = midY - exclusionHeight / 2;
  const lineTargetX = isLeft ? lineEndX : boxX;

  return (
    <g
      className="exclusion"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(interval.id);
      }}
    >
      <line
        x1={lineStartX}
        y1={midY}
        x2={lineTargetX}
        y2={midY}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 2}
      />
      <rect
        x={boxX}
        y={boxY}
        width={EXCLUSION_WIDTH}
        height={exclusionHeight}
        rx={8}
        ry={8}
        fill="#fff"
        stroke={highlightStroke}
        strokeWidth={isSelected ? 3 : 2}
      />
      {renderCenteredLines(lines, boxX + EXCLUSION_WIDTH / 2, boxY, exclusionHeight, {
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
  const totalHeight = LINE_HEIGHT * sanitized.length;
  const startY = topY + containerHeight / 2 - totalHeight / 2 + 6;

  return (
    <text x={centerX} y={startY} className={classes.textClass} textAnchor="middle">
      {sanitized.map((line, index) => {
        const isCountLine = index === sanitized.length - 1 && line.startsWith('N =');
        return (
          <tspan
            key={index}
            x={centerX}
            dy={index === 0 ? 0 : LINE_HEIGHT}
            className={isCountLine ? classes.countClass : undefined}
          >
            {line}
          </tspan>
        );
      })}
    </text>
  );
}
