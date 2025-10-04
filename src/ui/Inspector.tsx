import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../state/useStore';
import { getSelectionKind } from '../model/graph';
import { GraphState, AppSettings, ExclusionReasonKind } from '../model/types';
import { formatCount, formatInteger, parseCount } from '../model/numbers';

interface ReasonDraft {
  id: string;
  label: string;
  count: string;
  kind: ExclusionReasonKind;
}

interface InspectorProps {
  graph: GraphState;
  settings: AppSettings;
}

export const Inspector: React.FC<InspectorProps> = ({ graph, settings }) => {
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
      const nextCount = settings.freeEdit
        ? node.countOverride ?? formatCount(node.n, settings.countFormat)
        : node.n != null
        ? String(node.n)
        : '';
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

      const nextExcludedCount = settings.freeEdit
        ? exclusion.totalOverride ?? formatCount(exclusion.total, settings.countFormat)
        : exclusion.total != null
        ? String(exclusion.total)
        : '';
      setExclusionCount((current) => (current === nextExcludedCount ? current : nextExcludedCount));

      const nextDrafts = (exclusion.reasons ?? [])
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
            ? reason.countOverride ?? (reason.n != null ? formatInteger(reason.n) : '—')
            : reason.n != null
            ? String(reason.n)
            : '',
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
  }, [selectionKind, selectedId, nodes, intervals, isEditingReasons, settings]);

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
    const commitNodeCount = () =>
      updateNodeCount(
        selectedId,
        parseCount(countValue),
        settings.freeEdit ? countValue : undefined
      );
    return (
      <aside className="inspector">
        <h3>Box Details</h3>
        <label className="field">
          <span>Text</span>
          <textarea
            rows={6}
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            onBlur={() => updateNodeText(selectedId, normalizeText(textValue))}
          />
        </label>
        <label className="field">
          <span>Patient Count</span>
          <input
            type={settings.freeEdit ? 'text' : 'number'}
            inputMode={settings.freeEdit ? undefined : 'numeric'}
            value={countValue}
            onChange={(event) => setCountValue(event.target.value)}
            onBlur={commitNodeCount}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitNodeCount();
              }
            }}
          />
          {!settings.freeEdit ? (
            <small className="hint">Shown as {formatCount(parseCount(countValue), settings.countFormat)}</small>
          ) : null}
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
  const canEditExclusion = parentChildren.length <= 1;

  if (!canEditExclusion) {
    return (
      <aside className="inspector">
        <h3>Exclusion Details</h3>
        <p className="hint">Branch exclusions update automatically when totals are missing.</p>
        <label className="field">
          <span>Label</span>
          <input type="text" value={exclusionLabel} readOnly />
        </label>
        <label className="field">
          <span>Excluded Count</span>
          <input type="text" value={exclusionCount} readOnly />
        </label>
        {!settings.freeEdit ? (
          <p className="inspector-summary">Δ between boxes: {formatDelta(interval.delta)}</p>
        ) : null}
      </aside>
    );
  }

  const commitExclusionCount = () =>
    updateExclusionCount(
      selectedId,
      parseCount(exclusionCount),
      settings.freeEdit ? exclusionCount : undefined
    );

  return (
    <aside className="inspector">
      <h3>Exclusion Details</h3>
      <label className="field">
        <span>Label</span>
        <input
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
          inputMode={settings.freeEdit ? undefined : 'numeric'}
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
      </label>
      <div className="reasons">
        {reasonDrafts.map((reason) => {
          const commitReasonCount = () => {
            const value = getReasonDraftCount(reason.id);
            setIsEditingReasons(false);
            if (settings.freeEdit) {
              updateExclusionReasonCount(
                selectedId,
                reason.id,
                parseCount(value),
                value
              );
              return;
            }
            if (reason.kind === 'auto') {
              return;
            }
            updateExclusionReasonCount(selectedId, reason.id, parseCount(value));
          };

          return (
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
                inputMode={settings.freeEdit ? undefined : 'numeric'}
                value={reason.count}
                onChange={(event) => updateReasonDraftCount(reason.id, event.target.value)}
                onBlur={commitReasonCount}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitReasonCount();
                  }
                }}
                onFocus={() => setIsEditingReasons(true)}
                readOnly={reason.kind === 'auto' && !settings.freeEdit}
              />
              </div>
              {reason.kind === 'user' ? (
                <button type="button" className="remove-reason" onClick={() => removeExclusionReason(selectedId, reason.id)}>
                  Remove
                </button>
              ) : null}
            </div>
          );
        })}
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
      {!settings.freeEdit ? (
        <p className="inspector-summary">Δ between boxes: {formatDelta(interval.delta)}</p>
      ) : null}
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
