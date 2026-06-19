// Diagram style model — the single source of truth for how a flow diagram looks
// and how it scales. Everything publication-related (fonts, box geometry, line
// weight, spacing, number formatting, export width) lives here so that layout,
// on-screen rendering, and vector/raster export all stay perfectly in sync.

export type FontKey = 'helvetica' | 'arial' | 'times' | 'system';
export type NumberStyle = 'N' | 'n' | 'plain';
export type ThousandsSep = 'space' | 'comma' | 'period' | 'none';
export type TextAlign = 'left' | 'center';

export interface DiagramStyle {
  /** Name of the style preset this was derived from (informational only). */
  preset: string;
  fontKey: FontKey;
  /** Base text size in px (on-screen). Print size is derived at export time. */
  fontSize: number;
  /** Uniform main-flow box width in px. */
  boxWidth: number;
  /** Side exclusion-box width in px. */
  exclusionWidth: number;
  /** Stroke width for borders and connectors in px. */
  lineWeight: number;
  /** Corner radius in px (0 = sharp rectangles, the publication default). */
  cornerRadius: number;
  /** Vertical gap between stacked boxes in px. */
  verticalGap: number;
  /** Horizontal gap between branch siblings in px. */
  branchGap: number;
  /** Horizontal distance from the main flow to a side exclusion box in px. */
  exclusionGap: number;
  /** Text alignment inside boxes. */
  textAlign: TextAlign;
  /** Font weight applied to the count line and exclusion totals. */
  countWeight: number;
  /** Whether connectors end in an arrowhead (vs. a plain line). */
  arrowheads: boolean;
  /** How the patient count is labelled. */
  numberStyle: NumberStyle;
  thousandsSep: ThousandsSep;
  /** Ink (border + text) colour. Publication default is pure black. */
  inkColor: string;
  /** Box fill colour. */
  fillColor: string;
  /** Target figure width in mm used to scale raster/vector exports. */
  figureWidthMm: number;
  /** Optional phase-rail width override; falls back to a font-scaled default. */
  phaseWidth?: number;
}

export const FONT_STACKS: Record<FontKey, string> = {
  helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  arial: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  times: "'Times New Roman', Times, Georgia, serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export const FONT_LABELS: Record<FontKey, string> = {
  helvetica: 'Helvetica',
  arial: 'Arial',
  times: 'Times',
  system: 'System',
};

export function fontStack(style: DiagramStyle): string {
  return FONT_STACKS[style.fontKey] ?? FONT_STACKS.helvetica;
}

// Derived geometry --------------------------------------------------------

/** On-screen line height in px, proportional to the font size. */
export function lineHeightFor(style: DiagramStyle): number {
  return Math.round(style.fontSize * 1.32);
}

/** Inner horizontal padding for box text. */
export function paddingXFor(style: DiagramStyle): number {
  return Math.round(style.fontSize * 0.9);
}

/** Inner vertical padding for box text. */
export function paddingYFor(style: DiagramStyle): number {
  return Math.round(style.fontSize * 0.85);
}

/** Average glyph width as a fraction of font size, for width-aware wrapping. */
const AVG_CHAR_RATIO = 0.54;

/** How many characters fit on one line for a given content width. */
export function maxCharsFor(contentWidth: number, style: DiagramStyle): number {
  const usable = contentWidth - paddingXFor(style) * 2;
  return Math.max(6, Math.floor(usable / (style.fontSize * AVG_CHAR_RATIO)));
}

// Figure-width presets (mm) -----------------------------------------------

export interface FigureWidthPreset {
  id: string;
  label: string;
  mm: number;
  hint: string;
}

export const FIGURE_WIDTH_PRESETS: FigureWidthPreset[] = [
  { id: 'single', label: 'Single column', mm: 88, hint: '≈88 mm — most journals' },
  { id: 'onehalf', label: '1.5 column', mm: 130, hint: '≈120–140 mm' },
  { id: 'double', label: 'Double column', mm: 180, hint: '≈180–190 mm full width' },
];

export const MM_PER_INCH = 25.4;

/** Pixels needed to render a diagram of `diagramWidthPx` at a target mm + dpi. */
export function exportScaleFor(diagramWidthPx: number, figureWidthMm: number, dpi: number): number {
  const targetPx = (figureWidthMm / MM_PER_INCH) * dpi;
  if (diagramWidthPx <= 0) {
    return 1;
  }
  return targetPx / diagramWidthPx;
}

// Style presets -----------------------------------------------------------

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  style: DiagramStyle;
}

const BASE: DiagramStyle = {
  preset: 'classic',
  fontKey: 'helvetica',
  fontSize: 15,
  boxWidth: 300,
  exclusionWidth: 250,
  lineWeight: 1.4,
  cornerRadius: 0,
  verticalGap: 56,
  branchGap: 40,
  exclusionGap: 64,
  textAlign: 'center',
  countWeight: 700,
  arrowheads: true,
  numberStyle: 'N',
  thousandsSep: 'space',
  inkColor: '#111111',
  fillColor: '#ffffff',
  figureWidthMm: 88,
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'classic',
    name: 'Classic CONSORT',
    description: 'Sharp black-and-white rectangles, Helvetica, centred. The safe default for most journals.',
    style: { ...BASE, preset: 'classic' },
  },
  {
    id: 'bmc',
    name: 'BMC / SJTREM',
    description: 'Helvetica, left-aligned exclusion lists, hairline borders — matches BioMed Central / Springer house style.',
    style: {
      ...BASE,
      preset: 'bmc',
      fontKey: 'helvetica',
      textAlign: 'left',
      lineWeight: 1,
      cornerRadius: 0,
      countWeight: 700,
    },
  },
  {
    id: 'elsevier',
    name: 'Elsevier / Resuscitation',
    description: 'Arial, centred, slightly heavier rule weight — tuned to Elsevier line-art guidance.',
    style: {
      ...BASE,
      preset: 'elsevier',
      fontKey: 'arial',
      lineWeight: 1.5,
      cornerRadius: 0,
    },
  },
  {
    id: 'bja',
    name: 'BJA (compact)',
    description: 'Helvetica at a tighter size and spacing for dense single-column figures.',
    style: {
      ...BASE,
      preset: 'bja',
      fontKey: 'helvetica',
      fontSize: 14,
      boxWidth: 280,
      verticalGap: 46,
      lineWeight: 1.2,
      cornerRadius: 0,
    },
  },
  {
    id: 'modern',
    name: 'Modern (slides)',
    description: 'Soft rounded corners and the system font — for talks, posters, and preprints rather than print journals.',
    style: {
      ...BASE,
      preset: 'modern',
      fontKey: 'system',
      cornerRadius: 8,
      lineWeight: 1.6,
      verticalGap: 60,
    },
  },
];

export const DEFAULT_STYLE: DiagramStyle = { ...BASE };

export function getStylePreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((preset) => preset.id === id);
}

/** Clamp user-entered geometry to safe ranges so the diagram can't break. */
export function clampStyle(style: DiagramStyle): DiagramStyle {
  return {
    ...style,
    fontSize: clamp(style.fontSize, 9, 28),
    boxWidth: clamp(style.boxWidth, 140, 520),
    exclusionWidth: clamp(style.exclusionWidth, 120, 480),
    lineWeight: clamp(style.lineWeight, 0.5, 4),
    cornerRadius: clamp(style.cornerRadius, 0, 24),
    verticalGap: clamp(style.verticalGap, 24, 160),
    branchGap: clamp(style.branchGap, 16, 160),
    exclusionGap: clamp(style.exclusionGap, 16, 200),
    figureWidthMm: clamp(style.figureWidthMm, 40, 200),
    phaseWidth: style.phaseWidth != null ? clamp(style.phaseWidth, 24, 160) : style.phaseWidth,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
