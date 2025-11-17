import React from 'react';
import { useAppStore } from '../state/useStore';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../ui/Inspector';
import { Toolbar } from '../ui/Toolbar';
import { getSelectionKind } from '../model/graph';
import type { AppSettings, GraphState, PersistedProject } from '../model/types';
import { generateSvg } from '../export/svg';
import { downloadBlob, downloadString } from '../export/download';
import { renderPngBlob } from '../export/png';
import { HelpProvider, useHelp } from '../help/HelpContext';

const welcomeHelpMessage = {
  title: 'Welcome to the CONSORT builder',
  body: (
    <div>
      <p>
        This tool helps you outline CONSORT-style participant flow diagrams. Start by selecting boxes on the canvas,
        editing their text, and letting the app keep patient totals balanced.
      </p>
      <p>Use the toolbar to add steps, format counts, or export polished SVG/PNG files for publication.</p>
    </div>
  ),
};

export const App: React.FC = () => {
  const graph = useAppStore((state) => state.graph);
  const settings = useAppStore((state) => state.settings);
  const {
    addNodeBelow,
    addBranchChild,
    addPhase,
    selectById,
    toggleAutoCalc,
    toggleArrowsGlobal,
    toggleCountFormat,
    toggleFreeEdit,
    undo,
    redo,
    removeNode,
    updatePhaseBounds,
    updatePhaseLabel,
    removePhase,
    createExportSnapshot,
    importSnapshot,
    reset,
    setHelpEnabled,
  } = useAppStore((state) => state.actions);

  return (
    <HelpProvider
      helpEnabled={settings.helpEnabled}
      onDisableHelp={() => setHelpEnabled(false)}
      welcomeMessage={welcomeHelpMessage}
    >
      <AppContent
        graph={graph}
        settings={settings}
        actions={{
          addNodeBelow,
          addBranchChild,
          addPhase,
          selectById,
          toggleAutoCalc,
          toggleArrowsGlobal,
          toggleCountFormat,
          toggleFreeEdit,
          undo,
          redo,
          removeNode,
          updatePhaseBounds,
          updatePhaseLabel,
          removePhase,
          createExportSnapshot,
          importSnapshot,
          reset,
          setHelpEnabled,
        }}
      />
    </HelpProvider>
  );
};

interface AppContentProps {
  graph: GraphState;
  settings: AppSettings;
  actions: {
    addNodeBelow: (parentId: string) => void;
    addBranchChild: (parentId: string) => void;
    addPhase: () => void;
    selectById: (id: string | undefined) => void;
    toggleAutoCalc: () => void;
    toggleArrowsGlobal: () => void;
    toggleCountFormat: () => void;
    toggleFreeEdit: () => void;
    undo: () => void;
    redo: () => void;
    removeNode: (nodeId: string) => void;
    updatePhaseBounds: (phaseId: string, startNodeId: string, endNodeId: string) => void;
    updatePhaseLabel: (phaseId: string, label: string) => void;
    removePhase: (phaseId: string) => void;
    createExportSnapshot: () => PersistedProject;
    importSnapshot: (snapshot: PersistedProject) => void;
    reset: () => void;
    setHelpEnabled: (value: boolean) => void;
  };
}

const AppContent: React.FC<AppContentProps> = ({ graph, settings, actions }) => {
  const {
    addNodeBelow,
    addBranchChild,
    addPhase,
    selectById,
    toggleAutoCalc,
    toggleArrowsGlobal,
    toggleCountFormat,
    toggleFreeEdit,
    undo,
    redo,
    removeNode,
    updatePhaseBounds,
    updatePhaseLabel,
    removePhase,
    createExportSnapshot,
    importSnapshot,
    reset,
    setHelpEnabled,
  } = actions;
  const { requestHelp } = useHelp();

  return (
    <div className="app-shell">
      <Toolbar
        selectionKind={getSelectionKind(graph)}
        settings={settings}
        onAddStep={() => {
          const selectionKind = getSelectionKind(graph);
          const target = selectionKind === 'node' && graph.selectedId ? graph.selectedId : graph.startNodeId;
          if (target) {
            addNodeBelow(target);
            requestHelp('add-step', {
              title: 'Adding steps',
              body: (
                <p>
                  New boxes inherit their parent counts. Add them where you want the next patient decision point, then
                  adjust the text on the right.
                </p>
              ),
            });
          }
        }}
        onToggleAutoCalc={() => {
          toggleAutoCalc();
          requestHelp('auto-calc', {
            title: 'Locked vs unlocked counts',
            body: (
              <p>
                Locked numbers are recalculated automatically from parents. Unlocking lets you key in totals manually
                when you need to override them.
              </p>
            ),
          });
        }}
        onToggleArrows={() => {
          toggleArrowsGlobal();
          requestHelp('arrows', {
            title: 'Lines and arrows',
            body: (
              <p>
                Arrows emphasize forward flow while straight lines keep the chart minimal. Toggle to match the style of
                your manuscript.
              </p>
            ),
          });
        }}
        onToggleCountFormat={() => {
          toggleCountFormat();
          requestHelp('count-format', {
            title: 'How counts are shown',
            body: (
              <p>
                Use capital N for CONSORT defaults or switch to parenthetical (n) formatting when embedding counts into
                text blocks.
              </p>
            ),
          });
        }}
        onToggleFreeEdit={() => {
          toggleFreeEdit();
          requestHelp('free-edit', {
            title: 'Free edit mode',
            body: (
              <p>
                Free edit lets you type any labels or counts, even if totals do not add up. Turn it off to bring back
                automatic balancing.
              </p>
            ),
          });
        }}
        onUndo={undo}
        onRedo={redo}
        onAddPhase={() => {
          addPhase();
          requestHelp('phase-boxes', {
            title: 'Phase labels',
            body: (
              <p>
                Phase markers run down the left side of the diagram. Drag their handles to snap the top and bottom to
                any main-flow box, or rename them in the inspector.
              </p>
            ),
          });
        }}
        onExportSvg={() => {
          const snapshotSvg = generateSvg(graph, settings);
          downloadString(snapshotSvg, 'consort-flow.svg', 'image/svg+xml;charset=utf-8');
          requestHelp('export-svg', {
            title: 'SVG export',
            body: (
              <p>
                SVG stays crystal clear at any size and can be edited further in vector tools such as Illustrator, but
                some journal systems only accept raster images.
              </p>
            ),
          });
        }}
        onExportPng={() => {
          void (async () => {
            try {
              const blob = await renderPngBlob(graph, settings, { scale: 2 });
              downloadBlob(blob, 'consort-flow.png');
            } catch (error) {
              alert('PNG export failed. The SVG export remains available.');
              console.error(error);
            }
          })();
          requestHelp('export-png', {
            title: 'PNG export',
            body: (
              <p>
                PNG works everywhere and is best for sharing previews, but avoid resizing it too much to prevent
                blurriness.
              </p>
            ),
          });
        }}
        onExportJson={() => {
          const exportSnapshot = createExportSnapshot();
          downloadString(JSON.stringify(exportSnapshot, null, 2), 'consort-flow.json', 'application/json');
          requestHelp('export-json', {
            title: 'JSON project export',
            body: (
              <p>
                JSON saves the entire project so you can continue later or hand it to a teammate. It is not meant for
                publishing directly.
              </p>
            ),
          });
        }}
        onImportJson={(file) => {
          void (async () => {
            try {
              const text = await file.text();
              const parsed = JSON.parse(text) as unknown;
              if (!isPersistedProject(parsed)) {
                throw new Error('Invalid project file');
              }
              importSnapshot(parsed);
              requestHelp('import-json', {
                title: 'Importing projects',
                body: (
                  <p>
                    Imports replace the current flow with everything from the file. Keep a backup export if you need to
                    return to your previous state.
                  </p>
                ),
              });
            } catch (error) {
              alert('Unable to import the selected file. Please verify it is a valid project JSON.');
              console.error(error);
            }
          })();
        }}
        onReset={reset}
        onToggleHelp={() => {
          setHelpEnabled(!settings.helpEnabled);
        }}
      />
      <div className="app-layout">
        <Canvas
          graph={graph}
          settings={settings}
          onSelect={selectById}
          onCreateBelow={(nodeId) => {
            addNodeBelow(nodeId);
            requestHelp('add-step', {
              title: 'Adding steps',
              body: (
                <p>
                  New boxes inherit their parent counts. Add them where you want the next patient decision point, then
                  adjust the text on the right.
                </p>
              ),
            });
          }}
          onBranch={(nodeId) => {
            addBranchChild(nodeId);
            requestHelp('canvas-basics', {
              title: 'Branching paths',
              body: (
                <p>
                  Branching splits the current box into multiple outcomes. Balances are maintained automatically unless
                  you switch to free edit.
                </p>
              ),
            });
          }}
          onRemove={(nodeId) => {
            removeNode(nodeId);
          }}
          onAdjustPhase={(phaseId, startNodeId, endNodeId) => {
            updatePhaseBounds(phaseId, startNodeId, endNodeId);
          }}
        />
        <Inspector
          graph={graph}
          settings={settings}
          onUpdatePhaseLabel={updatePhaseLabel}
          onRemovePhase={removePhase}
          onAdjustPhase={updatePhaseBounds}
        />
      </div>
    </div>
  );
};

function isPersistedProject(value: unknown): value is PersistedProject {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { version?: number; graph?: unknown; settings?: unknown };
  const hasGraph = typeof candidate.graph === 'object' && candidate.graph !== null;
  const hasSettings = typeof candidate.settings === 'object' && candidate.settings !== null;
  return candidate.version === 1 && hasGraph && hasSettings;
}
