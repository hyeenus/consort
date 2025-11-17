import React, { useRef } from 'react';
import { AppSettings, SelectionKind } from '../model/types';

interface ToolbarProps {
  selectionKind: SelectionKind;
  settings: AppSettings;
  onAddStep: () => void;
  onAddPhase: () => void;
  onToggleAutoCalc: () => void;
  onToggleArrows: () => void;
  onToggleCountFormat: () => void;
  onToggleFreeEdit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onReset: () => void;
  onToggleHelp: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  settings,
  onAddStep,
  onAddPhase,
  onToggleAutoCalc,
  onToggleArrows,
  onToggleCountFormat,
  onToggleFreeEdit,
  onUndo,
  onRedo,
  onExportSvg,
  onExportPng,
  onExportJson,
  onImportJson,
  onReset,
  onToggleHelp,
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
        <button type="button" onClick={onAddPhase}>
          + Add Phase
        </button>
        <button type="button" onClick={onToggleAutoCalc}>
          {settings.autoCalc ? 'Unlock Numbers' : 'Lock Numbers'}
        </button>
        <button type="button" onClick={onToggleArrows}>
          {settings.arrowsGlobal ? 'Show Lines' : 'Show Arrows'}
        </button>
        <button type="button" onClick={onToggleCountFormat}>
          {settings.countFormat === 'upper' ? 'Show (n)' : 'Show N'}
        </button>
        <button type="button" onClick={onToggleFreeEdit}>
          {settings.freeEdit ? 'Exit Free Edit' : 'Free Edit'}
        </button>
        <button type="button" onClick={onToggleHelp}>
          Help {settings.helpEnabled ? 'On' : 'Off'}
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
