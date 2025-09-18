import { AppSettings, GraphState } from '../model/types';
import { generateSvg } from './svg';

interface PngOptions {
  scale?: number;
}

export async function renderPngBlob(graph: GraphState, settings: AppSettings, options: PngOptions = {}): Promise<Blob> {
  const scale = options.scale ?? 2;
  const svgMarkup = generateSvg(graph, settings);
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to acquire canvas context');
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create PNG blob'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load SVG for PNG export'));
    image.src = url;
  });
}

