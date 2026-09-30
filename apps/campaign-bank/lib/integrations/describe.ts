// Human words for a spot on a design, for people reading Slack or Asana without the image.

/** "top left", "center", "lower right" from fractions of the image. Uses the center of an area. */
export function describePosition(x: number, y: number, w?: number | null, h?: number | null): string {
  const cx = w ? x + w / 2 : x;
  const cy = h ? y + h / 2 : y;
  const col = cx < 1 / 3 ? 'left' : cx > 2 / 3 ? 'right' : 'center';
  const row = cy < 0.2 ? 'top' : cy < 0.45 ? 'upper' : cy < 0.6 ? 'middle' : cy < 0.85 ? 'lower' : 'bottom';
  if (row === 'middle' && col === 'center') return 'center';
  if (row === 'middle') return `middle ${col}`;
  return `${row} ${col}`;
}

/** Crop box around a pin or an area, as fractions, clamped to the image. */
export function cropBox(x: number, y: number, w: number | null | undefined, h: number | null | undefined, aspect: number): { x: number; y: number; w: number; h: number } {
  // aspect = width / height of the image. Pin crops are a square-ish window 32% of the width.
  let bx: number, by: number, bw: number, bh: number;
  if (w && h) {
    const pad = 0.06;
    bx = x - pad;
    by = y - pad * aspect;
    bw = w + pad * 2;
    bh = h + pad * 2 * aspect;
  } else {
    bw = 0.32;
    bh = bw * aspect;
    bx = x - bw / 2;
    by = y - bh / 2;
  }
  bw = Math.min(bw, 1);
  bh = Math.min(bh, 1);
  bx = Math.max(0, Math.min(bx, 1 - bw));
  by = Math.max(0, Math.min(by, 1 - bh));
  return { x: bx, y: by, w: bw, h: bh };
}

export function emLabel(index: number, count: number): string {
  return count > 1 ? `EM${index}` : 'the design';
}
