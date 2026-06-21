# Roadmap

## Status: version 2 shipped

The version-2 rebuild is live at <https://consort.anssisaviluoto.com>. It keeps
the V1 calculation engine and rebuilds the experience and output around a single
style-driven rendering pipeline (`src/render/geometry.ts`).

### Shipped

- Single-source geometry shared by the canvas and the SVG/PNG/JPG exporters.
- Publication defaults: sharp B/W rectangles, Helvetica/Arial, thin rules,
  orthogonal connectors.
- `DiagramStyle` model + Format panel: font, size, alignment, box/exclusion
  width, spacing, exclusion offset, line weight, corner radius, number style and
  separator, arrowheads, and figure width (88 / 130 / 180 mm).
- Study templates (STROBE, CONSORT, case-control, PRISMA) and journal style
  presets (Classic, BMC/SJTREM, Elsevier, BJA, Modern).
- Auto-balanced counts with manual and free-edit modes; Δ validation (screen
  only).
- Branching (2-arm split, ≥3 bus bar), exclusion boxes with reason rows and
  auto remainder.
- Phase rails outside the diagram, taller bands meeting at the connector mid-gap;
  resizable by dragging the ends with snapping to box top/bottom borders or the
  mid-gap.
- Hybrid layout: auto-layout plus drag-to-nudge boxes and drag-to-resize widths
  (main flow, exclusion, phase) in addition to the Format-panel sliders.
- Pan / zoom / fit, undo–redo (100 steps), local-storage autosave, JSON
  import/export.
- Explicit-baseline text centring (portable to vector editors).
- Export: SVG, PNG at 300/600/1000 dpi sized to figure width, JPG, print, JSON.
- Deployed to GitHub Pages on the custom domain via the Actions workflow.

### Possible future work

- Native vector **PDF / EPS** export (currently via SVG → Illustrator/Inkscape).
- Locale presets and per-box width overrides surfaced in the UI.
- Inspector controls for phase edge snap mode and arrow styles.
- Multi-page / multi-figure projects.
