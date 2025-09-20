import { nanoid } from 'nanoid';
import {
  AppSettings,
  BoxNode,
  ExclusionBox,
  ExclusionReason,
  GraphState,
  Interval,
  IntervalId,
  NodeId,
} from './types';
import { layoutTree } from './layout';

const DEFAULT_TEXT = ['New step'];

export function createInitialGraph(): GraphState {
  const startId = nanoid();
  const startNode: BoxNode = {
    id: startId,
    textLines: ['Start'],
    n: 0,
    position: { x: 0, y: 0 },
    column: 0,
    autoLocked: false,
    childIds: [],
  };

  return {
    nodes: { [startId]: startNode },
    intervals: {},
    startNodeId: startId,
    selectedId: startId,
  };
}

export function getNode(graph: GraphState, nodeId: NodeId): BoxNode {
  const node = graph.nodes[nodeId];
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }
  return node;
}

export function getOutgoingIntervals(graph: GraphState, nodeId: NodeId): Interval[] {
  return Object.values(graph.intervals).filter((interval) => interval.parentId === nodeId);
}

export function getIncomingInterval(graph: GraphState, nodeId: NodeId): Interval | undefined {
  return Object.values(graph.intervals).find((interval) => interval.childId === nodeId);
}

function cloneGraph(graph: GraphState): GraphState {
  return {
    nodes: Object.fromEntries(
      Object.entries(structuredClone(graph.nodes)).map(([id, node]) => [
        id,
        {
          ...node,
          childIds: Array.isArray(node.childIds) ? node.childIds : [],
        },
      ])
    ),
    intervals: structuredClone(graph.intervals),
    startNodeId: graph.startNodeId,
    selectedId: graph.selectedId,
  };
}

function createDefaultExclusion(): ExclusionBox {
  return {
    label: 'Excluded',
    total: null,
    reasons: [],
  };
}

function ensureOtherReason(exclusion: ExclusionBox): void {
  const userReasons = exclusion.reasons.filter((reason) => reason.kind === 'user');
  const existingAuto = exclusion.reasons.find((reason) => reason.kind === 'auto');
  const createdAuto: ExclusionReason = existingAuto ?? {
    id: nanoid(),
    label: 'Other',
    n: null,
    kind: 'auto',
  };
  const sumUser = userReasons.reduce((acc, reason) => acc + (reason.n ?? 0), 0);
  const remainder = exclusion.total != null ? exclusion.total - sumUser : null;

  createdAuto.n = remainder;

  exclusion.reasons = [...userReasons];
  if (createdAuto && createdAuto.n != null) {
    exclusion.reasons.push(createdAuto);
  } else if (existingAuto && existingAuto.label !== 'Other') {
    // Preserve custom label even when the remainder is zero.
    existingAuto.n = remainder;
    exclusion.reasons.push(existingAuto);
  }
}

function getReason(graph: GraphState, intervalId: IntervalId, reasonId: string): ExclusionReason {
  const interval = graph.intervals[intervalId];
  if (!interval || !interval.exclusion) {
    throw new Error('Interval not found');
  }
  const reason = interval.exclusion.reasons.find((item) => item.id === reasonId);
  if (!reason) {
    throw new Error('Reason not found');
  }
  return reason;
}

export function addNodeBelow(graph: GraphState, parentId: NodeId): GraphState {
  if (!graph.nodes[parentId]) {
    throw new Error(`Parent node ${parentId} does not exist`);
  }
  const cloned = cloneGraph(graph);
  const newNodeId = nanoid();
  cloned.nodes[newNodeId] = {
    id: newNodeId,
    textLines: DEFAULT_TEXT.slice(),
    n: null,
    position: { x: 0, y: 0 },
    column: 0,
    autoLocked: false,
    childIds: [],
  };
  const newIntervalId: IntervalId = nanoid();

  cloned.intervals[newIntervalId] = {
    id: newIntervalId,
    parentId,
    childId: newNodeId,
    exclusion: createDefaultExclusion(),
    delta: 0,
    arrow: true,
  };
  cloned.nodes[parentId].childIds = [...(cloned.nodes[parentId].childIds ?? []), newNodeId];

  cloned.selectedId = newNodeId;
  layoutGraphInPlace(cloned);
  return cloned;
}

export function updateNodeText(graph: GraphState, nodeId: NodeId, textLines: string[]): GraphState {
  const cloned = cloneGraph(graph);
  const node = cloned.nodes[nodeId];
  if (!node) {
    throw new Error('Node not found');
  }
  node.textLines = textLines;
  return cloned;
}

export function updateNodeCount(graph: GraphState, nodeId: NodeId, n: number | null): GraphState {
  const cloned = cloneGraph(graph);
  const node = cloned.nodes[nodeId];
  if (!node) {
    throw new Error('Node not found');
  }
  node.n = n;
  return cloned;
}

export function updateExclusionLabel(graph: GraphState, intervalId: IntervalId, label: string): GraphState {
  const cloned = cloneGraph(graph);
  const interval = cloned.intervals[intervalId];
  if (!interval) {
    throw new Error('Interval not found');
  }
  if (!interval.exclusion) {
    interval.exclusion = createDefaultExclusion();
  }
  interval.exclusion.label = label;
  return cloned;
}

export function updateExclusionCount(graph: GraphState, intervalId: IntervalId, n: number | null): GraphState {
  const cloned = cloneGraph(graph);
  const interval = cloned.intervals[intervalId];
  if (!interval) {
    throw new Error('Interval not found');
  }
  if (!interval.exclusion) {
    interval.exclusion = createDefaultExclusion();
  }
  interval.exclusion.total = n;
  return cloned;
}

export function addExclusionReason(graph: GraphState, intervalId: IntervalId): GraphState {
  const cloned = cloneGraph(graph);
  const interval = cloned.intervals[intervalId];
  if (!interval) {
    throw new Error('Interval not found');
  }
  if (!interval.exclusion) {
    interval.exclusion = createDefaultExclusion();
  }
  const newReason: ExclusionReason = {
    id: nanoid(),
    label: '',
    n: null,
    kind: 'user',
  };
  interval.exclusion.reasons.push(newReason);
  ensureOtherReason(interval.exclusion);
  return cloned;
}

export function updateExclusionReasonLabel(
  graph: GraphState,
  intervalId: IntervalId,
  reasonId: string,
  label: string
): GraphState {
  const cloned = cloneGraph(graph);
  const reason = getReason(cloned, intervalId, reasonId);
  reason.label = label;
  const interval = cloned.intervals[intervalId];
  if (interval?.exclusion) {
    ensureOtherReason(interval.exclusion);
  }
  return cloned;
}

export function updateExclusionReasonCount(
  graph: GraphState,
  intervalId: IntervalId,
  reasonId: string,
  value: number | null
): GraphState {
  const cloned = cloneGraph(graph);
  const interval = cloned.intervals[intervalId];
  if (!interval) {
    throw new Error('Interval not found');
  }
  if (!interval.exclusion) {
    throw new Error('Exclusion box not found');
  }
  const reason = interval.exclusion.reasons.find((item) => item.id === reasonId);
  if (!reason) {
    throw new Error('Reason not found');
  }
  if (reason.kind === 'auto') {
    return cloned;
  }
  reason.n = value;
  ensureOtherReason(interval.exclusion);
  return cloned;
}

export function removeExclusionReason(graph: GraphState, intervalId: IntervalId, reasonId: string): GraphState {
  const cloned = cloneGraph(graph);
  const interval = cloned.intervals[intervalId];
  if (!interval || !interval.exclusion) {
    throw new Error('Interval not found');
  }
  interval.exclusion.reasons = interval.exclusion.reasons.filter((reason) => reason.id !== reasonId);
  ensureOtherReason(interval.exclusion);
  return cloned;
}

export function setSelected(graph: GraphState, id: string | undefined): GraphState {
  const cloned = cloneGraph(graph);
  cloned.selectedId = id;
  return cloned;
}

function getParentId(graph: GraphState, nodeId: NodeId): NodeId | undefined {
  return Object.values(graph.intervals).find((interval) => interval.childId === nodeId)?.parentId;
}

function layoutGraphInPlace(graph: GraphState): void {
  Object.values(graph.nodes).forEach((node) => {
    if (!Array.isArray(node.childIds)) {
      node.childIds = [];
    } else {
      node.childIds = node.childIds.filter((childId) => graph.nodes[childId]);
    }
  });
  const { order } = layoutTree(graph.nodes, graph.startNodeId);
  (graph as Record<string, unknown>).__order = order;
}

export function recomputeGraph(graph: GraphState, settings: AppSettings): GraphState {
  const cloned = cloneGraph(graph);
  Object.values(cloned.intervals).forEach((interval) => {
    const parent = cloned.nodes[interval.parentId];
    const child = cloned.nodes[interval.childId];
    if (!interval.exclusion) {
      interval.exclusion = createDefaultExclusion();
    }

    if (settings.autoCalc && parent?.n != null) {
      if (interval.exclusion.total == null && child?.n != null) {
        interval.exclusion.total = parent.n - child.n;
      } else if (interval.exclusion.total != null && child?.n == null) {
        child.n = parent.n - interval.exclusion.total;
      }
    }

    ensureOtherReason(interval.exclusion);

    const exclusionValue = interval.exclusion.total ?? 0;
    const childValue = child?.n ?? 0;
    const parentValue = parent?.n ?? 0;

    interval.delta = parentValue - (childValue + exclusionValue);
  });
  layoutGraphInPlace(cloned);
  return cloned;
}

export function orderNodes(graph: GraphState): BoxNode[] {
  const cached = (graph as Record<string, unknown>).__order as NodeId[] | undefined;
  const order = cached ?? layoutTree(graph.nodes, graph.startNodeId).order;
  return order
    .map((id) => graph.nodes[id])
    .filter((node): node is BoxNode => Boolean(node));
}

export function toggleArrow(graph: GraphState, intervalId: IntervalId): GraphState {
  const cloned = cloneGraph(graph);
  const interval = cloned.intervals[intervalId];
  if (!interval) {
    throw new Error('Interval not found');
  }
  interval.arrow = !interval.arrow;
  return cloned;
}

export function removeNode(graph: GraphState, nodeId: NodeId): GraphState {
  const cloned = cloneGraph(graph);
  if (cloned.startNodeId === nodeId) {
    return cloned; // do not remove root
  }

  const parentId = getParentId(cloned, nodeId);

  const nodesToRemove = new Set<NodeId>();
  const collect = (id: NodeId) => {
    if (nodesToRemove.has(id)) {
      return;
    }
    nodesToRemove.add(id);
    const node = cloned.nodes[id];
    const children = node?.childIds ?? [];
    children.forEach(collect);
  };
  collect(nodeId);

  Object.entries(cloned.intervals).forEach(([intervalId, interval]) => {
    if (nodesToRemove.has(interval.childId) || nodesToRemove.has(interval.parentId)) {
      delete cloned.intervals[intervalId];
    }
  });

  nodesToRemove.forEach((id) => {
    delete cloned.nodes[id];
  });

  if (parentId && cloned.nodes[parentId]) {
    cloned.nodes[parentId].childIds = (cloned.nodes[parentId].childIds ?? []).filter(
      (child) => !nodesToRemove.has(child)
    );
  }

  cloned.selectedId = parentId ?? cloned.startNodeId;
  layoutGraphInPlace(cloned);
  return cloned;
}

export function snapshotGraph(graph: GraphState): GraphState {
  return cloneGraph(graph);
}

export function isNodeSelected(graph: GraphState, id: string): boolean {
  return graph.selectedId === id;
}

export function isIntervalSelected(graph: GraphState, id: string): boolean {
  return graph.selectedId === id;
}

export function getSelectionKind(graph: GraphState): 'node' | 'interval' | undefined {
  if (!graph.selectedId) {
    return undefined;
  }
  if (graph.nodes[graph.selectedId]) {
    return 'node';
  }
  if (graph.intervals[graph.selectedId]) {
    return 'interval';
  }
  return undefined;
}

export function navigateSelection(graph: GraphState, direction: 'up' | 'down' | 'left' | 'right'): string | undefined {
  const kind = getSelectionKind(graph);
  if (kind === 'node') {
    return navigateFromNode(graph, graph.selectedId as NodeId, direction);
  }
  if (kind === 'interval') {
    return navigateFromInterval(graph, graph.selectedId as IntervalId, direction);
  }
  return undefined;
}

function navigateFromNode(graph: GraphState, nodeId: NodeId, direction: 'up' | 'down' | 'left' | 'right'): string | undefined {
  const node = graph.nodes[nodeId];
  if (!node) {
    return undefined;
  }
  const parentId = getParentId(graph, nodeId);
  switch (direction) {
    case 'up':
      return parentId ?? nodeId;
    case 'down':
      return node.childIds?.[0] ?? nodeId;
    case 'left':
      if (parentId) {
        return GraphNavigation.getIntervalId(graph, parentId, nodeId) ?? parentId;
      }
      return nodeId;
    case 'right':
      if (node.childIds?.length) {
        return GraphNavigation.getIntervalId(graph, nodeId, node.childIds[0]) ?? node.childIds[0];
      }
      return nodeId;
    default:
      return undefined;
  }
}

function navigateFromInterval(graph: GraphState, intervalId: IntervalId, direction: 'up' | 'down' | 'left' | 'right'): string | undefined {
  const interval = graph.intervals[intervalId];
  if (!interval) {
    return undefined;
  }
  switch (direction) {
    case 'up':
      return interval.parentId;
    case 'down':
      return interval.childId;
    case 'left':
      return interval.parentId;
    case 'right':
      return interval.childId;
    default:
      return undefined;
  }
}

const GraphNavigation = {
  getIntervalId(graph: GraphState, parentId: NodeId, childId: NodeId): string | undefined {
    return Object.values(graph.intervals).find(
      (interval) => interval.parentId === parentId && interval.childId === childId
    )?.id;
  },
};
