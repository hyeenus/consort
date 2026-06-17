import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../state/useStore';
import { getSelectionKind, orderNodes } from '../model/graph';
import { ExclusionReasonKind, NodeId } from '../model/types';
import { formatCount, formatNumber, parseCount } from '../model/numbers';

interface ReasonDraft {
  id: string;
  label: string;
  count: string;
  kind: ExclusionReasonKind;
}

export const Inspector: React.FC = () => {
  const graph = useAppStore((state) => state.graph);
  const settings = useAppStore((state) => state.settings);
  const actions = useAppStore((state) => state.actions);
  const style = settings.style;

  const selectionKind = useMemo(() => getSelectionKind(graph), [graph]);
  const selectedId = graph.selectedId;
  const mainFlowNodes = useMemo(() => orderNodes(graph).filter((node) => node.column === 0), [graph]);

  const [textValue, setTextValue] = useState('');
  const [countValue, setCountValue] = useState('');
  const [exclusionLabel, setExclusionLabel] = useState('');
  const [exclusionCount, setExclusionCount] = useState('');
  const [reasonDrafts, setReasonDrafts] = useState<ReasonDraft[]>([]);
  const [editingReasons, setEditingReasons] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('');

  useEffect(() => {
    if (selectionKind === 'node' && selectedId) {
      setEditingReasons(false);
      const node = graph.nodes[selectedId];
      if (!node) return;
      const nextText = node.textLines.join('\n');
      setTextValue((current) => (current === nextText ? current : nextText));
      const nextCount = settings.freeEdit
        ? node.countOverride ?? formatCount(node.n, style)
        : node.n != null
        ? String(node.n)
        : '';
      setCountValue((current) => (current === nextCount ? current : nextCount));
      return;
    }
    if (selectionKind === 'interval' && selectedId) {
      const interval = graph.intervals[selectedId];
      if (!interval) return;
      const exclusion = interval.exclusion ?? { label: 'Excluded', total: null, reasons: [] };
      const nextLabel = exclusion.label ?? 'Excluded';
      setExclusionLabel((current) => (current === nextLabel ? current : nextLabel));
      const nextCount = settings.freeEdit
        ? exclusion.totalOverride ?? formatCount(exclusion.total, style)
        : exclusion.total != null
        ? String(exclusion.total)
        : '';
      setExclusionCount((current) => (current === nextCount ? current : nextCount));
      if (!editingReasons) {
        const drafts = (exclusion.reasons ?? [])
          .filter((reason) => {
            if (!settings.freeEdit) {
              return !(reason.kind === 'auto' && (!reason.n || reason.n === 0));
            }
            if (reason.kind === 'auto') {
              return Boolean(reason.countOverride && reason.countOverride.trim().length > 0);
            }
            return true;
          })
          .map((reason) => ({
            id: reason.id,
            label: reason.label,
            count: settings.freeEdit
              ? reason.countOverride ?? (reason.n != null ? formatNumber(reason.n, style) : '')
              : reason.n != null
              ? String(reason.n)
              : '',
            kind: reason.kind,
          }));
        setReasonDrafts((current) => (draftsEqual(current, drafts) ? current : drafts));
      }
      return;
    }
    if (selectionKind === 'phase' && selectedId) {
      const phase = (graph.phases ?? []).find((item) => item.id === selectedId);
      if (phase) {
        setPhaseLabel((current) => (current === phase.label ? current : phase.label));
      }
    }
  }, [selectionKind, selectedId, graph, settings, style, editingReasons]);

  if (!selectedId || !selectionKind) {
    return (
      <div className="inspector-empty">
        <p>Select a box, connection, or phase to edit it.</p>
        <p className="panel-hint">Tip: drag a box to fine-tune its position. Scroll to zoom.</p>
      </div>
    );
  }

  if (selectionKind === 'phase') {
    const phase = (graph.phases ?? []).find((item) => item.id === selectedId);
    if (!phase) return null;
    const commitLabel = () => {
      const trimmed = phaseLabel.trim().length ? phaseLabel : 'Phase';
      actions.updatePhaseLabel(phase.id, trimmed);
      setPhaseLabel(trimmed);
    };
    return (
      <div className="inspector-body">
        <h3>Phase label</h3>
        <Field label="Text">
          <input value={phaseLabel} onChange={(event) => setPhaseLabel(event.target.value)} onBlur={commitLabel} />
        </Field>
        <Field label="Top aligns with">
          <select
            value={phase.startNodeId}
            onChange={(event) => actions.updatePhaseBounds(phase.id, event.target.value as NodeId, phase.endNodeId)}
          >
            {mainFlowNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.textLines[0] || 'Step'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bottom aligns with">
          <select
            value={phase.endNodeId}
            onChange={(event) => actions.updatePhaseBounds(phase.id, phase.startNodeId, event.target.value as NodeId)}
          >
            {mainFlowNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.textLines[0] || 'Step'}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="danger-button" onClick={() => actions.removePhase(phase.id)}>
          Remove phase
        </button>
      </div>
    );
  }

  if (selectionKind === 'node') {
    const node = graph.nodes[selectedId];
    if (!node) return null;
    const commitCount = () =>
      actions.updateNodeCount(selectedId, parseCount(countValue), settings.freeEdit ? countValue : undefined);
    return (
      <div className="inspector-body">
        <h3>Box</h3>
        <Field label="Text (one line each)">
          <textarea rows={5} value={textValue} onChange={(event) => setTextValue(event.target.value)} onBlur={() => actions.updateNodeText(selectedId, normalizeText(textValue))} />
        </Field>
        <Field label="Patient count">
          <input
            type={settings.freeEdit ? 'text' : 'number'}
            inputMode="numeric"
            value={countValue}
            onChange={(event) => setCountValue(event.target.value)}
            onBlur={commitCount}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitCount();
              }
            }}
          />
          {!settings.freeEdit && <small className="hint">Shown as {formatCount(parseCount(countValue), style)}</small>}
        </Field>
        {node.manualOffset && (
          <button type="button" className="ghost-button" onClick={() => actions.resetNodePosition(selectedId)}>
            Reset position
          </button>
        )}
      </div>
    );
  }

  const interval = graph.intervals[selectedId];
  if (!interval) return null;
  const parent = graph.nodes[interval.parentId];
  const isBranch = (parent?.childIds?.length ?? 0) > 1;

  if (isBranch) {
    return (
      <div className="inspector-body">
        <h3>Branch connection</h3>
        <p className="panel-hint">Branch splits balance automatically. Edit each arm’s count on its box.</p>
        {!settings.freeEdit && <p className="delta-summary">Δ between boxes: {formatDelta(interval.delta)}</p>}
      </div>
    );
  }

  const commitExclusionCount = () =>
    actions.updateExclusionCount(selectedId, parseCount(exclusionCount), settings.freeEdit ? exclusionCount : undefined);

  return (
    <div className="inspector-body">
      <h3>Exclusion</h3>
      <Field label="Label">
        <input value={exclusionLabel} onChange={(event) => setExclusionLabel(event.target.value)} onBlur={() => actions.updateExclusionLabel(selectedId, exclusionLabel)} />
      </Field>
      <Field label="Excluded count">
        <input
          type="text"
          inputMode="numeric"
          value={exclusionCount}
          onChange={(event) => setExclusionCount(event.target.value)}
          onBlur={commitExclusionCount}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitExclusionCount();
            }
          }}
        />
      </Field>
      <div className="reasons">
        <span className="reasons-title">Reasons</span>
        {reasonDrafts.map((reason) => {
          const commitReason = () => {
            const draft = reasonDrafts.find((item) => item.id === reason.id);
            const value = draft?.count ?? '';
            setEditingReasons(false);
            if (settings.freeEdit) {
              actions.updateExclusionReasonCount(selectedId, reason.id, parseCount(value), value);
              return;
            }
            if (reason.kind === 'auto') return;
            actions.updateExclusionReasonCount(selectedId, reason.id, parseCount(value));
          };
          return (
            <div className="reason-row" key={reason.id}>
              <input
                className="reason-label"
                placeholder="Reason"
                value={reason.label}
                onChange={(event) => setReasonDrafts((current) => current.map((item) => (item.id === reason.id ? { ...item, label: event.target.value } : item)))}
                onFocusCapture={() => setEditingReasons(true)}
                onBlur={() => {
                  setEditingReasons(false);
                  const draft = reasonDrafts.find((item) => item.id === reason.id);
                  actions.updateExclusionReasonLabel(selectedId, reason.id, draft?.label ?? '');
                }}
              />
              <input
                className="reason-count"
                inputMode="numeric"
                value={reason.count}
                readOnly={reason.kind === 'auto' && !settings.freeEdit}
                onChange={(event) => setReasonDrafts((current) => current.map((item) => (item.id === reason.id ? { ...item, count: event.target.value } : item)))}
                onFocus={() => setEditingReasons(true)}
                onBlur={commitReason}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitReason();
                  }
                }}
              />
              {reason.kind === 'user' ? (
                <button type="button" className="reason-remove" onClick={() => actions.removeExclusionReason(selectedId, reason.id)} title="Remove reason">
                  ×
                </button>
              ) : (
                <span className="reason-auto" title="Auto remainder">auto</span>
              )}
            </div>
          );
        })}
        <button type="button" className="ghost-button" onClick={() => actions.addExclusionReason(selectedId)}>
          + Add reason
        </button>
      </div>
      {!settings.freeEdit && <p className="delta-summary">Δ between boxes: {formatDelta(interval.delta)}</p>}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

function normalizeText(value: string): string[] {
  const lines = value.split(/\r?\n/).map((line) => line.replace(/\s+$/u, ''));
  while (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length ? lines : [''];
}

function formatDelta(delta: number): string {
  if (delta === 0) return 'balanced';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function draftsEqual(a: ReasonDraft[], b: ReasonDraft[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return other && item.id === other.id && item.label === other.label && item.count === other.count && item.kind === other.kind;
  });
}
