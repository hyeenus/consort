import React, { useMemo } from 'react';
import classNames from 'classnames';
import { GraphState, AppSettings, Interval, CountFormat } from '../model/types';
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

function nodeWidth(node: GraphState['nodes'][string]): number {
  return (node as unknown as { __layoutWidth?: number }).__layoutWidth ?? BOX_WIDTH;
}

function nodeHeight(node: GraphState['nodes'][string], countFormat: CountFormat): number {
  return (node as unknown as { __layoutHeight?: number }).__layoutHeight ?? computeNodeHeight(node, countFormat);
}

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
    const exclusionReach = EXCLUSION_OFFSET_X + EXCLUSION_WIDTH;
    nodesOrdered.forEach((node) => {
      const width = nodeWidth(node);
      const height = nodeHeight(node, settings.countFormat);
      const center = node.position.x;
      const halfWidth = width / 2;
      const top = node.position.y;
      const bottom = top + height;
      minX = Math.min(minX, center - halfWidth - exclusionReach);
      maxX = Math.max(maxX, center + halfWidth + exclusionReach);
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
  }, [nodesOrdered, settings.countFormat]);

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
            settings,
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
  const parentHeightValue = nodeHeight(parent, settings.countFormat);
  const parentBottomY = parentTopY + parentHeightValue;
  const childTop = childTopY;
  const isSelected = graph.selectedId === interval.id;
  const stroke = isSelected ? '#0057ff' : '#111';

  const parentChildren = parent.childIds ?? [];
  const childIndex = parentChildren.indexOf(child.id);
  const totalChildren = parentChildren.length;
  const isBranchChild = totalChildren > 1;
  const isMiddleChild = childIndex > 0 && childIndex < totalChildren - 1;
  const allowExclusion = totalChildren <= 2 || !isMiddleChild;
  const parentWidth = nodeWidth(parent);
  const childWidth = nodeWidth(child);

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
  const safeTop = parentBottomY + 24;
  const safeBottom = childTop - 24;
  const deltaCenterY = Math.max(safeTop, Math.min(defaultAnchorY, safeBottom));
  let path = '';
  let anchorX = parentCenterX;
  let anchorY = defaultAnchorY;
  let deltaX = parentCenterX;
  const deltaY = deltaCenterY;

  if (isStraight) {
    path = `M ${parentCenterX} ${parentBottomY} L ${childCenterX} ${childTop}`;
    const deltaSide = exclusionSide === 'left' ? 'right' : 'left';
    const horizontalOffset = Math.max(parentWidth, childWidth) / 2 + 56;
    const multiplier = deltaSide === 'right' ? 1 : -1;
    deltaX = parentCenterX + multiplier * horizontalOffset;
  } else {
    const junctionY = defaultAnchorY;
    path = `M ${parentCenterX} ${parentBottomY} L ${parentCenterX} ${junctionY} L ${childCenterX} ${junctionY} L ${childCenterX} ${childTop}`;
    anchorX = childCenterX;
    anchorY = junctionY;
    deltaX = (parentCenterX + childCenterX) / 2;
  }

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
      {renderDeltaBadge(interval, deltaX, deltaY)}
      {renderExclusion({
        interval,
        onSelect,
        isSelected,
        allowExclusion,
        anchor: { x: anchorX, y: anchorY },
        showArrow: shouldShowArrow(settings, interval),
        side: exclusionSide,
        countFormat: settings.countFormat,
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
  settings: AppSettings;
}

function renderNode({ node, graph, onSelect, onCreateBelow, onBranch, onRemove, metrics, settings }: RenderNodeProps) {
  const nodeCenterX = metrics.centerX + node.position.x;
  const width = nodeWidth(node);
  const boxHeight = nodeHeight(node, settings.countFormat);
  const x = nodeCenterX - width / 2;
  const y = metrics.verticalOffset + node.position.y;
  const isSelected = graph.selectedId === node.id;
  const displayLines = getNodeDisplayLines(node, settings.countFormat);
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
        width={width}
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
  onSelect: (id: string | undefined) => void;
  isSelected: boolean;
  allowExclusion: boolean;
  anchor: { x: number; y: number };
  showArrow: boolean;
  side: 'left' | 'right';
  countFormat: CountFormat;
}

function renderExclusion({ interval, onSelect, isSelected, allowExclusion, anchor, showArrow, side, countFormat }: RenderExclusionProps) {
  if (!allowExclusion) {
    return null;
  }
  const exclusion = interval.exclusion ?? {
    label: 'Excluded',
    total: null,
    reasons: [],
  };
  const lines = getExclusionDisplayLines(exclusion, countFormat);
  if (!lines.length) {
    return null;
  }

  const isLeft = side === 'left';
  const highlightStroke = isSelected ? '#0057ff' : '#111';
  const strokeColor = '#111';

  const lineStartX = anchor.x;
  const lineStartY = anchor.y;
  const lineEndX = isLeft ? lineStartX - EXCLUSION_OFFSET_X : lineStartX + EXCLUSION_OFFSET_X;
  const boxX = isLeft ? lineEndX - EXCLUSION_WIDTH : lineEndX;

  const exclusionHeight = computeExclusionHeight(exclusion, countFormat);
  const boxY = lineStartY - exclusionHeight / 2;
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
        y1={lineStartY}
        x2={lineTargetX}
        y2={lineStartY}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 2}
        markerEnd={showArrow ? 'url(#arrowhead)' : undefined}
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
        const isCountLine =
          index === sanitized.length - 1 && (line.startsWith('N =') || line.startsWith('(n =') || line.startsWith('(N ='));
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
