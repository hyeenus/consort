import { nanoid } from 'nanoid';
import {
  AppSettings,
  BoxNode,
  CountFormat,
  ExclusionBox,
  ExclusionReason,
  GraphState,
  Interval,
  IntervalId,
  NodeId,
  PhaseBox,
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
    phases: [],
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
    phases: graph.phases?.map((phase) => ({ ...phase })) ?? [],
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
  const sumUser = userReasons.reduce((acc, reason) => acc + (reason.n ?? 0), 0);
  const remainder = exclusion.total != null ? exclusion.total - sumUser : null;
  const shouldShowAuto = userReasons.length > 0 && remainder != null && remainder !== 0;

  exclusion.reasons = [...userReasons];
  if (!shouldShowAuto) {
    return;
  }

  const autoReason: ExclusionReason = existingAuto ?? {
    id: nanoid(),
    label: 'Other',
    n: remainder,
    kind: 'auto',
    countOverride: null,
  };
  autoReason.n = remainder;
  if (!autoReason.label) {
    autoReason.label = 'Other';
  }
  exclusion.reasons.push(autoReason);
}

function getMainFlowNodes(graph: GraphState): BoxNode[] {
  return Object.values(graph.nodes)
    .filter((node) => node.column === 0)
    .sort((a, b) => a.position.y - b.position.y);
}

function getPhase(graph: GraphState, phaseId: string): PhaseBox {
  const phase = graph.phases.find((item) => item.id === phaseId);
  if (!phase) {
    throw new Error('Phase not found');
  }
  return phase;
}

function initializeBranchChildren(graph: GraphState, parent: BoxNode): void {
  const childIds = parent.childIds ?? [];
  if (childIds.length < 2) {
    return;
  }
  if (parent.n == null) {
    return;
  }
  const childNodes = childIds
    .map((childId) => graph.nodes[childId])
    .filter((node): node is BoxNode => Boolean(node));
  if (!childNodes.length) {
    return;
  }
  const anyAssigned = childNodes.some((child) => child.n != null);
  if (anyAssigned) {
    return;
  }

  const totalChildren = childNodes.length;
  const baseShare = Math.floor(parent.n / totalChildren);
  let remainder = parent.n - baseShare * totalChildren;

  childNodes.forEach((child) => {
    let value = baseShare;
    if (remainder > 0) {
      value += 1;
      remainder -= 1;
    }
    child.n = value;
  });
}

function rebalanceBranchAfterUpdate(graph: GraphState, parentId: NodeId, updatedChildId: NodeId): void {
  const parent = graph.nodes[parentId];
  if (!parent) {
    return;
  }
  const childIds = parent.childIds ?? [];
  if (childIds.length !== 2) {
    return;
  }
  if (parent.n == null) {
    return;
  }
  const updatedChild = graph.nodes[updatedChildId];
  const otherChildId = childIds.find((id) => id !== updatedChildId);
  if (!updatedChild || !otherChildId) {
    return;
  }
  const otherChild = graph.nodes[otherChildId];
  if (!otherChild) {
    return;
  }
  const updatedValue = updatedChild.n ?? 0;
  const remaining = parent.n - updatedValue;
  otherChild.n = remaining >= 0 ? remaining : 0;
  if (otherChild.countOverride !== undefined) {
    otherChild.countOverride = undefined;
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

export function updateNodeCount(
  graph: GraphState,
  nodeId: NodeId,
  n: number | null,
  override?: string | null,
  options: { skipBranchRebalance?: boolean } = {}
): GraphState {
  const cloned = cloneGraph(graph);
  const node = cloned.nodes[nodeId];
  if (!node) {
    throw new Error('Node not found');
  }
  node.n = n;
  if (override !== undefined) {
    node.countOverride = override;
  }
  if (!options.skipBranchRebalance) {
    const parentId = getParentId(cloned, nodeId);
    if (parentId) {
      rebalanceBranchAfterUpdate(cloned, parentId, nodeId);
    }
  }
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

export function updateExclusionCount(
  graph: GraphState,
  intervalId: IntervalId,
  n: number | null,
  override?: string | null
): GraphState {
  const cloned = cloneGraph(graph);
  const interval = cloned.intervals[intervalId];
  if (!interval) {
    throw new Error('Interval not found');
  }
  if (!interval.exclusion) {
    interval.exclusion = createDefaultExclusion();
  }
  interval.exclusion.total = n;
  if (override !== undefined) {
    interval.exclusion.totalOverride = override;
  }
  return cloned;
}

export function addPhase(graph: GraphState): GraphState {
  const cloned = cloneGraph(graph);
  const mainNodes = getMainFlowNodes(cloned);
  if (!mainNodes.length) {
    return cloned;
  }
  const lastIndex = mainNodes.length - 1;
  const existingPhases = cloned.phases ?? [];
  reflowPhaseRanges(cloned, mainNodes);
  const nodeIndex = new Map(mainNodes.map((node, index) => [node.id, index] as const));
  const lastExisting = existingPhases.at(-1);
  const lastExistingEnd = lastExisting ? nodeIndex.get(lastExisting.endNodeId) ?? lastIndex : -1;
  const newStartIndex = Math.min(lastIndex, Math.max(0, lastExistingEnd + 1));

  const nextIndex = existingPhases.length + 1;
  const newPhase: PhaseBox = {
    id: nanoid(),
    label: `Phase ${nextIndex}`,
    startNodeId: mainNodes[newStartIndex].id,
    endNodeId: mainNodes[lastIndex].id,
  };
  cloned.phases = [...existingPhases, newPhase];
  reflowPhaseRanges(cloned, mainNodes);
  cloned.selectedId = newPhase.id;
  return cloned;
}

export function updatePhaseLabel(graph: GraphState, phaseId: string, label: string): GraphState {
  const cloned = cloneGraph(graph);
  const phase = getPhase(cloned, phaseId);
  phase.label = label;
  return cloned;
}

export function updatePhaseBounds(
  graph: GraphState,
  phaseId: string,
  startNodeId: NodeId,
  endNodeId: NodeId
): GraphState {
  const cloned = cloneGraph(graph);
  const phase = getPhase(cloned, phaseId);
  const mainNodes = getMainFlowNodes(cloned);
  if (!mainNodes.length) {
    return cloned;
  }
  const orderMap = new Map(mainNodes.map((node, index) => [node.id, index] as const));
  const startIndex = orderMap.get(startNodeId) ?? 0;
  const endIndex = orderMap.get(endNodeId) ?? startIndex;
  const normalizedStartIndex = Math.min(startIndex, endIndex);
  const normalizedEndIndex = Math.max(startIndex, endIndex);
  phase.startNodeId = mainNodes[normalizedStartIndex]?.id ?? mainNodes[0].id;
  phase.endNodeId = mainNodes[normalizedEndIndex]?.id ?? mainNodes[mainNodes.length - 1].id;
  return cloned;
}

export function removePhase(graph: GraphState, phaseId: string): GraphState {
  const cloned = cloneGraph(graph);
  cloned.phases = (cloned.phases ?? []).filter((phase) => phase.id !== phaseId);
  if (cloned.selectedId === phaseId) {
    cloned.selectedId = cloned.startNodeId ?? cloned.selectedId;
  }
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
  value: number | null,
  override?: string | null
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
  if (override !== undefined) {
    reason.countOverride = override;
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

export function getParentId(graph: GraphState, nodeId: NodeId): NodeId | undefined {
  return Object.values(graph.intervals).find((interval) => interval.childId === nodeId)?.parentId;
}

function layoutGraphInPlace(
  graph: GraphState,
  countFormat: CountFormat = 'upper',
  options: { freeEdit?: boolean } = {}
): void {
  Object.values(graph.nodes).forEach((node) => {
    if (!Array.isArray(node.childIds)) {
      node.childIds = [];
    } else {
      node.childIds = node.childIds.filter((childId) => graph.nodes[childId]);
    }
  });
  const { order } = layoutTree(graph.nodes, graph.startNodeId, countFormat, { freeEdit: options.freeEdit });
  (graph as Record<string, unknown>).__order = order;
}

function normalizePhases(graph: GraphState): void {
  if (!Array.isArray(graph.phases)) {
    graph.phases = [];
    return;
  }
  const mainNodes = getMainFlowNodes(graph);
  if (!mainNodes.length) {
    graph.phases = [];
    return;
  }
  reflowPhaseRanges(graph, mainNodes);
}

function reflowPhaseRanges(graph: GraphState, mainNodes: BoxNode[]): void {
  if (!graph.phases?.length) {
    return;
  }
  const lastIndex = mainNodes.length - 1;
  const map = new Map(mainNodes.map((node, index) => [node.id, index] as const));
  let previousEnd = -1;
  const total = graph.phases.length;
  graph.phases.forEach((phase, index) => {
    let startIndex = map.get(phase.startNodeId) ?? 0;
    let endIndex = map.get(phase.endNodeId) ?? lastIndex;
    startIndex = Math.max(0, Math.min(startIndex, lastIndex));
    endIndex = Math.max(startIndex, Math.min(endIndex, lastIndex));

    const minStart = previousEnd + 1;
    if (startIndex < minStart) {
      startIndex = minStart;
    }
    const maxEndAllowed = lastIndex - (total - index - 1);
    if (endIndex > maxEndAllowed) {
      endIndex = maxEndAllowed;
    }
    if (startIndex > maxEndAllowed) {
      startIndex = maxEndAllowed;
    }
    if (startIndex > endIndex) {
      startIndex = endIndex;
    }

    phase.startNodeId = mainNodes[startIndex].id;
    phase.endNodeId = mainNodes[endIndex].id;
    previousEnd = endIndex;
  });
}

export function recomputeGraph(graph: GraphState, settings: AppSettings): GraphState {
  const cloned = cloneGraph(graph);
  const intervalMap = new Map<string, Interval>();
  Object.values(cloned.intervals).forEach((interval) => {
    const parent = cloned.nodes[interval.parentId];
    const parentChildren = parent?.childIds ?? [];
    const isBranchInterval = parentChildren.length > 1;

    if (isBranchInterval) {
      interval.exclusion = undefined;
    } else {
      if (!interval.exclusion) {
        interval.exclusion = createDefaultExclusion();
      }
      ensureOtherReason(interval.exclusion);
    }

    intervalMap.set(`${interval.parentId}:${interval.childId}`, interval);
  });

  Object.values(cloned.nodes).forEach((node) => {
    if (!Array.isArray(node.childIds)) {
      return;
    }
    if (node.childIds.length > 1 && !settings.freeEdit) {
      initializeBranchChildren(cloned, node);
    }
  });

  if (settings.autoCalc && !settings.freeEdit) {
    Object.values(cloned.nodes).forEach((node) => {
      if (!Array.isArray(node.childIds)) {
        node.childIds = [];
      }
      const childIds = node.childIds;
      if (childIds.length > 1 && node.n != null) {
        const lastChildId = childIds[childIds.length - 1];
        let remaining = node.n;
        childIds.forEach((childId, index) => {
          const interval = intervalMap.get(`${node.id}:${childId}`);
          const exclusionValue = interval?.exclusion?.total ?? 0;
          if (index < childIds.length - 1) {
            const childNode = cloned.nodes[childId];
            remaining -= (childNode?.n ?? 0) + exclusionValue;
          }
        });
        const lastChildNode = cloned.nodes[lastChildId];
        const lastInterval = intervalMap.get(`${node.id}:${lastChildId}`);
        if (lastChildNode && lastChildNode.n == null) {
          const adjustment = lastInterval?.exclusion?.total ?? 0;
          const value = remaining - adjustment;
          if (value >= 0) {
            lastChildNode.n = value;
          }
        }
      }
    });
  }

  Object.values(cloned.nodes).forEach((parentNode) => {
    if (!Array.isArray(parentNode.childIds)) {
      parentNode.childIds = [];
    }
    const childIds = parentNode.childIds;
    if (!childIds.length) {
      return;
    }
    if (childIds.length > 1) {
      if (!settings.freeEdit) {
        initializeBranchChildren(cloned, parentNode);
      }

      const parentValue = parentNode.n ?? 0;
      const branchEntries = childIds
        .map((childId) => {
          const interval = intervalMap.get(`${parentNode.id}:${childId}`);
          if (!interval) {
            return undefined;
          }
          return {
            interval,
            childNode: cloned.nodes[childId],
          };
        })
        .filter((entry): entry is { interval: Interval; childNode?: BoxNode } => Boolean(entry));

      const totalChildren = branchEntries.reduce((acc, { childNode }) => acc + (childNode?.n ?? 0), 0);
      const diff = parentValue - totalChildren;

      branchEntries.forEach(({ interval }) => {
        interval.delta = diff;
      });

      return;
    }

    {
      const childId = childIds[0];
      const interval = intervalMap.get(`${parentNode.id}:${childId}`);
      const childNode = cloned.nodes[childId];
      if (!interval) {
        return;
      }
      if (settings.autoCalc && !settings.freeEdit && parentNode.n != null) {
        if (interval.exclusion?.total == null && childNode?.n != null) {
          const diff = parentNode.n - childNode.n;
          interval.exclusion.total = diff > 0 ? diff : null;
        } else if (interval.exclusion?.total != null && childNode?.n == null) {
          childNode.n = parentNode.n - interval.exclusion.total;
        }
      }
      const exclusionValue = interval.exclusion?.total ?? 0;
      const childValue = childNode?.n ?? 0;
      const parentValue = parentNode.n ?? 0;
      interval.delta = parentValue - (childValue + exclusionValue);
    }
  });

  layoutGraphInPlace(cloned, settings.countFormat, { freeEdit: settings.freeEdit });
  normalizePhases(cloned);
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

export function getSelectionKind(graph: GraphState): 'node' | 'interval' | 'phase' | undefined {
  if (!graph.selectedId) {
    return undefined;
  }
  if (graph.nodes[graph.selectedId]) {
    return 'node';
  }
  if (graph.intervals[graph.selectedId]) {
    return 'interval';
  }
  if ((graph.phases ?? []).some((phase) => phase.id === graph.selectedId)) {
    return 'phase';
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
  if (kind === 'phase') {
    return graph.selectedId;
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
