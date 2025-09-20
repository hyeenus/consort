import { describe, expect, it } from 'vitest';
import {
  addExclusionReason,
  addNodeBelow,
  createInitialGraph,
  removeNode,
  recomputeGraph,
  updateExclusionCount,
  updateExclusionReasonCount,
  updateNodeCount,
} from '../model/graph';
import { AppSettings } from '../model/types';

const autoSettings: AppSettings = { autoCalc: true, arrowsGlobal: true };
const unlockedSettings: AppSettings = { autoCalc: false, arrowsGlobal: true };

describe('graph recalculation', () => {
  it('keeps delta balanced when counts align', () => {
    let graph = createInitialGraph();
    const startId = graph.startNodeId!;
    graph = updateNodeCount(graph, startId, 200);
    graph = addNodeBelow(graph, startId);
    const intervalId = Object.keys(graph.intervals)[0];
    const childId = graph.intervals[intervalId].childId;

    graph = updateNodeCount(graph, childId, 100);
    graph = updateExclusionCount(graph, intervalId, 100);

    graph = recomputeGraph(graph, autoSettings);

    const interval = graph.intervals[intervalId];
    expect(interval.delta).toBe(0);
    expect(interval.exclusion?.total).toBe(100);
  });

  it('maintains auto remainder row for exclusion reasons', () => {
    let graph = createInitialGraph();
    const startId = graph.startNodeId!;
    graph = addNodeBelow(graph, startId);
    const intervalId = Object.keys(graph.intervals)[0];

    graph = updateExclusionCount(graph, intervalId, 150);
    graph = addExclusionReason(graph, intervalId);
    const reasonId = graph.intervals[intervalId].exclusion?.reasons.find((reason) => reason.kind === 'user')?.id;
    expect(reasonId).toBeDefined();
    graph = updateExclusionReasonCount(graph, intervalId, reasonId!, 40);

    graph = recomputeGraph(graph, autoSettings);

    const interval = graph.intervals[intervalId];
    const autoReason = interval.exclusion?.reasons.find((reason) => reason.kind === 'auto');
    expect(autoReason?.n).toBe(110);

    const manualGraph = recomputeGraph(graph, unlockedSettings);
    const manualAutoReason = manualGraph.intervals[intervalId].exclusion?.reasons.find((reason) => reason.kind === 'auto');
    expect(manualAutoReason?.n).toBe(autoReason?.n);
  });

  it('supports branching without disturbing main flow', () => {
    let graph = createInitialGraph();
    const rootId = graph.startNodeId!;
    graph = addNodeBelow(graph, rootId); // first child
    const firstChildId = graph.nodes[rootId].childIds[0];
    graph = addNodeBelow(graph, firstChildId); // continue main path
    graph = addNodeBelow(graph, rootId); // add branch child

    const children = graph.nodes[rootId].childIds;
    expect(children.length).toBe(2);
    expect(children[0]).toBe(firstChildId);
  });

  it('removes a node and its subtree', () => {
    let graph = createInitialGraph();
    const rootId = graph.startNodeId!;
    graph = addNodeBelow(graph, rootId);
    const firstChildId = graph.nodes[rootId].childIds[0];
    graph = addNodeBelow(graph, firstChildId);
    const grandChildId = graph.nodes[firstChildId].childIds[0];

    graph = removeNode(graph, firstChildId);
    expect(graph.nodes[firstChildId]).toBeUndefined();
    expect(graph.nodes[grandChildId]).toBeUndefined();
    expect(graph.nodes[rootId].childIds.length).toBe(0);
  });
});
