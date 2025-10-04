import React from 'react';
import { useAppStore } from '../state/useStore';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../ui/Inspector';
import { Toolbar } from '../ui/Toolbar';
import { getSelectionKind } from '../model/graph';
import type { PersistedProject } from '../model/types';
import { generateSvg } from '../export/svg';
import { downloadBlob, downloadString } from '../export/download';
import { renderPngBlob } from '../export/png';

export const App: React.FC = () => {
  const graph = useAppStore((state) => state.graph);
  const settings = useAppStore((state) => state.settings);
  const {
    addNodeBelow,
    addBranchChild,
    selectById,
    toggleAutoCalc,
    toggleArrowsGlobal,
    toggleCountFormat,
    toggleFreeEdit,
    undo,
    redo,
    removeNode,
    createExportSnapshot,
    importSnapshot,
    reset,
  } = useAppStore((state) => state.actions);

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
          }
        }}
        onToggleAutoCalc={toggleAutoCalc}
        onToggleArrows={toggleArrowsGlobal}
        onToggleCountFormat={toggleCountFormat}
        onToggleFreeEdit={toggleFreeEdit}
        onUndo={undo}
        onRedo={redo}
        onExportSvg={() => {
          const snapshotSvg = generateSvg(graph, settings);
          downloadString(snapshotSvg, 'consort-flow.svg', 'image/svg+xml;charset=utf-8');
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
        }}
        onExportJson={() => {
          const exportSnapshot = createExportSnapshot();
          downloadString(JSON.stringify(exportSnapshot, null, 2), 'consort-flow.json', 'application/json');
        }}
        onReset={reset}
        onImportJson={(file) => {
          void (async () => {
            try {
              const text = await file.text();
              const parsed = JSON.parse(text) as unknown;
              if (!isPersistedProject(parsed)) {
                throw new Error('Invalid project file');
              }
              importSnapshot(parsed);
            } catch (error) {
              alert('Unable to import the selected file. Please verify it is a valid project JSON.');
              console.error(error);
            }
          })();
        }}
      />
      <div className="app-layout">
        <Canvas
          graph={graph}
          settings={settings}
          onSelect={selectById}
          onCreateBelow={(nodeId) => {
            addNodeBelow(nodeId);
          }}
          onBranch={(nodeId) => {
            addBranchChild(nodeId);
          }}
          onRemove={(nodeId) => {
            removeNode(nodeId);
          }}
        />
        <Inspector graph={graph} settings={settings} />
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
