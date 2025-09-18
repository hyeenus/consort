# CONSORT Flowchart Builder (V1)

Browser-based tool for constructing publication-ready CONSORT-style patient flow diagrams. This repository implements the Version 1 feature set defined in `SPEC.md` and `ROADMAP.md`.

## Quick Start

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`) in Chrome, Firefox, Safari, or Edge. The app stores your latest project in local storage so you can pick up where you left off.

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
