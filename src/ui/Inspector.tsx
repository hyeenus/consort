import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../state/useStore';
import { getSelectionKind } from '../model/graph';
import { GraphState, AppSettings, ExclusionReasonKind } from '../model/types';
import { formatCount, parseCount } from '../model/numbers';

interface ReasonDraft {
  id: string;
  label: string;
  count: string;
  kind: ExclusionReasonKind;
}

interface InspectorProps {
  graph: GraphState;
  settings: AppSettings;
  focusSignal: number;
}

export const Inspector: React.FC<InspectorProps> = ({ graph, settings, focusSignal }) => {
  const {
    updateNodeText,
    updateNodeCount,
    updateExclusionLabel,
    updateExclusionCount,
    addExclusionReason,
    updateExclusionReasonLabel,
    updateExclusionReasonCount,
    removeExclusionReason,
  } = useAppStore((state) => state.actions);
  const selectionKind = useMemo(() => getSelectionKind(graph), [graph]);
  const selectedId = graph.selectedId;
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const [textValue, setTextValue] = useState('');
  const [countValue, setCountValue] = useState('');
  const [exclusionLabel, setExclusionLabel] = useState('');
  const [exclusionCount, setExclusionCount] = useState('');
  const [reasonDrafts, setReasonDrafts] = useState<ReasonDraft[]>([]);
  const [isEditingReasons, setIsEditingReasons] = useState(false);

  const {
    updateLabel: updateReasonDraftLabel,
    updateCount: updateReasonDraftCount,
    getLabel: getReasonDraftLabel,
    getCount: getReasonDraftCount,
  } = createReasonDraftHelpers(reasonDrafts, setReasonDrafts);

  const nodes = graph.nodes;
  const intervals = graph.intervals;

  useEffect(() => {
    if (selectionKind === 'node' && selectedId) {
      if (isEditingReasons) {
        setIsEditingReasons(false);
      }
      const node = nodes[selectedId];
      if (!node) {
        return;
      }
      const nextText = node.textLines.join('\n');
      setTextValue((current) => (current === nextText ? current : nextText));
      const nextCount = node.n != null ? String(node.n) : '';
      setCountValue((current) => (current === nextCount ? current : nextCount));
      return;
    }

    if (selectionKind === 'interval' && selectedId) {
      const interval = intervals[selectedId];
      if (!interval) {
        return;
      }
      const exclusion = interval.exclusion ?? { label: 'Excluded', total: null, reasons: [] };
      const nextLabel = exclusion.label ?? 'Excluded';
      setExclusionLabel((current) => (current === nextLabel ? current : nextLabel));

      const nextExcludedCount = exclusion.total != null ? String(exclusion.total) : '';
      setExclusionCount((current) => (current === nextExcludedCount ? current : nextExcludedCount));

      const nextDrafts = (exclusion.reasons ?? [])
        .filter((reason) => !(reason.kind === 'auto' && (!reason.n || reason.n === 0)))
        .map((reason) => ({
          id: reason.id,
          label: reason.label,
          count: reason.n != null ? String(reason.n) : '',
          kind: reason.kind,
        }));

      if (!isEditingReasons) {
        setReasonDrafts((current) => (areDraftsEqual(current, nextDrafts) ? current : nextDrafts));
      }
      return;
    }

    if (selectionKind === undefined) {
      if (isEditingReasons) {
        setIsEditingReasons(false);
      }
      setTextValue('');
      setCountValue('');
      setExclusionLabel('');
      setExclusionCount('');
      setReasonDrafts([]);
    }
  }, [selectionKind, selectedId, nodes, intervals, isEditingReasons]);

  useEffect(() => {
    if (focusSignal > 0 && firstFieldRef.current) {
      firstFieldRef.current.focus();
      firstFieldRef.current.select?.();
    }
  }, [focusSignal]);

  if (!selectedId || !selectionKind) {
    return (
      <aside className="inspector empty">
        <h3>Inspector</h3>
        <p>Select a box or connection to edit its details.</p>
      </aside>
    );
  }

  if (selectionKind === 'node') {
    const node = graph.nodes[selectedId];
    if (!node) {
      return null;
    }
    return (
      <aside className="inspector">
        <h3>Box Details</h3>
        <label className="field">
          <span>Text</span>
          <textarea
            ref={(element) => {
              if (element) {
                firstFieldRef.current = element;
              }
            }}
            rows={6}
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            onBlur={() => updateNodeText(selectedId, normalizeText(textValue))}
          />
        </label>
        <label className="field">
          <span>Patient Count</span>
          <input
            ref={(element) => {
              if (element && !firstFieldRef.current) {
                firstFieldRef.current = element;
              }
            }}
            type="number"
            value={countValue}
            onChange={(event) => setCountValue(event.target.value)}
            onBlur={() => updateNodeCount(selectedId, parseCount(countValue))}
          />
          <small className="hint">Shown as {formatCount(parseCount(countValue), settings.countFormat)}</small>
        </label>
      </aside>
    );
  }

  const interval = graph.intervals[selectedId];
  if (!interval) {
    return null;
  }

  const parentForInterval = graph.nodes[interval.parentId];
  const parentChildren = parentForInterval?.childIds ?? [];
  const childIndex = parentChildren.indexOf(interval.childId);
  const allowExclusion =
    parentChildren.length <= 2 || childIndex === 0 || childIndex === parentChildren.length - 1;

  if (!allowExclusion) {
    return (
      <aside className="inspector">
        <h3>Exclusion Details</h3>
        <p className="hint">Exclusions are disabled for middle branches when a node has three or more branches.</p>
        <label className="field">
          <span>Label</span>
          <input type="text" value={exclusionLabel} readOnly />
        </label>
        <label className="field">
          <span>Excluded Count</span>
          <input type="text" value={exclusionCount} readOnly />
        </label>
        <p className="inspector-summary">Δ between boxes: {formatDelta(interval.delta)}</p>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <h3>Exclusion Details</h3>
      <label className="field">
        <span>Label</span>
        <input
          ref={(element) => {
            if (element) {
              firstFieldRef.current = element;
            }
          }}
          type="text"
          value={exclusionLabel}
          onChange={(event) => setExclusionLabel(event.target.value)}
          onBlur={() => updateExclusionLabel(selectedId, exclusionLabel)}
        />
      </label>
      <label className="field">
        <span>Excluded Count</span>
        <input
          type="text"
          inputMode="numeric"
          value={exclusionCount}
          onChange={(event) => setExclusionCount(event.target.value)}
          onBlur={() => updateExclusionCount(selectedId, parseCount(exclusionCount))}
        />
      </label>
      <div className="reasons">
        {reasonDrafts.map((reason) => (
          <div className="reason-row" key={reason.id}>
            <div className="field compact reason-title">
              <span>Title</span>
              <input
                type="text"
                value={reason.label}
                onChange={(event) => updateReasonDraftLabel(reason.id, event.target.value)}
                onFocus={() => setIsEditingReasons(true)}
                onBlur={() => {
                  setIsEditingReasons(false);
                  updateExclusionReasonLabel(selectedId, reason.id, getReasonDraftLabel(reason.id));
                }}
              />
            </div>
            <div className="field compact reason-count">
              <span>Count</span>
              <input
                type="text"
                inputMode="numeric"
                value={reason.count}
                onChange={(event) => updateReasonDraftCount(reason.id, event.target.value)}
                onBlur={() => {
                  const value = getReasonDraftCount(reason.id);
                  setIsEditingReasons(false);
                  if (reason.kind === 'auto') {
                    return;
                  }
                  updateExclusionReasonCount(selectedId, reason.id, parseCount(value));
                }}
                onFocus={() => setIsEditingReasons(true)}
                readOnly={reason.kind === 'auto'}
              />
            </div>
            {reason.kind === 'user' ? (
              <button type="button" className="remove-reason" onClick={() => removeExclusionReason(selectedId, reason.id)}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="add-reason"
          onClick={() => {
            addExclusionReason(selectedId);
          }}
        >
          + Add row
        </button>
      </div>
      <p className="inspector-summary">Δ between boxes: {formatDelta(interval.delta)}</p>
    </aside>
  );
};

function normalizeText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, all) => line.length > 0 || index === all.length - 1);
}

function formatDelta(delta: number): string {
  if (delta === 0) {
    return 'balanced';
  }
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function createReasonDraftHelpers(
  reasonDrafts: ReasonDraft[],
  setReasonDrafts: React.Dispatch<React.SetStateAction<ReasonDraft[]>>
) {
  const updateLabel = (id: string, label: string) => {
    setReasonDrafts((current) => current.map((reason) => (reason.id === id ? { ...reason, label } : reason)));
  };
  const updateCount = (id: string, value: string) => {
    setReasonDrafts((current) =>
      current.map((reason) => (reason.id === id ? { ...reason, count: value } : reason))
    );
  };
  const getLabel = (id: string) => reasonDrafts.find((reason) => reason.id === id)?.label ?? '';
  const getCount = (id: string) => reasonDrafts.find((reason) => reason.id === id)?.count ?? '';

  return { updateLabel, updateCount, getLabel, getCount };
}

function areDraftsEqual(current: ReasonDraft[], next: ReasonDraft[]): boolean {
  if (current.length !== next.length) {
    return false;
  }
  for (let index = 0; index < current.length; index += 1) {
    const existing = current[index];
    const incoming = next[index];
    if (!incoming) {
      return false;
    }
    if (existing.id !== incoming.id || existing.label !== incoming.label || existing.count !== incoming.count || existing.kind !== incoming.kind) {
      return false;
    }
  }
  return true;
}
