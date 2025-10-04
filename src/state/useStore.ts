import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { AppSettings, CountFormat, GraphState, IntervalId, NodeId, PersistedProject } from '../model/types';
import {
  addNodeBelow,
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
} from '../model/graph';

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
    toggleAutoCalc: () => void;
    toggleArrowsGlobal: () => void;
    toggleCountFormat: () => void;
    toggleFreeEdit: () => void;
    toggleArrow: (intervalId: IntervalId) => void;
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
  arrowsGlobal: true,
  countFormat: 'upper',
  freeEdit: false,
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
  return {
    past,
    future: [],
  };
}

export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        graph: defaultGraph,
        settings: defaultSettings,
        history: { past: [], future: [] },
        actions: {
          addNodeBelow: (parentId) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const parent = state.graph.nodes[parentId];
              let targetParentId = parentId;
              if (parent?.childIds && parent.childIds.length > 0) {
                targetParentId = parent.childIds[parent.childIds.length - 1];
              }
              const updatedGraph = recomputeGraph(addNodeBelow(state.graph, targetParentId), state.settings);
              return {
                ...state,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          addBranchChild: (parentId) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => ({
              ...state,
              graph: (() => {
                let nextGraph = state.graph;
                const parent = nextGraph.nodes[parentId];
                const currentChildren = parent?.childIds?.length ?? 0;
                if (currentChildren === 0) {
                  nextGraph = addNodeBelow(nextGraph, parentId);
                  nextGraph = addNodeBelow(nextGraph, parentId);
                } else {
                  nextGraph = addNodeBelow(nextGraph, parentId);
                }
                return recomputeGraph(nextGraph, state.settings);
              })(),
              history: pushHistory(state.history, prev),
            }));
          },
          updateNodeText: (nodeId, textLines) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const updatedGraph = recomputeGraph(updateNodeText(state.graph, nodeId, textLines), state.settings);
              return {
                ...state,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          updateNodeCount: (nodeId, value, override) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const updatedGraph = recomputeGraph(
                updateNodeCount(state.graph, nodeId, value, override, {
                  skipBranchRebalance: state.settings.freeEdit,
                }),
                state.settings
              );
              return {
                ...state,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          updateExclusionLabel: (intervalId, label) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const updatedGraph = recomputeGraph(updateExclusionLabel(state.graph, intervalId, label), state.settings);
              return {
                ...state,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          updateExclusionCount: (intervalId, value, override) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const updatedGraph = recomputeGraph(
                updateExclusionCount(state.graph, intervalId, value, override),
                state.settings
              );
              return {
                ...state,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          addExclusionReason: (intervalId) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => ({
              ...state,
              graph: recomputeGraph(addExclusionReason(state.graph, intervalId), state.settings),
              history: pushHistory(state.history, prev),
            }));
          },
          updateExclusionReasonLabel: (intervalId, reasonId, label) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => ({
              ...state,
              graph: recomputeGraph(updateExclusionReasonLabel(state.graph, intervalId, reasonId, label), state.settings),
              history: pushHistory(state.history, prev),
            }));
          },
          updateExclusionReasonCount: (intervalId, reasonId, value, override) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => ({
              ...state,
              graph: recomputeGraph(
                updateExclusionReasonCount(state.graph, intervalId, reasonId, value, override),
                state.settings
              ),
              history: pushHistory(state.history, prev),
            }));
          },
          removeExclusionReason: (intervalId, reasonId) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => ({
              ...state,
              graph: recomputeGraph(removeExclusionReason(state.graph, intervalId, reasonId), state.settings),
              history: pushHistory(state.history, prev),
            }));
          },
          removeNode: (nodeId) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => ({
              ...state,
              graph: recomputeGraph(removeNode(state.graph, nodeId), state.settings),
              history: pushHistory(state.history, prev),
            }));
          },
          toggleAutoCalc: () => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const nextSettings: AppSettings = { ...state.settings, autoCalc: !state.settings.autoCalc };
              const updatedGraph = recomputeGraph(state.graph, nextSettings);
              return {
                ...state,
                settings: nextSettings,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          toggleArrowsGlobal: () => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const nextSettings: AppSettings = { ...state.settings, arrowsGlobal: !state.settings.arrowsGlobal };
              return {
                ...state,
                settings: nextSettings,
                history: pushHistory(state.history, prev),
              };
            });
          },
          toggleCountFormat: () => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const nextFormat: CountFormat = state.settings.countFormat === 'upper' ? 'parenthetical' : 'upper';
              const nextSettings: AppSettings = { ...state.settings, countFormat: nextFormat };
              const updatedGraph = recomputeGraph(state.graph, nextSettings);
              return {
                ...state,
                settings: nextSettings,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          toggleFreeEdit: () => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const nextSettings: AppSettings = { ...state.settings, freeEdit: !state.settings.freeEdit };
              const updatedGraph = recomputeGraph(state.graph, nextSettings);
              return {
                ...state,
                settings: nextSettings,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          toggleArrow: (intervalId) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => {
              const updatedGraph = recomputeGraph(toggleArrow(state.graph, intervalId), state.settings);
              return {
                ...state,
                graph: updatedGraph,
                history: pushHistory(state.history, prev),
              };
            });
          },
          selectById: (id) => {
            set((state) => ({
              ...state,
              graph: setSelected(state.graph, id),
            }));
          },
          navigateSelection: (direction) => {
            const nextId = navigateSelection(get().graph, direction);
            if (nextId) {
              set((state) => ({
                ...state,
                graph: setSelected(state.graph, nextId),
              }));
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
              return {
                ...state,
                graph: prev.graph,
                settings: prev.settings,
                history: { past, future },
              };
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
              return {
                ...state,
                graph: next.graph,
                settings: next.settings,
                history: { past, future },
              };
            });
          },
          reset: () => {
            set(() => ({
              graph: recomputeGraph(createInitialGraph(), defaultSettings),
              settings: defaultSettings,
              history: { past: [], future: [] },
            }));
          },
          createExportSnapshot: () => {
            const state = get();
            return {
              graph: snapshotGraph(state.graph),
              settings: structuredClone(state.settings),
              version: 1,
            };
          },
          importSnapshot: (snapshot) => {
            const prev = cloneSnapshot(get().graph, get().settings);
            set((state) => ({
              graph: recomputeGraph(snapshot.graph, snapshot.settings),
              settings: snapshot.settings,
              history: pushHistory(state.history, prev),
            }));
          },
        },
      }),
      {
        name: 'consort-flow-v1',
        partialize: (state: AppStore) => ({
          graph: state.graph,
          settings: state.settings,
        }),
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<AppStore> | undefined;
          const mergedSettings = {
            ...currentState.settings,
            ...(persisted?.settings ?? {}),
          } satisfies AppSettings;
          if (!mergedSettings.countFormat) {
            mergedSettings.countFormat = 'upper';
          }
          if (typeof mergedSettings.freeEdit !== 'boolean') {
            mergedSettings.freeEdit = false;
          }
          return {
            ...currentState,
            ...persisted,
            settings: mergedSettings,
          } satisfies AppStore;
        },
      }
    )
  )
);
