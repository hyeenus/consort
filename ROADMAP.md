Implementation Plan (Step-by-Step) — CONSORT Flowchart Builder

Audience: autonomous code agents & humans
Style: concise, unambiguous, machine- & human-friendly
Platform: client-only web app (no server), static hosting (e.g., GitHub Pages)

⸻

0) Goals, Scope, Constraints
	•	Primary goal (V1): User can create a single vertical main flow of boxes with arrows, add one exclusion box per interval on the right, enter/edit text, and the app auto-calculates counts (N) between boxes.
	•	Unlock mode: User can toggle free edit to override any N; app only shows differences (Δ), no auto-calc.
	•	Export: SVG (vector) and PNG (raster). Export errors must never block app usage.
	•	Out of scope (for V1): branching, multiple exclusion reasons in one exclusion box, percentages, PDF/EPS/JPG, localization selector.
	•	UI language: English. Numbers shown as N = 12 345 (space thousands, 0 decimals).

Non-negotiable constraints
	•	Pure client; no backend.
	•	Orthogonal geometry only (vertical/horizontal). Black/white only.
	•	Ship as static site (e.g., GitHub Pages).

⸻

1) Tech & Architecture (choose defaults; adjust only if necessary)
	•	Language: TypeScript
	•	UI: React (functional, hooks)
	•	State: Zustand (lightweight), or Redux Toolkit if agent prefers
	•	Render: SVG (always vector)
	•	Build: Vite
	•	Testing: Vitest + Playwright (E2E keyboard/mouse)
	•	Formatting: Prettier + ESLint
	•	PNG export: serialize SVG → rasterize via <canvas> offscreen

Repo layout

/src
  /app       (App shell, routing if any)
  /canvas    (SVG scene, hit-testing)
  /model     (graph, calc, validation)
  /ui        (Sidebar/Inspector, Toolbar, Modals)
  /export    (svg/png)
  /state     (Zustand store, selectors)
  /ops       (commands, undo/redo)
  /tests     (unit)
  /e2e       (playwright)
index.html
vite.config.ts


⸻

2) Data Model (V1, minimal)

type NodeId = string;
type IntervalId = string;

interface BoxNode {
  id: NodeId;
  textLines: string[];      // free text lines (top area)
  n: number | null;         // last line: N = n; null if not yet set
  position: { x: number; y: number }; // layout anchor (center top)
  column: number;           // 0 for main column
  autoLocked: boolean;      // true =\> N shown but locked in auto mode
}

interface Interval {
  id: IntervalId;
  parentId: NodeId;
  childId: NodeId;
  // Single exclusion box on the RIGHT (V1)
  exclusion?: {
	label: string;          // free text (e.g., "Excluded")
	n: number | null;       // exclusion count (user editable)
	remainingN: number | null; // computed when auto mode ON
  };
  delta: number;            // computed: parent.n - (child.n + exclusion.n)
}

interface AppSettings {
  autoCalc: boolean;        // true in normal mode; false when "Unlock numbers"
  arrowsGlobal: boolean;    // true (default)
  numberFormat: "en-space"; // fixed in V1
}

interface Graph {
  nodes: Record\<NodeId, BoxNode\>;
  intervals: Record\<IntervalId, Interval\>;
  startNodeId: NodeId;
  selectedId?: NodeId | IntervalId;
}


⸻

3) Core Algorithms (V1)

3.1 Auto-calc (normal mode)
	•	On child N entry:
	•	Ensure interval.exclusion exists; if absent, create { label: "Exclusions", n: null, remainingN: null }.
	•	When exclusion.n is set (or zero), compute remainingN = parent.n - exclusion.n.
	•	Validate parent.n - (child.n + exclusion.n) → set interval.delta.
	•	On exclusion n entry:
	•	Recompute remainingN.
	•	Validate delta.
	•	On parent/child N entry:
	•	Recompute exclusion remainingN & delta.
	•	Display rule: remainingN is read-only UI in autoCalc mode.

3.2 Free edit (Unlock numbers)
	•	settings.autoCalc = false.
	•	All N fields are editable; do not compute remainingN.
	•	Always compute and show delta = parent.n - (child.n + exclusion.n) (red if non-zero).
	•	Export never includes delta badges.

3.3 Layout
	•	All main boxes in column 0, equal width.
	•	Interval line: parent bottom center → child top center (vertical).
	•	Exclusion box: right side, centered to the interval segment (horizontal connector from mid-segment).
	•	Auto expand vertical spacing to avoid overlap; no diagonal or curved segments.

⸻

4) UX Behaviors (V1)

4.1 Keyboard
	•	Arrows: move selection between boxes (↑/↓) and between box ↔ exclusion (→/←).
	•	Enter / F2: enter edit mode for selected entity (box text or N, exclusion label or N).
	•	Esc: exit edit mode.
	•	Cmd/Ctrl+↓: create arrow down + new main box (auto-focus).
	•	Cmd/Ctrl+→: focus/create exclusion box for current interval (right).
	•	A: toggle Arrow/Line on the interval connection.

4.2 Mouse
	•	“+” under box: add child (creates interval + child + focuses).
	•	“+ Exclusion” on interval (right rail): create/focus exclusion.
	•	Context menu on interval: Toggle Arrow/Line, Unlock numbers (local), Delete.
	•	Context menu on box: Duplicate, Delete.

4.3 N line
	•	Always last visual line in a box: N = <formatted>.
	•	In autoCalc: N is editable for boxes; remainingN is read-only in exclusion.
	•	In free edit: all N’s editable.

⸻

5) Exports (V1)
	•	SVG export: serialize SVG scene (namespaced, fonts as text).
	•	PNG export:
	•	Convert SVG string → Blob → draw on <canvas> → toDataURL("image/png").
	•	Fail-safe: wrap in try/catch; on failure, show non-blocking toast (“PNG export failed; SVG export available”).
	•	Never block app on export errors.
	•	Printing: rely on browser print; hide UI overlays (toolbars, deltas) with @media print.

⸻

6) Milestones & Steps

Milestone A — Project Scaffold (1–2 days)
	1.	Init repo (Vite + React + TS, ESLint/Prettier).
	2.	Global store (Zustand), command bus (undo/redo skeleton).
	3.	Basic SVG canvas; pan/zoom optional (off by default in V1).

Exit criteria
	•	App renders a blank canvas with one starter box selected.

⸻

Milestone B — Graph Model & Selection (1–2 days)
	1.	Implement Graph, Node, Interval types & store slices.
	2.	Selection model (box or interval or exclusion).
	3.	Keyboard navigation across boxes (↑/↓) and to exclusion (→/← if exists).

Exit criteria
	•	Can select nodes/intervals/exclusion placeholders via keyboard/mouse.

⸻

Milestone C — Create Flow Downwards (2–3 days)
	1.	Cmd/Ctrl+↓ and “+” UI to add child: create Interval, child Node.
	2.	Vertical arrow (default) from parent to child.
	3.	Layout engine places child centered beneath parent with spacing control.

Exit criteria
	•	User can create a vertical sequence of boxes.

⸻

Milestone D — Edit Content & N Lines (2–3 days)
	1.	Box editor: text lines (free text) + last N line.
	2.	Formatting for N: N = 12 345 (space thousands, 0 decimals).
	3.	Enter/F2 to edit, Esc to exit.
	4.	Box auto-resizes; equal width in the column.

Exit criteria
	•	Users can write text and set N for any box.

⸻

Milestone E — Single Exclusion per Interval (3–4 days)
	1.	“+ Exclusion” control on interval (or Cmd/Ctrl+→ to create/focus).
	2.	Exclusion panel UI with: label (free text), N (editable), Remaining N (read-only in autoCalc).
	3.	Horizontal connector mid-interval → exclusion; exclusion sized to content.

Exit criteria
	•	Users can add one exclusion per interval and see Remaining N update (in autoCalc).

⸻

Milestone F — Auto-Calc & Δ Validation (3–4 days)
	1.	Implement autoCalc pipeline (normal mode).
	2.	Compute remainingN = parent.n - exclusion.n, delta parent.n - (child.n + exclusion.n).
	3.	Δ badge on interval if non-zero (not printable/exported).
	4.	Unlock numbers (global): disable autoCalc; allow editing all N; keep Δ badges.

Exit criteria
	•	Auto-calc works during construction; unlock mode works and shows deltas.

⸻

Milestone G — Export (SVG & PNG) (2–3 days)
	1.	SVG serializer (clean, namespaced).
	2.	PNG rasterizer via offscreen canvas.
	3.	Error handling: try/catch with UI toast; never block usage.
	4.	Hide toolbars/badges on export & print.

Exit criteria
	•	SVG & PNG downloads succeed; failure path non-blocking.

⸻

Milestone H — Polish & QA (2–3 days)
	1.	Keyboard map finalized (arrows, Enter/F2, Esc, Cmd/Ctrl+↓, Cmd/Ctrl+→, A).
	2.	Undo/redo (≥50 actions for V1).
	3.	Unit tests (calc, formatting), E2E (create flow, exclusion, unlock, export).
	4.	Basic a11y (focus rings, aria labels).

Exit criteria
	•	V1 is shippable: create linear flow, single exclusion/interval, auto-calc, unlock, SVG/PNG export.

⸻

7) Future Phases (design now so V1 won’t block later)

Phase 2 — Multiple Exclusion Reasons
	•	Change exclusion to support reasons[] and computed remainingN per reason step.
	•	UI: add reason rows; update autoCalc after each.
	•	Keep V1 single-exclusion API as a special case (reasons length 1).
	•	Data model is forward-compatible if we structure exclusion.n as sum of reasons.

Model tweak (forward-compatible now)

exclusion?: {
  label: string;
  reasons: { label: string; n: number | null }[];  // V1: keep empty or single
  remainingN: number | null;
}

Phase 3 — Branching (2+ and bus bar 3+)
	•	Introduce branch node type or metadata on a node that has >1 children.
	•	Layout: symmetric T for 2; bus bar for ≥3.
	•	Auto-calc: last child auto-fills; Δ validation across children.

Phase 4 — Locale Selector, PDF/EPS/JPG Export
	•	Locale: switch number separators (no decimals).
	•	Vector exports: PDF/EPS (with font subset; option “convert text to outlines”).
	•	Raster: JPG in addition to PNG.

Phase 5 — Validation Panel, Autosave, Project JSON
	•	Validation panel listing all Δ with anchors.
	•	Autosave to localStorage; Import/Export project JSON (graph, layout, settings).
	•	(If desired, ship earlier — this phase is safe to include in V1 too.)

⸻

8) Acceptance Criteria (V1 recap)
	•	Create linear flow: start box → many boxes via Cmd/Ctrl+↓ or “+”.
	•	Add one exclusion per interval (right side).
	•	Auto-calc updates Remaining N and Δ in normal mode.
	•	Global Unlock numbers toggle enables free edits; Δ badges indicate mismatches.
	•	Arrow/Line toggle works per connection; default arrows.
	•	SVG & PNG export; export failure never blocks the app.
	•	Keyboard: arrows move selection; Enter/F2 edit; Esc exit; Cmd/Ctrl+↓ add box; Cmd/Ctrl+→ focus/create exclusion; A toggles arrow.
	•	Orthogonal layout only; boxes aligned; connectors center-to-center; black/white only.

⸻

9) Risk & Mitigation
	•	Export failures (PNG): use try/catch; show toast; suggest SVG as fallback.
	•	Number formatting drift: centralize formatter; unit test.
	•	Layout overlap: implement min vertical gap auto-expansion; test long text cases.
	•	Undo complexity: all mutating ops via command bus; snapshot tests.

⸻

10) Deployment (static)
	•	Target: GitHub Pages (or Netlify, Vercel) — static files only.
	•	Build: vite build → /dist.
	•	Pages config: set base in vite.config.ts if hosted under subpath.
	•	Artifacts: index.html, /assets/*.
	•	Verification: open in private window; test SVG/PNG export; test keyboard.

Offline usage option
	•	Users can download the /dist folder (or a zipped bundle) and open index.html locally (no server required).
	•	Works from USB/email as requested.

⸻

11) Telemetry & Privacy (optional)
	•	Default: no analytics, no network calls.
	•	App never uploads user data; runs entirely in the browser.
	•	If adding analytics later, ensure opt-in and no PHI ever leaves device.

⸻

12) Definition of Done (V1)
	•	All acceptance criteria pass.
	•	Unit tests for calc & formatting (≥90% statements in those modules).
	•	E2E happy path passes in Chrome/Firefox/Safari latest.
	•	Lighthouse ≥ 90 (Performance/Accessibility/Best Practices).
	•	README with quick start, keyboard cheat-sheet, and known limitations.

⸻

13) Quick Build Order (for the agent)
	1.	Scaffold (Vite/React/TS, Zustand)
	2.	Graph model + selection + SVG canvas
	3.	Add child flow (Cmd/Ctrl+↓, “+”), vertical arrows
	4.	Box editor + N formatting (N = 12 345)
	5.	Exclusion box (single) + connector + UI
	6.	Auto-calc (Remaining N, Δ)
	7.	Unlock numbers (global toggle)
	8.	Arrow/Line toggle (per interval)
	9.	Export SVG + PNG (non-blocking errors)
	10.	Polish keyboard, basic undo/redo, tests
	11.	Ship to GitHub Pages

⸻

End of plan.