# Flowchart Builder — publication-ready patient selection diagrams

A browser-based tool for building CONSORT / STROBE-style participant flow diagrams
for academic papers. It is aimed at retrospective and observational studies in
emergency medicine, critical care, and anaesthesia (e.g. *SJTREM*, *Resuscitation*,
*BJA*), and produces clean, black-and-white, vector-quality figures that drop
straight into a manuscript.

This branch (`redesign-v2`) is a ground-up rebuild of the original V1 builder. It
keeps the proven calculation engine (auto-balancing counts, branching, exclusions,
Δ validation) and rebuilds everything you see and export around a single,
style-driven rendering pipeline.

## Why it looks the way it does

The defaults follow the conventions of highly-rated medical journals:

- **Sharp-cornered rectangles**, thin black borders, white fill, black text — the
  dominant CONSORT/STROBE house style.
- **Sans-serif type** — Helvetica or Arial (BMC/Springer and BJA author guidance).
- **Line weights of 0.5–1.5 pt** and vector output, with raster fall-backs at
  300 / 600 / 1000 dpi for line-art requirements.
- **Figure-width presets** of 88 mm (single column), 130 mm (1.5 column), and
  180 mm (double column), matching Elsevier / Springer / BMC sizing.

## What you can do

- **Start from a template** — STROBE retrospective selection, CONSORT randomised
  trial, diagnostic / case-control, or PRISMA-style screening.
- **Apply a journal style preset** — Classic CONSORT, BMC / SJTREM, Elsevier /
  Resuscitation, BJA (compact), or Modern (slides).
- **Resize and reshape** from the Format panel — font, font size, alignment, box
  width, spacing, exclusion offset, line weight, corner radius, number style and
  thousands separator, and target figure width. The diagram re-flows so it stays
  clean.
- **Auto-balanced counts** — child and exclusion totals stay consistent; switch to
  *manual* or *free edit* to override, with a red Δ marking any mismatch (never
  exported).
- **Branching** (two-arm symmetric split and multi-child bus bar), **exclusion
  boxes** with reason rows and an auto-generated remainder, and **phase labels** on
  the left rail.
- **Hybrid layout** — auto-layout keeps everything tidy, but you can drag any box
  to fine-tune its position and reset it at any time.
- **Pan / zoom / fit**, undo / redo (100 steps), and local-storage autosave.
- **Export** to SVG (true vector), PNG (300 / 600 / 1000 dpi, sized to your figure
  width), JPG, print, and JSON project files (save / open).

## Scripts

- `npm run dev` – start the Vite dev server (served under `/consort/`)
- `npm run build` – produce a static production build in `dist/`
- `npm run preview` – preview the production build locally
- `npm run test` – run unit tests with Vitest
- `npm run lint` – run ESLint across the TypeScript source

## Keyboard

- `↑ ↓ ← →` – move selection between boxes and connectors
- `Cmd/Ctrl + ↓` – add a step below the selection
- `Cmd/Ctrl + Z` / `Shift + Cmd/Ctrl + Z` – undo / redo
- `Delete` / `Backspace` – remove the selected box (and its subtree)
- `Esc` – deselect

## Architecture

```
src/
  model/        graph (calc engine), layout, style, templates, numbers, types
  render/       geometry — the single source of geometric truth
  canvas/       interactive SVG canvas (pan/zoom, drag, selection)
  export/       svg + png/jpg renderers (share the render/ geometry)
  ui/           Toolbar, LeftPanel, Inspector, StyleControls, HelpModal
  state/        Zustand store (history, style, templates, persistence)
  app/          App shell, keyboard, export wiring
```

The on-screen canvas and the SVG/PNG exporters both build from
`render/geometry.ts`, so **what you see is exactly what you publish**.

## Deployment (GitHub Pages)

`vite.config.ts` sets `base: '/consort/'`. Pushing to `main` builds the Vite bundle
and deploys `dist/` to GitHub Pages at `https://hyeenus.github.io/consort/`.
