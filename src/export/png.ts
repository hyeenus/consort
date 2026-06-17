import { AppSettings, GraphState } from '../model/types';
import { exportScaleFor } from '../model/style';
import { buildScene } from '../render/geometry';
import { generateSvg } from './svg';

export interface RasterOptions {
  /** Target figure width in mm (defaults to the style's figureWidthMm). */
  figureWidthMm?: number;
  /** Output resolution. 300 = screen/preview, 600/1000 = print line art. */
  dpi?: number;
  format?: 'png' | 'jpeg';
  /** Fallback scale if mm/dpi are not supplied. */
  scale?: number;
}

export interface RasterResult {
  blob: Blob;
  width: number;
  height: number;
  scale: number;
}

export async function renderRasterBlob(
  graph: GraphState,
  settings: AppSettings,
  options: RasterOptions = {}
): Promise<RasterResult> {
  const scene = buildScene(graph, settings);
  const dpi = options.dpi ?? 300;
  const mm = options.figureWidthMm ?? settings.style.figureWidthMm;
  const scale = options.scale ?? clampScale(exportScaleFor(scene.width, mm, dpi));
  const format = options.format ?? 'png';

  const svgMarkup = generateSvg(graph, settings, { transparent: format === 'png' });
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(scene.width * scale));
    canvas.height = Math.max(1, Math.round(scene.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to acquire canvas context');
    }
    // White matte for JPEG (no alpha) and for crisp printed line art.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpeg' ? 0.95 : undefined;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Failed to create image blob'))),
        mime,
        quality
      );
    });
    return { blob, width: canvas.width, height: canvas.height, scale };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Keep raster output within what browsers can allocate on a 2D canvas.
function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 2;
  }
  return Math.min(scale, 24);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load SVG for raster export'));
    image.src = url;
  });
}
