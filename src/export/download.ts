export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadString(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}

