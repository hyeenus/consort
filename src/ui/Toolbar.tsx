import React, { useRef } from 'react';
import { AppSettings } from '../model/types';

interface ToolbarProps {
  selectionKind: 'node' | 'interval' | undefined;
  settings: AppSettings;
  onAddStep: () => void;
  onToggleAutoCalc: () => void;
  onToggleArrows: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onReset: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  settings,
  onAddStep,
  onToggleAutoCalc,
  onToggleArrows,
  onUndo,
  onRedo,
  onExportSvg,
  onExportPng,
  onExportJson,
  onImportJson,
  onReset,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button type="button" onClick={onAddStep}>
          + Add Step
        </button>
        <button type="button" onClick={onToggleAutoCalc}>
          {settings.autoCalc ? 'Unlock Numbers' : 'Lock Numbers'}
        </button>
        <button type="button" onClick={onToggleArrows}>
          {settings.arrowsGlobal ? 'Show Lines' : 'Show Arrows'}
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" onClick={onUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo}>
          Redo
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" onClick={onExportSvg}>
          Export SVG
        </button>
        <button type="button" onClick={onExportPng}>
          Export PNG
        </button>
        <button type="button" onClick={onExportJson}>
          Export JSON
        </button>
        <button type="button" onClick={handleImportClick}>
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onImportJson(file);
            }
            if (event.target) {
              event.target.value = '';
            }
          }}
        />
      </div>
    </header>
  );
};
