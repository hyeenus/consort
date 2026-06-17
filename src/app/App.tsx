import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../state/useStore';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../ui/Inspector';
import { StyleControls } from '../ui/StyleControls';
import { LeftPanel } from '../ui/LeftPanel';
import { Toolbar, ExportKind } from '../ui/Toolbar';
import { HelpModal } from '../ui/HelpModal';
import { generateSvg } from '../export/svg';
import { renderRasterBlob } from '../export/png';
import { downloadBlob, downloadString } from '../export/download';
import type { PersistedProject } from '../model/types';

type RightTab = 'edit' | 'format';

export const App: React.FC = () => {
  const graph = useAppStore((state) => state.graph);
  const settings = useAppStore((state) => state.settings);
  const actions = useAppStore((state) => state.actions);

  const [rightTab, setRightTab] = useState<RightTab>('edit');
  const [leftOpen, setLeftOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  // When the selection changes to something concrete, show the Edit tab.
  useEffect(() => {
    if (graph.selectedId) {
      setRightTab('edit');
    }
  }, [graph.selectedId]);

  const handleExport = useCallback(async (kind: ExportKind) => {
    const state = useAppStore.getState();
    const { graph: g, settings: s } = state;
    try {
      switch (kind) {
        case 'svg':
          downloadString(generateSvg(g, s), 'flow-diagram.svg', 'image/svg+xml;charset=utf-8');
          break;
        case 'json':
          downloadString(JSON.stringify(state.actions.createExportSnapshot(), null, 2), 'flow-diagram.json', 'application/json');
          break;
        case 'print':
          printDiagram(generateSvg(g, s));
          break;
        case 'jpg': {
          const { blob } = await renderRasterBlob(g, s, { dpi: 600, format: 'jpeg' });
          downloadBlob(blob, 'flow-diagram.jpg');
          break;
        }
        default: {
          const dpi = kind === 'png600' ? 600 : kind === 'png1000' ? 1000 : 300;
          const { blob } = await renderRasterBlob(g, s, { dpi, format: 'png' });
          downloadBlob(blob, `flow-diagram-${dpi}dpi.png`);
        }
      }
    } catch (error) {
      console.error(error);
      window.alert('That export failed. SVG export always works as a fallback.');
    }
  }, []);

  const handleImport = useCallback(
    (file: File) => {
      void (async () => {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text) as unknown;
          if (!isProject(parsed)) {
            throw new Error('Invalid project file');
          }
          actions.importSnapshot(parsed);
        } catch (error) {
          console.error(error);
          window.alert('Could not open that file. Make sure it is a project JSON exported from this app.');
        }
      })();
    },
    [actions]
  );

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          actions.redo();
        } else {
          actions.undo();
        }
        return;
      }
      if (inField) {
        return;
      }
      if (mod && event.key === 'ArrowDown') {
        event.preventDefault();
        const { graph: g } = useAppStore.getState();
        const target2 = g.selectedId && g.nodes[g.selectedId] ? g.selectedId : g.startNodeId;
        if (target2) actions.addNodeBelow(target2);
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const direction = event.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
        actions.navigateSelection(direction);
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const { graph: g } = useAppStore.getState();
        if (g.selectedId && g.nodes[g.selectedId] && g.startNodeId !== g.selectedId) {
          event.preventDefault();
          actions.removeNode(g.selectedId);
        }
        return;
      }
      if (event.key === 'Escape') {
        actions.selectById(undefined);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);

  return (
    <div className="app-shell">
      <Toolbar onExport={handleExport} onImport={handleImport} onShowHelp={() => setHelpOpen(true)} />
      <div className="app-body">
        <div className={leftOpen ? 'left-rail open' : 'left-rail'}>
          {leftOpen && <LeftPanel />}
          <button className="rail-toggle" onClick={() => setLeftOpen((open) => !open)} title={leftOpen ? 'Hide panel' : 'Show templates & presets'}>
            {leftOpen ? '‹' : '›'}
          </button>
        </div>

        <Canvas
          graph={graph}
          settings={settings}
          onSelect={actions.selectById}
          onCreateBelow={actions.addNodeBelow}
          onBranch={actions.addBranchChild}
          onRemove={actions.removeNode}
          onNudgeNode={actions.nudgeNode}
          onBeginNodeDrag={actions.commitHistorySnapshot}
          onSetPhaseBounds={actions.setPhaseBoundsLive}
        />

        <aside className="right-panel">
          <div className="tab-bar">
            <button className={rightTab === 'edit' ? 'tab active' : 'tab'} onClick={() => setRightTab('edit')}>
              Edit
            </button>
            <button className={rightTab === 'format' ? 'tab active' : 'tab'} onClick={() => setRightTab('format')}>
              Format
            </button>
          </div>
          <div className="right-panel-content">{rightTab === 'edit' ? <Inspector /> : <StyleControls />}</div>
        </aside>
      </div>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

function isProject(value: unknown): value is PersistedProject {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { graph?: unknown; settings?: unknown };
  return typeof candidate.graph === 'object' && candidate.graph !== null && typeof candidate.settings === 'object';
}

function printDiagram(svg: string): void {
  const win = window.open('', '_blank', 'noopener,nopener,width=900,height=700');
  if (!win) {
    window.alert('Pop-up blocked. Allow pop-ups to print, or export SVG/PNG instead.');
    return;
  }
  win.document.write(
    `<!DOCTYPE html><html><head><title>Flow diagram</title><style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center;align-items:flex-start}svg{max-width:100%;height:auto}</style></head><body>${svg}</body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}
