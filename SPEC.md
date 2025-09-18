CONSORT Flowchart Builder – Specification

1. Overview

This application is a web-based tool for creating CONSORT-style flowcharts (patient selection diagrams).
The tool works fully in a browser (no installation required).
The output is publication-ready (clean, black/white, vector exports).
The UI language is English by default.

⸻

2. Core Principles
	•	Simplicity: black and white only, no colors, no shadows, no diagonal or curved lines.
	•	Clarity: orthogonal connections (horizontal/vertical, 90° only).
	•	Structure: every box contains free text at the top, and always ends with a line showing the patient count:
	•	Example: N = 12 345
	•	Flexibility: user can build any number of main flows, branches, and exclusions.
	•	Validation: automatic calculations keep numbers consistent during construction. Inconsistencies are shown clearly as deltas (Δ).
	•	Publication-ready export: EPS, PDF, SVG, PNG, JPG.

⸻

3. Layout Rules

Boxes
	•	Rectangles with black border, white fill.
	•	Equal width for all boxes in the same vertical flow.
	•	Height grows dynamically based on text.
	•	Inside each box:
	•	Top: free text lines (explanations).
	•	Bottom: last line always shows N = … (auto-calculated if in auto-mode).

Connections
	•	Straight orthogonal lines only (vertical or horizontal).
	•	Default: arrowheads.
	•	User can toggle arrow ↔ line per connection.
	•	Global toggle applies to all connections.

Exclusion Boxes
	•	Default: drawn on the right of the main flow.
	•	Connected horizontally from the midpoint of the parent → child interval.
	•	Contain multiple reasons with counts.
	•	Always show a “Remaining N” row at the bottom.
	•	Remaining N is auto-calculated = Parent N − Sum(exclusions).

Branching
	•	2 children: symmetric T-shape: short vertical → horizontal both sides → vertical down into child boxes.
	•	≥3 children: central bus bar: one horizontal line, vertical drops to each child.
	•	Children aligned on the same y-level.
	•	Right-side children extend to the right, left-side children to the left.

⸻

4. Number Logic

Auto-Calculation (construction phase)
	•	When user enters a new child box N, the system creates the exclusion box automatically.
	•	Each exclusion reason updates Remaining N automatically.
	•	In multi-child branching:
	•	First (k−1) children are entered manually.
	•	The k-th child N auto-fills = Parent N − Sum(other children).

After-the-fact Edits
	•	If user edits an upper N later, no automatic propagation occurs.
	•	Instead, the system shows a Δ badge with the difference for every affected interval.
	•	Validation panel lists all inconsistencies.

Free Edit Mode
	•	Global toggle “Unlock numbers”: user can edit any N freely.
	•	Per-node unlock also available.
	•	In this mode, the system only reports Δ; no auto-calculation.

⸻

5. Number Formatting
	•	Default: N = 12 345 (English, space separator, no decimals).
	•	No percentages in v1.
	•	Locale selector defines thousands separator:
	•	English (space) → 12 345 (default)
	•	English (comma) → 12,345
	•	Finnish → 12 345
	•	German → 12.345
	•	French → 12 345

⸻

6. Keyboard Interaction

Selection and Edit
	•	Arrow keys: move selection box-to-box (↑ ↓ ← →).
	•	Enter / F2: enter edit mode.
	•	Esc: exit edit mode to selection mode.

Creation Shortcuts
	•	Cmd/Ctrl+↓: create arrow down + new main box.
	•	Cmd/Ctrl+→: focus (or create) exclusion box of current interval (right).
	•	Cmd/Ctrl+←: same for left.
	•	Cmd/Ctrl+B: branch current box (dialog: number of children, default 2).
	•	A: toggle arrow ↔ line for selected connection.

Undo / Redo
	•	Cmd/Ctrl+Z: undo.
	•	Shift+Cmd/Ctrl+Z: redo.
	•	History depth: ≥100 actions.

⸻

7. Mouse Interaction
	•	+ button under a box: add new child downwards.
	•	+ Exclusion on interval side: add exclusion box.
	•	Branch action in box menu.
	•	Right-click context menu:
	•	Add Exclusion
	•	Branch
	•	Toggle arrow/line
	•	Lock/Unlock numbers
	•	Duplicate
	•	Delete

⸻

8. Validation and Error Reporting
	•	Every interval/branch computes consistency:
	•	Δ = Parent N − (Child N + Sum(exclusions)).
	•	If Δ ≠ 0, show badge near the interval:
	•	Format: Δ = +12.
	•	Validation panel lists all deltas with clickable links to nodes.
	•	Δ badges and validation overlays are not exported.

⸻

9. Export and Print
	•	Formats: SVG, PDF, EPS, PNG, JPG.
	•	Vector exports:
	•	100% black (K).
	•	Fonts subset embedded.
	•	Option: convert text to outlines.
	•	Raster exports:
	•	White background.
	•	300 ppi and 600 ppi options.
	•	Preset widths: 85 mm, 120 mm, 180 mm.
	•	Browser print works as is.

⸻

10. Fonts
	•	On screen: system-ui.
	•	Exports: fallback embedding of DejaVu Sans / Noto Sans.
	•	Ensures identical layout across systems.

⸻

11. Persistence
	•	Autosave project to browser local storage (every 30s and on change).
	•	Import/Export project as JSON (graph, layout, settings).

⸻

12. Data Model (simplified JSON)

{
  "nodes": [
	{
	  "id": "n1",
	  "textLines": ["Assessed for eligibility"],
	  "n": 200,
	  "autoCalcLocked": true,
	  "position": {"x": 0, "y": 0},
	  "column": 0
	}
  ],
  "edges": [
	{"id": "e1", "from": "n1", "to": "n2", "arrow": true, "intervalId": "i1"}
  ],
  "intervals": [
	{
	  "id": "i1",
	  "parentNodeId": "n1",
	  "childNodeId": "n2",
	  "exclusions": {
	    "side": "right",
	    "reasons": [
	      {"label": "Under 16 years", "n": 20},
	      {"label": "Other reasons", "n": 80}
	    ],
	    "remainingN": 100,
	    "autoCalc": true
	  },
	  "delta": 0
	}
  ],
  "branches": [
	{"parentNodeId": "n2", "children": ["n3", "n4"], "busBar": false}
  ],
  "settings": {
	"locale": "en-space",
	"arrowsGlobal": true,
	"unlockNumbersGlobal": false
  }
}


⸻

13. Components

Core
	•	Graph Model: nodes, edges, intervals, exclusions, branches.
	•	Layout Engine: orthogonal placement, auto gaps, box sizing.
	•	Calc Engine: auto-calc pipeline, Δ computation.
	•	Validation Service: collects inconsistencies.
	•	Rendering (SVG): 90° connectors, centered anchors.
	•	Export Service: handles all file formats.
	•	Persistence: autosave + JSON import/export.
	•	Keyboard Manager: shortcuts, focus.
	•	Undo/Redo Stack: command-pattern history.

UI
	•	Canvas (SVG)
	•	Sidebar / Inspector (edit text, N line)
	•	Toolbar (global actions: add, branch, export, locale)
	•	Validation Panel
	•	Branch Dialog
	•	Context Menu
	•	Shortcuts Overlay

⸻

14. Acceptance Tests (examples)

Auto-calc Exclusions
	•	GIVEN N(top) = 200 and user creates N(bottom) = 100
	•	THEN app creates Exclusions box
	•	WHEN user adds exclusion Under 16 years = 50
	•	THEN Remaining N updates to 150
	•	WHEN user adds exclusion Other = 50
	•	THEN Remaining N updates to 100
	•	AND N(bottom) matches 100.

Branching with 3 Children
	•	GIVEN Parent N = 120
	•	WHEN user branches into 3
	•	AND enters child1 N = 40, child2 N = 30
	•	THEN child3 auto-fills N = 50.
	•	IF user changes child2 N = 60
	•	THEN Δ badge shows (40+60+50 > 120).

⸻

End of Specification

⸻

Would you like me to also generate a visual mock-up (ASCII canvas diagram in Markdown) showing how a simple flow looks under these rules? That could help both humans and AI verify the orthogonal layout rules quickly.