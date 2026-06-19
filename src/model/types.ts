import { DiagramStyle } from './style';

export type NodeId = string;
export type IntervalId = string;

export interface BoxNode {
  id: NodeId;
  textLines: string[];
  n: number | null;
  position: { x: number; y: number };
  column: number;
  autoLocked: boolean;
  childIds: NodeId[];
  countOverride?: string | null;
  /** Manual drag offset (diagram coords) applied on top of auto-layout. */
  manualOffset?: { x: number; y: number };
  /** Optional per-box width override; falls back to style.boxWidth. */
  widthOverride?: number | null;
  /** Hide the auto count line for this box (e.g. group headers). */
  hideCount?: boolean;
}

export type ExclusionReasonKind = 'user' | 'auto';

export interface ExclusionReason {
  id: string;
  label: string;
  n: number | null;
  kind: ExclusionReasonKind;
  countOverride?: string | null;
}

export interface ExclusionBox {
  label: string;
  total: number | null;
  reasons: ExclusionReason[];
  totalOverride?: string | null;
}

export interface Interval {
  id: IntervalId;
  parentId: NodeId;
  childId: NodeId;
  exclusion?: ExclusionBox;
  delta: number;
  arrow: boolean;
}

export type PhaseId = string;

/**
 * Where a phase edge sits relative to the box it is anchored to:
 * - 'gap': at the mid-point of the gap to the neighbouring box (with a small
 *   neat gap so adjacent phases meet around the connector arrow).
 * - 'box-top' / 'box-bottom': exactly at the box's top or bottom border level
 *   (either edge can snap to either border).
 */
export type PhaseEdgeMode = 'gap' | 'box-top' | 'box-bottom';

export interface PhaseBox {
  id: PhaseId;
  label: string;
  startNodeId: NodeId;
  endNodeId: NodeId;
  topMode?: PhaseEdgeMode;
  bottomMode?: PhaseEdgeMode;
}

export interface GraphState {
  nodes: Record<NodeId, BoxNode>;
  intervals: Record<IntervalId, Interval>;
  phases: PhaseBox[];
  startNodeId: NodeId | null;
  selectedId?: string;
}

export interface AppSettings {
  autoCalc: boolean;
  freeEdit: boolean;
  helpEnabled: boolean;
  style: DiagramStyle;
}

export interface PersistedProject {
  graph: GraphState;
  settings: AppSettings;
  version: 2;
}

export type SelectionKind = 'node' | 'interval' | 'phase' | undefined;
