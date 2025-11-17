# CONSORT Flowchart Builder (V1)

Browser-based tool for constructing publication-ready CONSORT-style patient flow diagrams. This repository implements the Version 1 feature set defined in `SPEC.md` and `ROADMAP.md`.

## Using the App

- Open the published build at `https://hyeenus.github.io/consort/consort_builder/` (or the project page linked from the repository description).
- Select boxes on the canvas to edit their text and patient counts in the inspector on the right; the app keeps totals balanced automatically unless you enable Free Edit.
- Use the toolbar to add steps, switch between arrows/lines, format counts, or export SVG/PNG/JSON snapshots.
- Contextual help pop-ups appear the first time you use each feature and can be toggled via the Help button in the toolbar.
- Projects save in your browser automatically; export JSON if you need to move to another device.

### Scripts

- `npm run dev` – start the Vite development server
- `npm run build` – produce a static production build in `dist/`
- `npm run preview` – preview the production build locally
- `npm run test` – run unit tests with Vitest
- `npm run lint` – run ESLint across the TypeScript source

## Keyboard Cheat Sheet (V1)

- Arrow keys – move selection between boxes (`↑/↓`) and box ↔ exclusion connectors (`←/→`)
- `Enter` / `F2` – focus the inspector fields for the current selection
- `Esc` – clear the current selection
- `Cmd/Ctrl + ↓` – add a new main-flow box beneath the selected box
- `Cmd/Ctrl + →` – jump from a box to its exclusion connector
- `A` – toggle arrow ↔ plain line for the selected connector
- `Cmd/Ctrl + Z` / `Shift + Cmd/Ctrl + Z` – undo / redo

## Feature Highlights (V1)

- Single-column main flow with orthogonal connectors
- One exclusion box per interval with automatic tallies; optionally split exclusions into multiple reason rows with an auto-generated remainder
- Unlock mode allows free editing while Δ badges highlight inconsistencies
- Undo/redo history (100 steps), quick reset back to a starter canvas, and local-storage autosave
- Export to SVG (always) and PNG (best-effort with fallback)
- JSON import/export for moving projects between browsers or sharing with teammates

## Known Limitations (Future Roadmap)

- Branching flows, multi-reason exclusions, locale-aware formatting, and advanced export formats (PDF/EPS/JPG) are not yet implemented
- PNG export renders at 2× scale by default; DPI presets arrive in a future milestone
- Validation panel UI and global locale selector will appear in later releases

Refer to `SPEC.md` and `ROADMAP.md` for the complete target scope and upcoming milestones.

## Deployment (GitHub Pages)

Pushing to the `main` branch triggers `.github/workflows/deploy.yml`, which runs tests, builds the Vite bundle, and deploys the contents of `dist/` to GitHub Pages. The site will be served from `https://hyeenus.github.io/consort/`, and `vite.config.ts` already sets `base: '/consort/'` so asset URLs resolve correctly.

## Contextual Help (V1.1)

The app now includes contextual pop-up guidance that appears the first time each feature is used. Highlights:

- A welcome screen explains how to build CONSORT diagrams before any other tips appear.
- Each toolbar toggle and export button shows a one-time description after its first use.
- Inspector tips explain node editing, exclusions, and the auto-balancing logic.
- Users can disable help permanently via each popup or the Help toggle in the toolbar, and re-enable it later if needed.
