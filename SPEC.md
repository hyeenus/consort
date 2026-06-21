# Flowchart Builder — Specification (v2)

This document describes the current (version 2) application. It supersedes the
original V1 specification.

## 1. Overview

A client-only web app for creating publication-ready patient-selection /
participant-flow diagrams (CONSORT, STROBE, PRISMA, case-control). It runs
entirely in the browser, autosaves to local storage, and exports vector and
raster figures. Defaults follow medical-journal conventions: sharp black-and-
white rectangles, sans-serif type, thin rules.

## 2. Core principles

- **Publication-first defaults** — sharp rectangles, black ink on white,
  Helvetica/Arial, thin line weights, no shadows, orthogonal (90°) connectors.
- **One geometry source** — `src/render/geometry.ts` builds the scene; the canvas
  and the SVG/PNG exporters render from it, guaranteeing screen == export.
- **Style-driven** — a single `DiagramStyle` controls fonts, box/exclusion
  widths, spacing, line weight, corner radius, alignment, number format, and the
  target figure width; changing it re-flows the diagram so it stays clean.
- **Auto with override** — counts auto-balance and the layout is automatic, but
  the user can override counts (manual / free edit) and nudge/resize boxes.

## 3. Layout

- **Boxes**: rectangles, black border, white fill. Main-flow boxes share one
  width; height grows with content. Free text lines on top; a count line
  (`N = …`, `n = …`, or plain) at the bottom unless hidden.
- **Connectors**: orthogonal only — a straight vertical drop when aligned, or a
  vertical-horizontal-vertical elbow otherwise. Optional arrowheads (global).
- **Exclusion boxes**: attached to the mid-point of an interval, offset clear of
  the main column on the left or right; contain a label, total, and reason rows
  with an auto-computed remainder ("Other").
- **Branching**: two-arm symmetric split and ≥3-child bus bar; branch arms carry
  their own per-arm exclusions on opposite sides.
- **Phase rails**: rotated labels in a left rail, placed outside the whole
  diagram (including side exclusion boxes). Each phase spans a range of main
  boxes; each end snaps to a box top border, a box bottom border, or the
  mid-gap between boxes (leaving a small neat gap so adjacent phases meet around
  the connector). Resizable by dragging the rail ends or via the inspector.
- **Vertical spacing**: a single uniform gap, automatically increased only as
  much as needed so stacked exclusion boxes never overlap.
- **Text**: centred horizontally and vertically using explicit baseline metrics
  (portable across browsers and vector editors).

## 4. Counts

- **Auto-calc** (default): entering a child or exclusion total keeps the interval
  balanced; branch children split the parent and the last child auto-fills.
- **Manual**: disable auto-calc to key in any totals.
- **Free edit**: type arbitrary labels/counts; only Δ is reported.
- **Δ validation**: `Δ = parent − (child + exclusions)`; a red Δ badge shows on
  screen when non-zero and is **never** exported.

## 5. Number formatting

- Styles: `N = 1 234`, `n = 1 234`, or plain `1 234`.
- Thousands separator: space (default), comma, period, or none.

## 6. Interaction

- **Mouse**: select by clicking; drag a box to nudge it; drag a box edge to
  resize widths (main width is global/uniform, exclusion width global, phase rail
  width); drag phase-rail ends to resize with snapping; `+` / branch / remove
  controls under the selected box; pan by dragging the background; scroll to
  zoom; Fit button.
- **Keyboard**: arrows move selection; `Cmd/Ctrl+↓` add step; `Cmd/Ctrl+Z` /
  `Shift+Cmd/Ctrl+Z` undo/redo; `Delete` remove; `Esc` deselect.
- **Undo/redo**: ≥100 steps; drags are a single undo step.

## 7. Templates and presets

- **Study templates**: STROBE retrospective selection, CONSORT randomised trial,
  diagnostic / case-control, PRISMA-style screening.
- **Style presets**: Classic CONSORT, BMC / SJTREM, Elsevier / Resuscitation,
  BJA (compact), Modern (slides).

## 8. Export and print

- **SVG** — true vector, fonts referenced, pure black ink; open in
  Illustrator/Inkscape for EPS/PDF.
- **PNG** — 300 / 600 / 1000 dpi, scaled to the chosen figure width (mm).
- **JPG** — 600 dpi, white matte.
- **Print** — opens the SVG in a print window.
- **JSON** — save/open the full project (graph + settings), versioned.
- Δ badges and selection chrome are never exported.

## 9. Persistence

- Autosave to local storage (`consort-flow-v2`).
- Import/export project JSON; the loader is backward compatible with earlier
  saved settings.

## 10. Tech

- TypeScript, React 19, Vite, Zustand. SVG rendering. Vitest unit tests.
- Pure client; no backend; deployable as a static site.
