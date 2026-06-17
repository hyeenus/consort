import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { AppSettings, GraphState, IntervalId, NodeId, PersistedProject, PhaseEdgeMode } from '../model/types';
import {
  addNodeBelow,
  addPhase,
  createInitialGraph,
  navigateSelection,
  recomputeGraph,
  setSelected,
  updateExclusionCount,
  updateExclusionLabel,
  updateNodeCount,
  updateNodeText,
  toggleArrow,
  snapshotGraph,
  addExclusionReason,
  updateExclusionReasonLabel,
  updateExclusionReasonCount,
  removeExclusionReason,
  removeNode,
  updatePhaseLabel,
  updatePhaseBounds,
  setPhaseEdge,
  removePhase,
  nudgeNodeOffset,
  resetNodeOffset,
  clearManualLayout,
  setNodeWidthOverride,
  loadGraph,
} from '../model/graph';
import { clampStyle, DEFAULT_STYLE, DiagramStyle, getStylePreset } from '../model/style';
import { getTemplate } from '../model/templates';

interface HistorySnapshot {
  graph: GraphState;
  settings: AppSettings;
}

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

const HISTORY_LIMIT = 100;

interface AppStore {
  graph: GraphState;
  settings: AppSettings;
  history: HistoryState;
  actions: {
    addNodeBelow: (parentId: NodeId) => void;
    addBranchChild: (parentId: NodeId) => void;
    updateNodeText: (nodeId: NodeId, textLines: string[]) => void;
    updateNodeCount: (nodeId: NodeId, value: number | null, override?: string | null) => void;
    updateExclusionLabel: (intervalId: IntervalId, label: string) => void;
    updateExclusionCount: (intervalId: IntervalId, value: number | null, override?: string | null) => void;
    addExclusionReason: (intervalId: IntervalId) => void;
    updateExclusionReasonLabel: (intervalId: IntervalId, reasonId: string, label: string) => void;
    updateExclusionReasonCount: (
      intervalId: IntervalId,
      reasonId: string,
      value: number | null,
      override?: string | null
    ) => void;
    removeExclusionReason: (intervalId: IntervalId, reasonId: string) => void;
    removeNode: (nodeId: NodeId) => void;
    addPhase: () => void;
    updatePhaseLabel: (phaseId: string, label: string) => void;
    updatePhaseBounds: (phaseId: string, startNodeId: NodeId, endNodeId: NodeId) => void;
    setPhaseEdgeLive: (phaseId: string, edge: 'top' | 'bottom', nodeId: NodeId, mode: PhaseEdgeMode) => void;
    removePhase: (phaseId: string) => void;
    toggleAutoCalc: () => void;
    toggleFreeEdit: () => void;
    toggleArrow: (intervalId: IntervalId) => void;
    // Style + layout
    updateStyle: (patch: Partial<DiagramStyle>) => void;
    applyStylePreset: (id: string) => void;
    applyTemplate: (id: string) => void;
    nudgeNode: (nodeId: NodeId, delta: { x: number; y: number }) => void;
    resetNodePosition: (nodeId: NodeId) => void;
    clearLayout: () => void;
    setNodeWidth: (nodeId: NodeId, width: number | null) => void;
    commitHistorySnapshot: () => void;
    setHelpEnabled: (value: boolean) => void;
    selectById: (id: string | undefined) => void;
    navigateSelection: (direction: 'up' | 'down' | 'left' | 'right') => void;
    undo: () => void;
    redo: () => void;
    reset: () => void;
    createExportSnapshot: () => PersistedProject;
    importSnapshot: (snapshot: PersistedProject) => void;
  };
}

const defaultSettings: AppSettings = {
  autoCalc: true,
  freeEdit: false,
  helpEnabled: true,
  style: { ...DEFAULT_STYLE },
};

const defaultGraph = recomputeGraph(createInitialGraph(), defaultSettings);

function cloneSnapshot(graph: GraphState, settings: AppSettings): HistorySnapshot {
  return {
    graph: snapshotGraph(graph),
    settings: structuredClone(settings),
  };
}

function pushHistory(history: HistoryState, snapshot: HistorySnapshot): HistoryState {
  const past = [...history.past, snapshot];
  if (past.length > HISTORY_LIMIT) {
    past.splice(0, past.length - HISTORY_LIMIT);
  }
  return { past, future: [] };
}

export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
        /** Run a graph mutation with one undo step. */
        const withHistory = (mutate: (state: AppStore) => GraphState, options: { recompute?: boolean } = {}) => {
          const prev = cloneSnapshot(get().graph, get().settings);
          set((state) => {
            const nextGraph = mutate(state);
            const finalGraph = options.recompute === false ? nextGraph : recomputeGraph(nextGraph, state.settings);
            return { ...state, graph: finalGraph, history: pushHistory(state.history, prev) };
          });
        };

        return {
          graph: defaultGraph,
          settings: defaultSettings,
          history: { past: [], future: [] },
          actions: {
            addNodeBelow: (parentId) =>
              withHistory((state) => {
                const parent = state.graph.nodes[parentId];
                let target = parentId;
                if (parent?.childIds && parent.childIds.length > 0) {
                  target = parent.childIds[parent.childIds.length - 1];
                }
                return addNodeBelow(state.graph, target);
              }),
            addBranchChild: (parentId) =>
              withHistory((state) => {
                let next = state.graph;
                const parent = next.nodes[parentId];
                const currentChildren = parent?.childIds?.length ?? 0;
                if (currentChildren === 0) {
                  next = addNodeBelow(next, parentId);
                  next = addNodeBelow(next, parentId);
                } else {
                  next = addNodeBelow(next, parentId);
                }
                return next;
              }),
            updateNodeText: (nodeId, textLines) =>
              withHistory((state) => updateNodeText(state.graph, nodeId, textLines)),
            updateNodeCount: (nodeId, value, override) =>
              withHistory((state) =>
                updateNodeCount(state.graph, nodeId, value, override, {
                  skipBranchRebalance: state.settings.freeEdit,
                })
              ),
            updateExclusionLabel: (intervalId, label) =>
              withHistory((state) => updateExclusionLabel(state.graph, intervalId, label)),
            updateExclusionCount: (intervalId, value, override) =>
              withHistory((state) => updateExclusionCount(state.graph, intervalId, value, override)),
            addExclusionReason: (intervalId) =>
              withHistory((state) => addExclusionReason(state.graph, intervalId)),
            updateExclusionReasonLabel: (intervalId, reasonId, label) =>
              withHistory((state) => updateExclusionReasonLabel(state.graph, intervalId, reasonId, label)),
            updateExclusionReasonCount: (intervalId, reasonId, value, override) =>
              withHistory((state) =>
                updateExclusionReasonCount(state.graph, intervalId, reasonId, value, override)
              ),
            removeExclusionReason: (intervalId, reasonId) =>
              withHistory((state) => removeExclusionReason(state.graph, intervalId, reasonId)),
            removeNode: (nodeId) => withHistory((state) => removeNode(state.graph, nodeId)),
            addPhase: () => withHistory((state) => addPhase(state.graph), { recompute: false }),
            updatePhaseLabel: (phaseId, label) =>
              withHistory((state) => updatePhaseLabel(state.graph, phaseId, label), { recompute: false }),
            updatePhaseBounds: (phaseId, startNodeId, endNodeId) =>
              withHistory((state) => updatePhaseBounds(state.graph, phaseId, startNodeId, endNodeId), {
                recompute: false,
              }),
            setPhaseEdgeLive: (phaseId, edge, nodeId, mode) => {
              set((state) => ({
                ...state,
                graph: setPhaseEdge(state.graph, phaseId, edge, nodeId, mode),
              }));
            },
            removePhase: (phaseId) =>
              withHistory((state) => removePhase(state.graph, phaseId), { recompute: false }),
            toggleAutoCalc: () => {
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => {
                const nextSettings: AppSettings = { ...state.settings, autoCalc: !state.settings.autoCalc };
                return {
                  ...state,
                  settings: nextSettings,
                  graph: recomputeGraph(state.graph, nextSettings),
                  history: pushHistory(state.history, prev),
                };
              });
            },
            toggleFreeEdit: () => {
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => {
                const nextSettings: AppSettings = { ...state.settings, freeEdit: !state.settings.freeEdit };
                return {
                  ...state,
                  settings: nextSettings,
                  graph: recomputeGraph(state.graph, nextSettings),
                  history: pushHistory(state.history, prev),
                };
              });
            },
            toggleArrow: (intervalId) => withHistory((state) => toggleArrow(state.graph, intervalId)),
            updateStyle: (patch) => {
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => {
                const nextStyle = clampStyle({ ...state.settings.style, ...patch, preset: 'custom' });
                const nextSettings: AppSettings = { ...state.settings, style: nextStyle };
                return {
                  ...state,
                  settings: nextSettings,
                  graph: recomputeGraph(state.graph, nextSettings),
                  history: pushHistory(state.history, prev),
                };
              });
            },
            applyStylePreset: (id) => {
              const preset = getStylePreset(id);
              if (!preset) {
                return;
              }
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => {
                const nextSettings: AppSettings = {
                  ...state.settings,
                  style: clampStyle({ ...preset.style }),
                };
                return {
                  ...state,
                  settings: nextSettings,
                  graph: recomputeGraph(state.graph, nextSettings),
                  history: pushHistory(state.history, prev),
                };
              });
            },
            applyTemplate: (id) => {
              const template = getTemplate(id);
              if (!template) {
                return;
              }
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => ({
                ...state,
                graph: recomputeGraph(loadGraph(template.build()), state.settings),
                history: pushHistory(state.history, prev),
              }));
            },
            nudgeNode: (nodeId, delta) => {
              set((state) => ({
                ...state,
                graph: recomputeGraph(nudgeNodeOffset(state.graph, nodeId, delta), state.settings),
              }));
            },
            resetNodePosition: (nodeId) =>
              withHistory((state) => resetNodeOffset(state.graph, nodeId)),
            clearLayout: () => withHistory((state) => clearManualLayout(state.graph)),
            setNodeWidth: (nodeId, width) =>
              withHistory((state) => setNodeWidthOverride(state.graph, nodeId, width)),
            commitHistorySnapshot: () => {
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => ({ ...state, history: pushHistory(state.history, prev) }));
            },
            setHelpEnabled: (value) => {
              set((state) => ({ ...state, settings: { ...state.settings, helpEnabled: value } }));
            },
            selectById: (id) => {
              set((state) => ({ ...state, graph: setSelected(state.graph, id) }));
            },
            navigateSelection: (direction) => {
              const nextId = navigateSelection(get().graph, direction);
              if (nextId) {
                set((state) => ({ ...state, graph: setSelected(state.graph, nextId) }));
              }
            },
            undo: () => {
              set((state) => {
                const prev = state.history.past.at(-1);
                if (!prev) {
                  return state;
                }
                const past = state.history.past.slice(0, -1);
                const future = [cloneSnapshot(state.graph, state.settings), ...state.history.future];
                return { ...state, graph: prev.graph, settings: prev.settings, history: { past, future } };
              });
            },
            redo: () => {
              set((state) => {
                const next = state.history.future.at(0);
                if (!next) {
                  return state;
                }
                const future = state.history.future.slice(1);
                const past = [...state.history.past, cloneSnapshot(state.graph, state.settings)];
                return { ...state, graph: next.graph, settings: next.settings, history: { past, future } };
              });
            },
            reset: () => {
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => ({
                ...state,
                graph: recomputeGraph(createInitialGraph(), state.settings),
                history: pushHistory(state.history, prev),
              }));
            },
            createExportSnapshot: () => {
              const state = get();
              return {
                graph: snapshotGraph(state.graph),
                settings: structuredClone(state.settings),
                version: 2,
              };
            },
            importSnapshot: (snapshot) => {
              const prev = cloneSnapshot(get().graph, get().settings);
              set((state) => {
                const importedSettings: AppSettings = {
                  ...defaultSettings,
                  ...snapshot.settings,
                  style: clampStyle({ ...DEFAULT_STYLE, ...(snapshot.settings?.style ?? {}) }),
                };
                return {
                  ...state,
                  graph: recomputeGraph(snapshot.graph, importedSettings),
                  settings: importedSettings,
                  history: pushHistory(state.history, prev),
                };
              });
            },
          },
        };
      },
      {
        name: 'consort-flow-v2',
        partialize: (state: AppStore) => ({ graph: state.graph, settings: state.settings }),
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<AppStore> | undefined;
          const persistedSettings = (persisted?.settings ?? {}) as Partial<AppSettings>;
          const mergedStyle: DiagramStyle = clampStyle({
            ...DEFAULT_STYLE,
            ...(persistedSettings.style ?? {}),
          });
          const mergedSettings: AppSettings = {
            autoCalc: persistedSettings.autoCalc ?? currentState.settings.autoCalc,
            freeEdit: typeof persistedSettings.freeEdit === 'boolean' ? persistedSettings.freeEdit : false,
            helpEnabled:
              typeof persistedSettings.helpEnabled === 'boolean' ? persistedSettings.helpEnabled : true,
            style: mergedStyle,
          };
          const mergedGraph = {
            ...currentState.graph,
            ...(persisted?.graph ?? {}),
          } as GraphState;
          if (!Array.isArray(mergedGraph.phases)) {
            mergedGraph.phases = [];
          }
          const recomputed = recomputeGraph(mergedGraph, mergedSettings);
          return {
            ...currentState,
            graph: recomputed,
            settings: mergedSettings,
          } satisfies AppStore;
        },
      }
    )
  )
);
