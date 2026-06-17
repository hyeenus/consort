import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../state/useStore';

export type ExportKind = 'svg' | 'png300' | 'png600' | 'png1000' | 'jpg' | 'json' | 'print';

interface ToolbarProps {
  onExport: (kind: ExportKind) => void;
  onImport: (file: File) => void;
  onShowHelp: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onExport, onImport, onShowHelp }) => {
  const settings = useAppStore((state) => state.settings);
  const canUndo = useAppStore((state) => state.history.past.length > 0);
  const canRedo = useAppStore((state) => state.history.future.length > 0);
  const graph = useAppStore((state) => state.graph);
  const { toggleAutoCalc, toggleFreeEdit, undo, redo, reset, addNodeBelow, addPhase, selectById } = useAppStore(
    (state) => state.actions
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const addStep = () => {
    const target = graph.selectedId && graph.nodes[graph.selectedId] ? graph.selectedId : graph.startNodeId;
    if (target) {
      addNodeBelow(target);
    }
  };

  const handleExport = (kind: ExportKind) => {
    setExportOpen(false);
    onExport(kind);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="brand-mark" aria-hidden>
          ▦
        </span>
        <div>
          <strong>Flowchart Builder</strong>
          <small>Publication-ready patient selection diagrams</small>
        </div>
      </div>

      <div className="toolbar-actions">
        <div className="toolbar-group">
          <button type="button" className="primary" onClick={addStep}>
            + Add step
          </button>
          <button type="button" onClick={() => addPhase()}>
            + Phase
          </button>
        </div>

        <div className="toolbar-group">
          <Toggle active={!settings.autoCalc} onClick={toggleAutoCalc} activeLabel="Counts: manual" inactiveLabel="Counts: auto" />
          <Toggle active={settings.freeEdit} onClick={toggleFreeEdit} activeLabel="Free edit: on" inactiveLabel="Free edit: off" />
        </div>

        <div className="toolbar-group">
          <button type="button" disabled={!canUndo} onClick={undo} title="Undo (Cmd/Ctrl+Z)">
            ↶
          </button>
          <button type="button" disabled={!canRedo} onClick={redo} title="Redo (Shift+Cmd/Ctrl+Z)">
            ↷
          </button>
        </div>

        <div className="toolbar-group export-menu" ref={exportRef}>
          <button type="button" className="primary" onClick={() => setExportOpen((open) => !open)}>
            Export ▾
          </button>
          {exportOpen && (
            <div className="dropdown">
              <button onClick={() => handleExport('svg')}>SVG (vector)</button>
              <button onClick={() => handleExport('png300')}>PNG · 300 dpi</button>
              <button onClick={() => handleExport('png600')}>PNG · 600 dpi</button>
              <button onClick={() => handleExport('png1000')}>PNG · 1000 dpi (line art)</button>
              <button onClick={() => handleExport('jpg')}>JPG · 600 dpi</button>
              <div className="dropdown-divider" />
              <button onClick={() => handleExport('print')}>Print…</button>
              <button onClick={() => handleExport('json')}>Save project (JSON)</button>
              <button onClick={() => fileInputRef.current?.click()}>Open project (JSON)</button>
            </div>
          )}
        </div>

        <div className="toolbar-group">
          <button type="button" onClick={onShowHelp} title="Help">
            ?
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear the canvas and start over? You can undo this.')) {
                reset();
                selectById(undefined);
              }
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onImport(file);
          }
          event.target.value = '';
        }}
      />
    </header>
  );
};

const Toggle: React.FC<{ active: boolean; onClick: () => void; activeLabel: string; inactiveLabel: string }> = ({
  active,
  onClick,
  activeLabel,
  inactiveLabel,
}) => (
  <button type="button" className={active ? 'toggle active' : 'toggle'} onClick={onClick}>
    {active ? activeLabel : inactiveLabel}
  </button>
);
