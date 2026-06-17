import { DiagramStyle } from './style';

/** Outer breathing room around the whole diagram in the export/canvas. */
export const CANVAS_MARGIN = 96;

/** Width of a rotated phase label rail, proportional to the font size. */
export function phaseRailWidth(style: DiagramStyle): number {
  return Math.max(34, Math.round(style.fontSize * 2.4));
}

/** Gap between the phase rail and the left edge of the diagram. */
export function phaseGap(style: DiagramStyle): number {
  return Math.round(style.fontSize * 1.6);
}

/** Small empty gap left between adjacent phases that meet at a connector mid-gap. */
export function phaseNeatGap(style: DiagramStyle): number {
  return Math.max(6, Math.round(style.fontSize * 0.55));
}
