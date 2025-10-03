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

export interface GraphState {
  nodes: Record<NodeId, BoxNode>;
  intervals: Record<IntervalId, Interval>;
  startNodeId: NodeId | null;
  selectedId?: string;
}

export type CountFormat = 'upper' | 'parenthetical';

export interface AppSettings {
  autoCalc: boolean;
  arrowsGlobal: boolean;
  countFormat: CountFormat;
  freeEdit: boolean;
}

export interface PersistedProject {
  graph: GraphState;
  settings: AppSettings;
  version: 1;
}

export type SelectionKind = 'node' | 'interval' | undefined;
