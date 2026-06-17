import { DiagramStyle } from './style';

/** Outer breathing room around the whole diagram in the export/canvas. */
export const CANVAS_MARGIN = 96;

/** Width of a rotated phase label rail, proportional to the font size. */
export function phaseRailWidth(style: DiagramStyle): number {
  return Math.round(style.fontSize * 2.8);
}

/** Gap between the phase rail and the left edge of the diagram. */
export function phaseGap(style: DiagramStyle): number {
  return Math.round(style.fontSize * 1.6);
}
