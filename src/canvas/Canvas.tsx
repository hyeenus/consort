import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppSettings, GraphState, PhaseEdgeMode } from '../model/types';
import { fontStack, paddingXFor } from '../model/style';
import { phaseNeatGap } from '../model/constants';
import { buildScene, firstLineCenterY, TextLine } from '../render/geometry';

interface CanvasProps {
  graph: GraphState;
  settings: AppSettings;
  onSelect: (id: string | undefined) => void;
  onCreateBelow: (nodeId: string) => void;
  onBranch: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onNudgeNode: (nodeId: string, delta: { x: number; y: number }) => void;
  onBeginNodeDrag: () => void;
  onSetPhaseEdge: (phaseId: string, edge: 'top' | 'bottom', nodeId: string, mode: PhaseEdgeMode) => void;
}

const ACCENT = '#1d4ed8';
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    /* pointer capture is best-effort */
  }
}

interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
}

export const Canvas: React.FC<CanvasProps> = ({
  graph,
  settings,
  onSelect,
  onCreateBelow,
  onBranch,
  onRemove,
  onNudgeNode,
  onBeginNodeDrag,
  onSetPhaseEdge,
}) => {
  const scene = useMemo(() => buildScene(graph, settings), [graph, settings]);
  const style = settings.style;
  const ink = style.inkColor;
  const fill = style.fillColor;
  const family = fontStack(style);
  const padX = paddingXFor(style);
  const radius = style.cornerRadius;
  const lineHeight = scene.lineHeight;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const fittedRef = useRef(false);
  const lastStartRef = useRef<string | null>(null);

  const fitToView = useCallback(
    (size = viewportSize) => {
      if (scene.width <= 0 || scene.height <= 0) {
        return;
      }
      const zoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Math.min(size.width / scene.width, size.height / scene.height) * 0.92)
      );
      const pan = {
        x: (size.width - scene.width * zoom) / 2,
        y: Math.max(24, (size.height - scene.height * zoom) / 2),
      };
      setView({ zoom, pan });
    },
    [scene.width, scene.height, viewportSize]
  );

  // Track viewport size.
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const update = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fit on first real measurement, and again when the whole diagram is swapped
  // out (a new template or reset changes the root node id).
  useEffect(() => {
    if (scene.width <= 0 || viewportSize.width <= 0) {
      return;
    }
    const rootChanged = lastStartRef.current !== graph.startNodeId;
    if (!fittedRef.current || rootChanged) {
      fitToView(viewportSize);
      fittedRef.current = true;
      lastStartRef.current = graph.startNodeId;
    }
  }, [fitToView, scene.width, viewportSize, graph.startNodeId]);

  // Pan / zoom interaction --------------------------------------------------
  const panState = useRef<{ active: boolean; startX: number; startY: number; origin: { x: number; y: number } }>({
    active: false,
    startX: 0,
    startY: 0,
    origin: { x: 0, y: 0 },
  });
  const dragState = useRef<{ id: string; lastX: number; lastY: number; pushed: boolean } | null>(null);
  const phaseDrag = useRef<{ phaseId: string; edge: 'top' | 'bottom'; pushed: boolean } | null>(null);

  // Candidate snap levels (content coords) for each phase handle: every main-flow
  // box border, plus the mid-gap point between consecutive boxes (with the neat
  // gap applied) so phases can either sit on a border or meet around an arrow.
  const phaseSnaps = useMemo(() => {
    const col = scene.nodes
      .filter((node) => node.node.column === 0)
      .sort((a, b) => a.y - b.y)
      .map((node) => ({ id: node.id, top: node.y, bottom: node.y + node.height }));
    const neat = phaseNeatGap(style);
    const top: { y: number; nodeId: string; mode: PhaseEdgeMode }[] = [];
    const bottom: { y: number; nodeId: string; mode: PhaseEdgeMode }[] = [];
    col.forEach((node, index) => {
      top.push({ y: node.top, nodeId: node.id, mode: 'border' });
      bottom.push({ y: node.bottom, nodeId: node.id, mode: 'border' });
      if (index > 0) {
        top.push({ y: (col[index - 1].bottom + node.top) / 2 + neat / 2, nodeId: node.id, mode: 'gap' });
      }
      if (index < col.length - 1) {
        bottom.push({ y: (node.bottom + col[index + 1].top) / 2 - neat / 2, nodeId: node.id, mode: 'gap' });
      }
    });
    return { top, bottom };
  }, [scene.nodes, style]);

  const snapPhaseEdge = (
    contentY: number,
    edge: 'top' | 'bottom'
  ): { nodeId: string; mode: PhaseEdgeMode } | undefined => {
    const candidates = edge === 'top' ? phaseSnaps.top : phaseSnaps.bottom;
    let best: { nodeId: string; mode: PhaseEdgeMode } | undefined;
    let bestDiff = Infinity;
    candidates.forEach((candidate) => {
      const diff = Math.abs(contentY - candidate.y);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { nodeId: candidate.nodeId, mode: candidate.mode };
      }
    });
    return best;
  };

  const pointerContentY = (clientY: number): number => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const top = rect ? rect.top : 0;
    return (clientY - top - view.pan.y) / view.zoom;
  };

  const handleWheel = (event: React.WheelEvent) => {
    if (!viewportRef.current) {
      return;
    }
    event.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    setView((prev) => {
      const factor = Math.exp(-event.deltaY * 0.0015);
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const ratio = nextZoom / prev.zoom;
      const pan = {
        x: cursorX - (cursorX - prev.pan.x) * ratio,
        y: cursorY - (cursorY - prev.pan.y) * ratio,
      };
      return { zoom: nextZoom, pan };
    });
  };

  const handleBackgroundPointerDown = (event: React.PointerEvent) => {
    onSelect(undefined);
    panState.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...view.pan },
    };
    capturePointer(event.currentTarget as Element, event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (panState.current.active) {
      const dx = event.clientX - panState.current.startX;
      const dy = event.clientY - panState.current.startY;
      setView((prev) => ({ ...prev, pan: { x: panState.current.origin.x + dx, y: panState.current.origin.y + dy } }));
      return;
    }
    const phase = phaseDrag.current;
    if (phase) {
      const snapped = snapPhaseEdge(pointerContentY(event.clientY), phase.edge);
      if (!snapped) {
        return;
      }
      if (!phase.pushed) {
        onBeginNodeDrag();
        phase.pushed = true;
      }
      onSetPhaseEdge(phase.phaseId, phase.edge, snapped.nodeId, snapped.mode);
      return;
    }
    const drag = dragState.current;
    if (drag) {
      const dx = (event.clientX - drag.lastX) / view.zoom;
      const dy = (event.clientY - drag.lastY) / view.zoom;
      if (!drag.pushed && (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01)) {
        onBeginNodeDrag();
        drag.pushed = true;
      }
      if (drag.pushed) {
        onNudgeNode(drag.id, { x: dx, y: dy });
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
      }
    }
  };

  const endInteraction = (event: React.PointerEvent) => {
    panState.current.active = false;
    dragState.current = null;
    phaseDrag.current = null;
    try {
      (event.currentTarget as Element).releasePointerCapture(event.pointerId);
    } catch {
      /* pointer may already be released */
    }
  };

  const startNodeDrag = (event: React.PointerEvent, nodeId: string) => {
    event.stopPropagation();
    onSelect(nodeId);
    dragState.current = { id: nodeId, lastX: event.clientX, lastY: event.clientY, pushed: false };
    capturePointer(event.currentTarget as Element, event.pointerId);
  };

  const startPhaseDrag = (event: React.PointerEvent, phaseId: string, edge: 'top' | 'bottom') => {
    event.stopPropagation();
    onSelect(phaseId);
    phaseDrag.current = { phaseId, edge, pushed: false };
    capturePointer(event.currentTarget as Element, event.pointerId);
  };

  const zoomBy = (factor: number) => {
    setView((prev) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const cx = viewportSize.width / 2;
      const cy = viewportSize.height / 2;
      const ratio = nextZoom / prev.zoom;
      return {
        zoom: nextZoom,
        pan: { x: cx - (cx - prev.pan.x) * ratio, y: cy - (cy - prev.pan.y) * ratio },
      };
    });
  };

  const selectedId = graph.selectedId;

  return (
    <div className="canvas-viewport" ref={viewportRef} onWheel={handleWheel}>
      <svg
        className="canvas-svg"
        width={viewportSize.width}
        height={viewportSize.height}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endInteraction}
        onPointerLeave={endInteraction}
        style={{ fontFamily: family }}
      >
        <defs>
          <marker id="cb-arrow-screen" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6.5,3 L0,6 z" fill={ink} />
          </marker>
        </defs>
        {/* background catcher for pan + deselect */}
        <rect x={0} y={0} width={viewportSize.width} height={viewportSize.height} fill="transparent" />
        <g transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom})`}>
          {/* Phases */}
          {scene.phases.map((phase) => {
            const selected = selectedId === phase.id;
            const startY = -((phase.lines.length - 1) * lineHeight) / 2;
            return (
              <g
                key={phase.id}
                className="phase-box"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect(phase.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={phase.x}
                  y={phase.y}
                  width={phase.width}
                  height={phase.height}
                  rx={radius}
                  ry={radius}
                  fill={fill}
                  stroke={selected ? ACCENT : ink}
                  strokeWidth={selected ? style.lineWeight + 1.4 : style.lineWeight}
                />
                <text
                  x={phase.textX}
                  y={phase.textY}
                  textAnchor="middle"
                  fontSize={style.fontSize}
                  fontWeight={700}
                  fill={ink}
                  dominantBaseline="central"
                  transform={`rotate(-90 ${phase.textX} ${phase.textY})`}
                >
                  {phase.lines.map((line, index) => (
                    <tspan key={index} x={phase.textX} dy={index === 0 ? startY : lineHeight}>
                      {line}
                    </tspan>
                  ))}
                </text>
                {selected &&
                  (['top', 'bottom'] as const).map((edge) => {
                    const handleSize = Math.max(10, style.fontSize * 0.95);
                    const cx = phase.x + phase.width / 2;
                    const cy = edge === 'top' ? phase.y : phase.y + phase.height;
                    return (
                      <rect
                        key={edge}
                        className="phase-handle"
                        x={cx - handleSize / 2}
                        y={cy - handleSize / 2}
                        width={handleSize}
                        height={handleSize}
                        rx={2}
                        fill={ACCENT}
                        stroke="#fff"
                        strokeWidth={1}
                        style={{ cursor: 'ns-resize' }}
                        onPointerDown={(event) => startPhaseDrag(event, phase.id, edge)}
                      />
                    );
                  })}
              </g>
            );
          })}

          {/* Connectors */}
          {scene.connectors.map((connector) => (
            <path
              key={connector.intervalId}
              d={connector.path}
              fill="none"
              stroke={selectedId === connector.intervalId ? ACCENT : ink}
              strokeWidth={selectedId === connector.intervalId ? style.lineWeight + 1 : style.lineWeight}
              markerEnd={connector.showArrow ? 'url(#cb-arrow-screen)' : undefined}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect(connector.intervalId);
              }}
              style={{ cursor: 'pointer' }}
            />
          ))}

          {/* Exclusions */}
          {scene.exclusions.map((exclusion) => {
            const selected = selectedId === exclusion.intervalId;
            return (
              <g
                key={`ex-${exclusion.intervalId}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect(exclusion.intervalId);
                }}
                style={{ cursor: 'pointer' }}
              >
                <line
                  x1={exclusion.connector.x1}
                  y1={exclusion.connector.y1}
                  x2={exclusion.connector.x2}
                  y2={exclusion.connector.y2}
                  stroke={ink}
                  strokeWidth={style.lineWeight}
                  markerEnd={exclusion.showArrow ? 'url(#cb-arrow-screen)' : undefined}
                />
                <rect
                  x={exclusion.x}
                  y={exclusion.y}
                  width={exclusion.width}
                  height={exclusion.height}
                  rx={radius}
                  ry={radius}
                  fill={fill}
                  stroke={selected ? ACCENT : ink}
                  strokeWidth={selected ? style.lineWeight + 1.4 : style.lineWeight}
                />
                {renderText(exclusion.lines, exclusion.x, exclusion.y, exclusion.width, exclusion.height, exclusion.centerX)}
              </g>
            );
          })}

          {/* Nodes */}
          {scene.nodes.map((node) => {
            const selected = selectedId === node.id;
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={radius}
                  ry={radius}
                  fill={fill}
                  stroke={selected ? ACCENT : ink}
                  strokeWidth={selected ? style.lineWeight + 1.4 : style.lineWeight}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(event) => startNodeDrag(event, node.id)}
                />
                {renderText(node.lines, node.x, node.y, node.width, node.height, node.centerX)}
                {selected && renderNodeControls(node)}
              </g>
            );
          })}

          {/* Delta badges (screen only) */}
          {scene.deltas.map((delta) => (
            <g key={`d-${delta.intervalId}`} pointerEvents="none">
              <rect x={delta.x - 34} y={delta.y - 12} width={68} height={24} rx={12} fill="#d92c2c" />
              <text x={delta.x} y={delta.y + 5} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700}>
                {delta.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div className="canvas-controls">
        <button type="button" title="Zoom in" onClick={() => zoomBy(1.2)}>
          +
        </button>
        <button type="button" title="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          −
        </button>
        <button type="button" title="Fit to view" onClick={() => fitToView()}>
          Fit
        </button>
        <span className="canvas-zoom-label">{Math.round(view.zoom * 100)}%</span>
      </div>
    </div>
  );

  function renderText(
    lines: TextLine[],
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    centerX: number
  ): React.ReactNode {
    if (!lines.length) {
      return null;
    }
    const left = style.textAlign === 'left';
    const anchor = left ? 'start' : 'middle';
    const textX = left ? boxX + padX : centerX;
    const startY = firstLineCenterY(boxY, boxH, lines.length, lineHeight);
    return (
      <text
        x={textX}
        y={startY}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={style.fontSize}
        fill={ink}
        pointerEvents="none"
      >
        {lines.map((line, index) => (
          <tspan
            key={index}
            x={textX}
            dy={index === 0 ? 0 : lineHeight}
            fontWeight={line.bold ? style.countWeight : undefined}
          >
            {line.text}
          </tspan>
        ))}
      </text>
    );
  }

  function renderNodeControls(node: { id: string; centerX: number; y: number; height: number; isRoot: boolean }) {
    const size = Math.max(22, style.fontSize * 1.5);
    const spacing = 6;
    const buttons = [
      { key: 'add', label: '+', title: 'Add step below', onClick: () => onCreateBelow(node.id) },
      { key: 'branch', label: '⎇', title: 'Branch', onClick: () => onBranch(node.id) },
    ];
    if (!node.isRoot) {
      buttons.push({ key: 'remove', label: '−', title: 'Remove', onClick: () => onRemove(node.id) });
    }
    const totalWidth = buttons.length * size + (buttons.length - 1) * spacing;
    let cursorX = node.centerX - totalWidth / 2;
    const y = node.y + node.height + 10;
    return (
      <g className="node-controls">
        {buttons.map((button) => {
          const bx = cursorX;
          cursorX += size + spacing;
          return (
            <g
              key={button.key}
              className="node-control"
              onPointerDown={(event) => {
                event.stopPropagation();
                button.onClick();
              }}
              style={{ cursor: 'pointer' }}
            >
              <title>{button.title}</title>
              <rect x={bx} y={y} width={size} height={size} rx={6} fill={ACCENT} />
              <text
                x={bx + size / 2}
                y={y + size / 2 + size * 0.18}
                textAnchor="middle"
                fontSize={size * 0.62}
                fill="#fff"
              >
                {button.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  }
};
