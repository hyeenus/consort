import { nanoid } from 'nanoid';
import { BoxNode, ExclusionBox, ExclusionReason, GraphState, Interval, NodeId, PhaseBox } from './types';

export interface StudyTemplate {
  id: string;
  name: string;
  description: string;
  build: () => GraphState;
}

// Small builder so each template reads like the diagram it produces. --------

class FlowBuilder {
  private nodes: Record<NodeId, BoxNode> = {};
  private intervals: Record<string, Interval> = {};
  private phases: PhaseBox[] = [];
  private startId: NodeId | null = null;

  node(text: string[], n: number | null, opts: { hideCount?: boolean } = {}): NodeId {
    const id = nanoid();
    this.nodes[id] = {
      id,
      textLines: text,
      n,
      position: { x: 0, y: 0 },
      column: 0,
      autoLocked: false,
      childIds: [],
      hideCount: opts.hideCount,
    };
    if (!this.startId) {
      this.startId = id;
    }
    return id;
  }

  link(parentId: NodeId, childId: NodeId, exclusion?: ExclusionBox): void {
    this.nodes[parentId].childIds.push(childId);
    const id = nanoid();
    this.intervals[id] = {
      id,
      parentId,
      childId,
      exclusion,
      delta: 0,
      arrow: true,
    };
  }

  phase(label: string, startNodeId: NodeId, endNodeId: NodeId): void {
    this.phases.push({ id: nanoid(), label, startNodeId, endNodeId });
  }

  build(): GraphState {
    return {
      nodes: this.nodes,
      intervals: this.intervals,
      phases: this.phases,
      startNodeId: this.startId,
      selectedId: this.startId ?? undefined,
    };
  }
}

function excluded(label: string, total: number, reasons: Array<[string, number]> = []): ExclusionBox {
  const userReasons: ExclusionReason[] = reasons.map(([text, n]) => ({
    id: nanoid(),
    label: text,
    n,
    kind: 'user',
  }));
  return { label, total, reasons: userReasons };
}

// Templates ---------------------------------------------------------------

function strobeRetrospective(): GraphState {
  const b = new FlowBuilder();
  const a = b.node(['Patients screened for eligibility'], 1000);
  const eligible = b.node(['Eligible patients'], 720);
  const analysed = b.node(['Included in final analysis'], 600);

  b.link(
    a,
    eligible,
    excluded('Excluded', 280, [
      ['Did not meet inclusion criteria', 150],
      ['Age < 18 years', 60],
    ])
  );
  b.link(
    eligible,
    analysed,
    excluded('Excluded', 120, [
      ['Missing primary outcome data', 80],
      ['Withdrew consent', 20],
    ])
  );

  b.phase('Enrolment', a, eligible);
  b.phase('Analysis', analysed, analysed);
  return b.build();
}

function consortRct(): GraphState {
  const b = new FlowBuilder();
  const assessed = b.node(['Assessed for eligibility'], 300);
  const randomised = b.node(['Randomised'], 220);
  const armA = b.node(['Allocated to intervention'], 110);
  const armB = b.node(['Allocated to control'], 110);
  const analA = b.node(['Analysed'], 100);
  const analB = b.node(['Analysed'], 102);

  b.link(
    assessed,
    randomised,
    excluded('Excluded', 80, [
      ['Not meeting inclusion criteria', 50],
      ['Declined to participate', 20],
    ])
  );
  // Two-arm randomisation split (no side exclusion on a branch).
  b.link(randomised, armA);
  b.link(randomised, armB);
  b.link(
    armA,
    analA,
    excluded('Lost to follow-up', 10, [
      ['Lost to follow-up', 6],
      ['Discontinued intervention', 4],
    ])
  );
  b.link(
    armB,
    analB,
    excluded('Lost to follow-up', 8, [
      ['Lost to follow-up', 5],
      ['Discontinued intervention', 3],
    ])
  );

  b.phase('Enrolment', assessed, assessed);
  b.phase('Allocation', randomised, randomised);
  return b.build();
}

function diagnosticCaseControl(): GraphState {
  const b = new FlowBuilder();
  const source = b.node(['Source population'], 1000);
  const cohort = b.node(['Study cohort'], 800);
  const cases = b.node(['Cases', '(outcome present)'], 300);
  const controls = b.node(['Controls', '(outcome absent)'], 500);

  b.link(
    source,
    cohort,
    excluded('Excluded', 200, [
      ['Incomplete records', 120],
      ['Did not meet criteria', 80],
    ])
  );
  b.link(cohort, cases);
  b.link(cohort, controls);

  b.phase('Selection', source, cohort);
  return b.build();
}

function prismaScreening(): GraphState {
  const b = new FlowBuilder();
  const identified = b.node(['Records identified through', 'database searching'], 1200);
  const screened = b.node(['Records screened'], 900);
  const fullText = b.node(['Full-text articles assessed', 'for eligibility'], 300);
  const included = b.node(['Studies included in', 'qualitative synthesis'], 50);

  b.link(identified, screened, excluded('Duplicate records removed', 300));
  b.link(screened, fullText, excluded('Records excluded', 600, [['Irrelevant title / abstract', 600]]));
  b.link(
    fullText,
    included,
    excluded('Full-text articles excluded', 250, [
      ['Wrong population', 100],
      ['Wrong outcome', 90],
    ])
  );

  b.phase('Identification', identified, identified);
  b.phase('Screening', screened, screened);
  b.phase('Eligibility', fullText, fullText);
  b.phase('Included', included, included);
  return b.build();
}

export const STUDY_TEMPLATES: StudyTemplate[] = [
  {
    id: 'strobe',
    name: 'STROBE retrospective selection',
    description: 'Starting cohort → sequential exclusions → final analytic cohort. The default for retrospective studies.',
    build: strobeRetrospective,
  },
  {
    id: 'consort',
    name: 'CONSORT randomised trial',
    description: 'Enrolment → randomisation into two arms → follow-up → analysis, with lost-to-follow-up boxes.',
    build: consortRct,
  },
  {
    id: 'casecontrol',
    name: 'Diagnostic / case-control',
    description: 'A study cohort split into two groups (e.g. cases vs controls) after exclusions.',
    build: diagnosticCaseControl,
  },
  {
    id: 'prisma',
    name: 'PRISMA-style screening',
    description: 'Records identified → duplicates removed → screened → full-text assessed → included.',
    build: prismaScreening,
  },
];

export function getTemplate(id: string): StudyTemplate | undefined {
  return STUDY_TEMPLATES.find((template) => template.id === id);
}
