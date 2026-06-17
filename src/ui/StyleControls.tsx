import React from 'react';
import { useAppStore } from '../state/useStore';
import { FONT_LABELS, FontKey, FIGURE_WIDTH_PRESETS, NumberStyle, ThousandsSep } from '../model/style';

const FONT_OPTIONS: FontKey[] = ['helvetica', 'arial', 'times', 'system'];
const NUMBER_OPTIONS: { value: NumberStyle; label: string }[] = [
  { value: 'N', label: 'N = 1 234' },
  { value: 'n', label: 'n = 1 234' },
  { value: 'plain', label: '1 234' },
];
const SEP_OPTIONS: { value: ThousandsSep; label: string }[] = [
  { value: 'space', label: '1 234 (space)' },
  { value: 'comma', label: '1,234 (comma)' },
  { value: 'period', label: '1.234 (period)' },
  { value: 'none', label: '1234 (none)' },
];

export const StyleControls: React.FC = () => {
  const style = useAppStore((state) => state.settings.style);
  const { updateStyle, clearLayout } = useAppStore((state) => state.actions);

  return (
    <div className="panel-stack">
      <section className="control-group">
        <h4>Typeface</h4>
        <div className="control-row">
          <label>Font</label>
          <select value={style.fontKey} onChange={(event) => updateStyle({ fontKey: event.target.value as FontKey })}>
            {FONT_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {FONT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <Range
          label="Font size"
          value={style.fontSize}
          min={9}
          max={28}
          step={1}
          suffix="px"
          onChange={(fontSize) => updateStyle({ fontSize })}
        />
        <div className="control-row">
          <label>Alignment</label>
          <div className="segmented">
            <button className={style.textAlign === 'center' ? 'active' : ''} onClick={() => updateStyle({ textAlign: 'center' })}>
              Center
            </button>
            <button className={style.textAlign === 'left' ? 'active' : ''} onClick={() => updateStyle({ textAlign: 'left' })}>
              Left
            </button>
          </div>
        </div>
      </section>

      <section className="control-group">
        <h4>Boxes &amp; lines</h4>
        <Range label="Box width" value={style.boxWidth} min={140} max={520} step={10} suffix="px" onChange={(boxWidth) => updateStyle({ boxWidth })} />
        <Range
          label="Exclusion width"
          value={style.exclusionWidth}
          min={120}
          max={480}
          step={10}
          suffix="px"
          onChange={(exclusionWidth) => updateStyle({ exclusionWidth })}
        />
        <Range label="Vertical spacing" value={style.verticalGap} min={24} max={160} step={2} suffix="px" onChange={(verticalGap) => updateStyle({ verticalGap })} />
        <Range label="Exclusion offset" value={style.exclusionGap} min={16} max={200} step={4} suffix="px" onChange={(exclusionGap) => updateStyle({ exclusionGap })} />
        <Range label="Line weight" value={style.lineWeight} min={0.5} max={4} step={0.1} suffix="pt" onChange={(lineWeight) => updateStyle({ lineWeight })} />
        <Range label="Corner radius" value={style.cornerRadius} min={0} max={24} step={1} suffix="px" onChange={(cornerRadius) => updateStyle({ cornerRadius })} />
      </section>

      <section className="control-group">
        <h4>Counts</h4>
        <div className="control-row">
          <label>Label</label>
          <select value={style.numberStyle} onChange={(event) => updateStyle({ numberStyle: event.target.value as NumberStyle })}>
            {NUMBER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="control-row">
          <label>Separator</label>
          <select value={style.thousandsSep} onChange={(event) => updateStyle({ thousandsSep: event.target.value as ThousandsSep })}>
            {SEP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={style.arrowheads} onChange={(event) => updateStyle({ arrowheads: event.target.checked })} />
          <span>Arrowheads on connectors</span>
        </label>
      </section>

      <section className="control-group">
        <h4>Figure width (export)</h4>
        <div className="figure-width-row">
          {FIGURE_WIDTH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={Math.abs(style.figureWidthMm - preset.mm) < 1 ? 'chip active' : 'chip'}
              title={preset.hint}
              onClick={() => updateStyle({ figureWidthMm: preset.mm })}
            >
              {preset.label}
              <small>{preset.mm} mm</small>
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="ghost-button" onClick={clearLayout}>
        Reset manual positioning
      </button>
    </div>
  );
};

interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

const Range: React.FC<RangeProps> = ({ label, value, min, max, step, suffix, onChange }) => (
  <div className="control-row range">
    <label>
      {label}
      <span className="range-value">
        {Math.round(value * 10) / 10}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </div>
);
