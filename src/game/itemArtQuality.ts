/** Reject empty, solid-background and heavily fragmented item cutouts. */
export function hasUsableItemSilhouette(pixels: ArrayLike<number>, width: number, height: number): boolean {
  const size = width * height;
  const seen = new Uint8Array(size);
  let opaque = 0;
  let largest = 0;
  for (let p = 0; p < size; p++) {
    if (pixels[p * 4 + 3] < 128) continue;
    opaque++;
    if (seen[p]) continue;
    const queue = [p];
    seen[p] = 1;
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      const x = current % width;
      const neighbors = [current - width, current + width];
      if (x > 0) neighbors.push(current - 1);
      if (x < width - 1) neighbors.push(current + 1);
      for (const next of neighbors) {
        if (next < 0 || next >= size || seen[next] || pixels[next * 4 + 3] < 128) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    largest = Math.max(largest, queue.length);
  }
  return opaque >= size * 0.02 && opaque < size * 0.95 && largest / opaque >= 0.65;
}
/** Retry one rejected or interrupted drawing while respecting provider limits. */
export async function retryItemArt(
  draw: () => Promise<string | null>,
  onRefining?: () => void
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const art = await draw();
      if (art) return art;
    } catch (error: any) {
      if (/busy|limit|credit|billing|key|429|401|402/i.test(error?.message || '')) throw error;
    }
    if (attempt === 0) onRefining?.();
  }
  return null;
}

