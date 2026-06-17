import React from 'react';
import { useAppStore } from '../state/useStore';
import { STUDY_TEMPLATES } from '../model/templates';
import { STYLE_PRESETS } from '../model/style';

export const LeftPanel: React.FC = () => {
  const activePreset = useAppStore((state) => state.settings.style.preset);
  const { applyTemplate, applyStylePreset } = useAppStore((state) => state.actions);

  const handleTemplate = (id: string, name: string) => {
    if (window.confirm(`Replace the current diagram with the “${name}” template? You can undo this.`)) {
      applyTemplate(id);
    }
  };

  return (
    <aside className="left-panel">
      <section>
        <h3>Start from a template</h3>
        <p className="panel-hint">Pre-built flows you can edit. Replaces the current diagram.</p>
        <div className="template-list">
          {STUDY_TEMPLATES.map((template) => (
            <button key={template.id} className="template-card" onClick={() => handleTemplate(template.id, template.name)}>
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Journal style presets</h3>
        <p className="panel-hint">Fonts and formatting matched to common house styles.</p>
        <div className="preset-list">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={activePreset === preset.id ? 'preset-card active' : 'preset-card'}
              onClick={() => applyStylePreset(preset.id)}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
};
