import { AppSettings, GraphState } from '../model/types';
import { fontStack, paddingXFor } from '../model/style';
import { buildScene, firstLineCenterY, TextLine } from '../render/geometry';

interface SvgOptions {
  /** Include a transparent background instead of white (default white). */
  transparent?: boolean;
}

export function generateSvg(graph: GraphState, settings: AppSettings, options: SvgOptions = {}): string {
  const style = settings.style;
  const scene = buildScene(graph, settings);
  const ink = style.inkColor;
  const fill = style.fillColor;
  const family = fontStack(style);
  const padX = paddingXFor(style);
  const lineHeight = scene.lineHeight;
  const radius = style.cornerRadius;
  const sw = style.lineWeight;

  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(scene.width)}" height="${round(
      scene.height
    )}" viewBox="0 0 ${round(scene.width)} ${round(scene.height)}" font-family="${escapeAttr(family)}">`
  );

  // Arrowhead marker, sized to the stroke.
  parts.push(
    '<defs>',
    `<marker id="cb-arrow" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6.5,3 L0,6 z" fill="${escapeAttr(
      ink
    )}" /></marker>`,
    '</defs>'
  );

  if (!options.transparent) {
    parts.push(`<rect x="0" y="0" width="${round(scene.width)}" height="${round(scene.height)}" fill="#ffffff" />`);
  }

  // Phases (drawn first, behind the flow).
  scene.phases.forEach((phase) => {
    parts.push(
      rect(phase.x, phase.y, phase.width, phase.height, radius, fill, ink, sw),
      `<text x="${round(phase.textX)}" y="${round(phase.textY)}" transform="rotate(-90 ${round(phase.textX)} ${round(
        phase.textY
      )})" text-anchor="middle" dominant-baseline="central" font-size="${style.fontSize}" font-weight="700" fill="${escapeAttr(ink)}">`
    );
    const startY = -((phase.lines.length - 1) * lineHeight) / 2;
    phase.lines.forEach((line, index) => {
      parts.push(
        `<tspan x="${round(phase.textX)}" dy="${index === 0 ? round(startY) : lineHeight}">${escapeText(line)}</tspan>`
      );
    });
    parts.push('</text>');
  });

  // Connectors.
  scene.connectors.forEach((connector) => {
    parts.push(
      `<path d="${connector.path}" fill="none" stroke="${escapeAttr(ink)}" stroke-width="${sw}"${
        connector.showArrow ? ' marker-end="url(#cb-arrow)"' : ''
      } />`
    );
  });

  // Exclusion connectors + boxes.
  scene.exclusions.forEach((exclusion) => {
    parts.push(
      `<line x1="${round(exclusion.connector.x1)}" y1="${round(exclusion.connector.y1)}" x2="${round(
        exclusion.connector.x2
      )}" y2="${round(exclusion.connector.y2)}" stroke="${escapeAttr(ink)}" stroke-width="${sw}"${
        exclusion.showArrow ? ' marker-end="url(#cb-arrow)"' : ''
      } />`,
      rect(exclusion.x, exclusion.y, exclusion.width, exclusion.height, radius, fill, ink, sw),
      textBlock(exclusion.lines, exclusion.x, exclusion.y, exclusion.width, exclusion.height, exclusion.centerX)
    );
  });

  // Nodes.
  scene.nodes.forEach((node) => {
    parts.push(
      rect(node.x, node.y, node.width, node.height, radius, fill, ink, sw),
      textBlock(node.lines, node.x, node.y, node.width, node.height, node.centerX)
    );
  });

  parts.push('</svg>');
  return parts.join('');

  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fillColor: string,
    strokeColor: string,
    strokeWidth: number
  ): string {
    const rr = r > 0 ? ` rx="${r}" ry="${r}"` : '';
    return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(
      h
    )}"${rr} fill="${escapeAttr(fillColor)}" stroke="${escapeAttr(strokeColor)}" stroke-width="${strokeWidth}" />`;
  }

  function textBlock(
    lines: TextLine[],
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    centerX: number
  ): string {
    if (!lines.length) {
      return '';
    }
    const left = style.textAlign === 'left';
    const anchor = left ? 'start' : 'middle';
    const textX = left ? boxX + padX : centerX;
    const startY = firstLineCenterY(boxY, boxH, lines.length, lineHeight);
    const segs: string[] = [
      `<text x="${round(textX)}" y="${round(startY)}" text-anchor="${anchor}" dominant-baseline="central" font-size="${
        style.fontSize
      }" fill="${escapeAttr(ink)}">`,
    ];
    lines.forEach((line, index) => {
      segs.push(
        `<tspan x="${round(textX)}" dy="${index === 0 ? 0 : lineHeight}"${
          line.bold ? ` font-weight="${style.countWeight}"` : ''
        }>${escapeText(line.text)}</tspan>`
      );
    });
    segs.push('</text>');
    return segs.join('');
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
