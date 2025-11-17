import React, { useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { GraphState, AppSettings, Interval, CountFormat, PhaseBox, NodeId } from '../model/types';
import { orderNodes } from '../model/graph';
import { BOX_WIDTH, EXCLUSION_OFFSET_X, EXCLUSION_WIDTH, PHASE_GAP, PHASE_WIDTH } from '../model/constants';
import {
  computeExclusionHeight,
  computeNodeHeight,
  getExclusionDisplayContent,
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
  onAdjustPhase: (phaseId: string, startNodeId: string, endNodeId: string) => void;
}

const CANVAS_MARGIN = 120;

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

function nodeWidth(node: GraphState['nodes'][string]): number {
  return (node as unknown as { __layoutWidth?: number }).__layoutWidth ?? BOX_WIDTH;
}

function nodeHeight(node: GraphState['nodes'][string], settings: AppSettings): number {
  return (
    (node as unknown as { __layoutHeight?: number }).__layoutHeight ??
    computeNodeHeight(node, settings.countFormat, { freeEdit: settings.freeEdit })
  );
}

interface CanvasMetrics {
  width: number;
  height: number;
  centerX: number;
  verticalOffset: number;
  minNodeLeft: number;
}
export const Canvas: React.FC<CanvasProps> = ({
  graph,
  settings,
  onSelect,
  onCreateBelow,
  onBranch,
  onRemove,
  onAdjustPhase,
}) => {
  const nodesOrdered = useMemo(() => orderNodes(graph), [graph]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<{
    phaseId: string;
    handle: 'top' | 'bottom';
    pointerId: number;
    startNodeId: NodeId;
    endNodeId: NodeId;
  } | null>(null);

  const metrics = useMemo(() => {
    if (!nodesOrdered.length) {
      return {
        width: 960,
        height: CANVAS_MARGIN,
        centerX: 480,
        verticalOffset: CANVAS_MARGIN / 2,
        minX: 0,
        minNodeLeft: -BOX_WIDTH / 2,
      };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let maxBottom = 0;
    let minNodeLeft = Infinity;
    const exclusionReach = EXCLUSION_OFFSET_X + EXCLUSION_WIDTH;
    nodesOrdered.forEach((node) => {
      const width = nodeWidth(node);
      const height = nodeHeight(node, settings);
      const center = node.position.x;
      const halfWidth = width / 2;
      const top = node.position.y;
      const bottom = top + height;
      minX = Math.min(minX, center - halfWidth - exclusionReach);
      maxX = Math.max(maxX, center + halfWidth + exclusionReach);
      maxBottom = Math.max(maxBottom, bottom);
      minNodeLeft = Math.min(minNodeLeft, center - halfWidth);
    });
    if (Number.isFinite(minNodeLeft)) {
      minX = Math.min(minX, minNodeLeft - (PHASE_WIDTH + PHASE_GAP));
    }
    const width = Math.max(960, maxX - minX + CANVAS_MARGIN);
    const centerX = -minX + CANVAS_MARGIN / 2;
    const height = maxBottom + CANVAS_MARGIN;
    return {
      width,
      height,
      centerX,
      verticalOffset: CANVAS_MARGIN / 2,
      minX,
      minNodeLeft: Number.isFinite(minNodeLeft) ? minNodeLeft : -BOX_WIDTH / 2,
    };
  }, [nodesOrdered, settings.countFormat]);

const intervalEntries = useMemo(() => Object.values(graph.intervals), [graph.intervals]);

  const phaseAnchors = useMemo(() => {
    const anchorMap = new Map<NodeId, { top: number; bottom: number }>();
    nodesOrdered
      .filter((node) => node.column === 0)
      .forEach((node) => {
        const top = metrics.verticalOffset + node.position.y;
        const bottom = top + nodeHeight(node, settings);
        anchorMap.set(node.id, { top, bottom });
      });
    return anchorMap;
  }, [metrics.verticalOffset, nodesOrdered, settings]);

  const leftExclusionBound = useMemo(() => computeLeftExclusionBound(graph, settings), [graph, settings.countFormat, settings.freeEdit]);

  const phaseRailX = useMemo(() => {
    const diagramLeft = leftExclusionBound !== undefined ? Math.min(metrics.minNodeLeft, leftExclusionBound) : metrics.minNodeLeft;
    const offset = metrics.centerX + diagramLeft - PHASE_GAP - PHASE_WIDTH;
    return Number.isFinite(offset) ? offset : metrics.centerX - PHASE_WIDTH - PHASE_GAP;
  }, [leftExclusionBound, metrics.centerX, metrics.minNodeLeft]);

  const snapNodeId = (value: number, mode: 'top' | 'bottom'): NodeId | undefined => {
    const entries = [...phaseAnchors.entries()];
    if (!entries.length) {
      return undefined;
    }
    let bestId = entries[0][0];
    let bestDiff = Math.abs(value - (mode === 'top' ? entries[0][1].top : entries[0][1].bottom));
    for (let index = 1; index < entries.length; index += 1) {
      const [id, anchor] = entries[index];
      const target = mode === 'top' ? anchor.top : anchor.bottom;
      const diff = Math.abs(value - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestId = id;
      }
    }
    return bestId;
  };

  const getPointerY = (event: React.PointerEvent<SVGRectElement>): number => {
    const svgElement = svgRef.current;
    if (!svgElement) {
      return 0;
    }
    const bounds = svgElement.getBoundingClientRect();
    return event.clientY - bounds.top;
  };

  const handleDragMove = (event: React.PointerEvent<SVGRectElement>) => {
    const pointerId = event.pointerId;
    event.preventDefault();
    const pointerY = getPointerY(event);
    setDragState((state) => {
      if (!state || state.pointerId !== pointerId) {
        return state;
      }
      const snappedId = snapNodeId(pointerY, state.handle);
      if (!snappedId) {
        return state;
      }
      if (state.handle === 'top') {
        const endAnchor = phaseAnchors.get(state.endNodeId);
        const snappedAnchor = phaseAnchors.get(snappedId);
        if (endAnchor && snappedAnchor && snappedAnchor.top > endAnchor.bottom) {
          return state;
        }
        if (snappedId === state.startNodeId) {
          return state;
        }
        return { ...state, startNodeId: snappedId };
      }
      const startAnchor = phaseAnchors.get(state.startNodeId);
      const snappedAnchor = phaseAnchors.get(snappedId);
      if (startAnchor && snappedAnchor && snappedAnchor.bottom < startAnchor.top) {
        return state;
      }
      if (snappedId === state.endNodeId) {
        return state;
      }
      return { ...state, endNodeId: snappedId };
    });
  };

  const handleDragEnd = (event: React.PointerEvent<SVGRectElement>) => {
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    setDragState((state) => {
      if (!state || state.pointerId !== pointerId) {
        return state;
      }
      target.releasePointerCapture(pointerId);
      onAdjustPhase(state.phaseId, state.startNodeId, state.endNodeId);
      return null;
    });
  };

  return (
    <div className="canvas-container">
      <svg ref={svgRef} className="canvas-svg" width={metrics.width} height={metrics.height}>
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

        {renderPhases({
          graph,
          onSelect,
          railX: phaseRailX,
          anchors: phaseAnchors,
          dragState,
          onHandlePointerDown: (phase, handle) => (event) => {
            event.stopPropagation();
            event.preventDefault();
            const target = event.currentTarget;
            target.setPointerCapture(event.pointerId);
            const activePhase = phase;
            if (!activePhase) {
              return;
            }
            onSelect(activePhase.id);
            setDragState({
              phaseId: activePhase.id,
              handle,
              pointerId: event.pointerId,
              startNodeId: dragState?.phaseId === activePhase.id ? dragState.startNodeId : activePhase.startNodeId,
              endNodeId: dragState?.phaseId === activePhase.id ? dragState.endNodeId : activePhase.endNodeId,
            });
          },
          onHandlePointerMove: handleDragMove,
          onHandlePointerUp: handleDragEnd,
        })}

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
  const parentHeightValue = nodeHeight(parent, settings);
  const parentBottomY = parentTopY + parentHeightValue;
  const childTop = childTopY;
  const isSelected = graph.selectedId === interval.id;
  const stroke = isSelected ? '#0057ff' : '#111';

  const parentChildren = parent.childIds ?? [];
  const childIndex = parentChildren.indexOf(child.id);
  const totalChildren = parentChildren.length;
  const isBranchChild = totalChildren > 1;
  const visibleExclusion = hasVisibleExclusion(interval);
  const allowExclusion = totalChildren <= 1 || visibleExclusion;
  const parentWidth = nodeWidth(parent);
  const childWidth = nodeWidth(child);

  const inheritedSide = (child as unknown as { __branchSide?: 'left' | 'right' }).__branchSide;
  const exclusionSide = resolveExclusionSide(parent.position.x, child.position.x, totalChildren, childIndex, inheritedSide);

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
      {renderDeltaBadge(interval, deltaX, deltaY, settings.freeEdit)}
      {renderExclusion({
        interval,
        onSelect,
        isSelected,
        allowExclusion,
        anchor: { x: anchorX, y: anchorY },
        showArrow: shouldShowArrow(settings, interval),
        side: exclusionSide,
        countFormat: settings.countFormat,
        freeEdit: settings.freeEdit,
      })}
    </g>
  );
}

const PHASE_HANDLE_SIZE = 12;

type PhaseAnchorsMap = Map<NodeId, { top: number; bottom: number }>;

interface RenderPhasesProps {
  graph: GraphState;
  onSelect: (id: string | undefined) => void;
  railX: number;
  anchors: PhaseAnchorsMap;
  dragState: {
    phaseId: string;
    handle: 'top' | 'bottom';
    pointerId: number;
    startNodeId: NodeId;
    endNodeId: NodeId;
  } | null;
  onHandlePointerDown: (phase: PhaseBox, handle: 'top' | 'bottom') => (event: React.PointerEvent<SVGRectElement>) => void;
  onHandlePointerMove: (event: React.PointerEvent<SVGRectElement>) => void;
  onHandlePointerUp: (event: React.PointerEvent<SVGRectElement>) => void;
}

function renderPhases({
  graph,
  onSelect,
  railX,
  anchors,
  dragState,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
}: RenderPhasesProps) {
  const phases = graph.phases ?? [];
  if (!phases.length || anchors.size === 0) {
    return null;
  }
  return phases.map((phase) => {
    const activeState = dragState && dragState.phaseId === phase.id ? dragState : null;
    const startAnchor = anchors.get(activeState?.startNodeId ?? phase.startNodeId);
    const endAnchor = anchors.get(activeState?.endNodeId ?? phase.endNodeId);
    if (!startAnchor || !endAnchor) {
      return null;
    }
    const topY = startAnchor.top;
    const bottomY = Math.max(endAnchor.bottom, topY + 1);
    const height = bottomY - topY;
    const isSelected = graph.selectedId === phase.id;
    const rectX = railX;
    const rectWidth = PHASE_WIDTH;
    const textCenterX = rectX + rectWidth / 2;
    const textCenterY = topY + height / 2;
    const label = phase.label?.trim().length ? phase.label : 'Phase';
    const lines = label.split(/\n+/);

    return (
      <g
        key={phase.id}
        className={classNames('phase-box', { selected: isSelected })}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(phase.id);
        }}
      >
        <rect
          x={rectX}
          y={topY}
          width={rectWidth}
          height={height}
          rx={8}
          ry={8}
          fill="#fff"
          stroke={isSelected ? '#0057ff' : '#111'}
          strokeWidth={isSelected ? 3 : 2}
        />
        <text
          className="phase-text"
          x={textCenterX}
          y={textCenterY}
          textAnchor="middle"
          transform={`rotate(-90 ${textCenterX} ${textCenterY})`}
        >
          {lines.map((line, index) => (
            <tspan key={index} x={textCenterX} dy={index === 0 ? 0 : LINE_HEIGHT}>
              {line}
            </tspan>
          ))}
        </text>
        {isSelected && (
          <>
            <rect
              className="phase-handle"
              x={textCenterX - PHASE_HANDLE_SIZE / 2}
              y={topY - PHASE_HANDLE_SIZE / 2}
              width={PHASE_HANDLE_SIZE}
              height={PHASE_HANDLE_SIZE}
              onPointerDown={onHandlePointerDown(phase, 'top')}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
            />
            <rect
              className="phase-handle"
              x={textCenterX - PHASE_HANDLE_SIZE / 2}
              y={bottomY - PHASE_HANDLE_SIZE / 2}
              width={PHASE_HANDLE_SIZE}
              height={PHASE_HANDLE_SIZE}
              onPointerDown={onHandlePointerDown(phase, 'bottom')}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
            />
          </>
        )}
      </g>
    );
  });
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
  const boxHeight = nodeHeight(node, settings);
  const x = nodeCenterX - width / 2;
  const y = metrics.verticalOffset + node.position.y;
  const isSelected = graph.selectedId === node.id;
  const displayLines = getNodeDisplayLines(node, settings.countFormat, { freeEdit: settings.freeEdit });
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

function renderDeltaBadge(interval: Interval, x: number, y: number, freeEdit: boolean) {
  if (!interval.delta || freeEdit) {
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
  freeEdit: boolean;
}

function renderExclusion({
  interval,
  onSelect,
  isSelected,
  allowExclusion,
  anchor,
  showArrow,
  side,
  countFormat,
  freeEdit,
}: RenderExclusionProps) {
  if (!allowExclusion) {
    return null;
  }
  const exclusion = interval.exclusion ?? {
    label: 'Excluded',
    total: null,
    reasons: [],
  };
  const display = getExclusionDisplayContent(exclusion, countFormat, { freeEdit });
  const lines = display.lines;
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

  const exclusionHeight = computeExclusionHeight(exclusion, countFormat, { freeEdit });
  const boxY = lineStartY - exclusionHeight / 2;
  const lineTargetX = isLeft ? lineEndX : boxX;

  const textOptions: { textClass: string; countClass?: string; countLineIndex?: number } =
    display.totalLineIndex != null
      ? { textClass: 'exclusion-text', countClass: 'node-count', countLineIndex: display.totalLineIndex }
      : { textClass: 'exclusion-text' };

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
      {renderCenteredLines(lines, boxX + EXCLUSION_WIDTH / 2, boxY, exclusionHeight, textOptions)}
    </g>
  );
}

function renderCenteredLines(
  lines: string[],
  centerX: number,
  topY: number,
  containerHeight: number,
  classes: { textClass: string; countClass?: string; countLineIndex?: number }
) {
  const sanitized = lines.length ? lines : [''];
  const totalHeight = LINE_HEIGHT * sanitized.length;
  const startY = topY + containerHeight / 2 - totalHeight / 2 + 6;

  return (
    <text x={centerX} y={startY} className={classes.textClass} textAnchor="middle">
      {sanitized.map((line, index) => {
        const countIndex =
          classes.countClass !== undefined
            ? classes.countLineIndex ?? sanitized.length - 1
            : undefined;
        const isCountLine = countIndex !== undefined && index === countIndex;
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
