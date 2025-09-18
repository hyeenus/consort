import { describe, expect, it } from 'vitest';
import { addNodeBelow, createInitialGraph, navigateSelection, recomputeGraph, setSelected } from '../model/graph';
import { AppSettings } from '../model/types';

const autoSettings: AppSettings = { autoCalc: true, arrowsGlobal: true };

describe('keyboard navigation helpers', () => {
  it('moves from node to child node when navigating down', () => {
    let graph = createInitialGraph();
    const rootId = graph.startNodeId!;
    graph = addNodeBelow(graph, rootId);
    graph = recomputeGraph(graph, autoSettings);
    const intervalId = Object.keys(graph.intervals)[0];
    const childId = graph.intervals[intervalId].childId;

    graph = setSelected(graph, rootId);
    const nextId = navigateSelection(graph, 'down');
    expect(nextId).toBe(childId);
  });

  it('moves from node to its outgoing interval when navigating right', () => {
    let graph = createInitialGraph();
    const rootId = graph.startNodeId!;
    graph = addNodeBelow(graph, rootId);
    graph = recomputeGraph(graph, autoSettings);
    const intervalId = Object.keys(graph.intervals)[0];

    graph = setSelected(graph, rootId);
    const nextId = navigateSelection(graph, 'right');
    expect(nextId).toBe(intervalId);
  });
});
