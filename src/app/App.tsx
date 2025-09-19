import React, { useEffect, useState } from 'react';
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
    navigateSelection,
    selectById,
    toggleAutoCalc,
    toggleArrowsGlobal,
    undo,
    redo,
    toggleArrow,
    createExportSnapshot,
    importSnapshot,
    reset,
  } = useAppStore((state) => state.actions);

  const [focusSignal, triggerFocus] = useState(0);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const shift = event.shiftKey;
      const key = event.key;
      const selectionKind = getSelectionKind(graph);
      const selectedId = graph.selectedId;

      if (meta && key.toLowerCase() === 'z') {
        event.preventDefault();
        if (shift) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (meta && key === 'ArrowDown') {
        if (selectionKind === 'node' && selectedId) {
          event.preventDefault();
          addNodeBelow(selectedId);
        }
        return;
      }

      if (meta && key === 'ArrowRight') {
        if (selectionKind === 'node' && selectedId) {
          const intervals = Object.values(graph.intervals).find((interval) => interval.parentId === selectedId);
          if (intervals) {
            event.preventDefault();
            selectById(intervals.id);
          }
        }
        return;
      }

      if (key === 'ArrowUp') {
        event.preventDefault();
        navigateSelection('up');
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        navigateSelection('down');
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        navigateSelection('left');
        return;
      }
      if (key === 'ArrowRight') {
        event.preventDefault();
        navigateSelection('right');
        return;
      }

      if (key === 'Enter' || key === 'F2') {
        event.preventDefault();
        triggerFocus((value) => value + 1);
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        selectById(undefined);
        return;
      }

      if (key.toLowerCase() === 'a') {
        if (selectionKind === 'interval' && selectedId) {
          event.preventDefault();
          toggleArrow(selectedId);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [graph, navigateSelection, selectById, toggleArrow, redo, undo, addNodeBelow]);

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
        />
        <Inspector graph={graph} settings={settings} focusSignal={focusSignal} />
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
