/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared pre-upload image compressor and resizer (~1280px JPEG)
 * Used consistently across IncubatorLab, PhotoQuest, PhotoItemModal, and CreateBiomeModal.
 * Validates raw and encoded sizes matching server limits before invoking network/providers.
 */

export const MAX_RAW_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_ENCODED_IMAGE_CHARS = 3_000_000; // Matches server MAX_IMAGE_CHARS
export const DEFAULT_MAX_DIMENSION = 1280;
export const DEFAULT_JPEG_QUALITY = 0.85;

export class ImageDecodeError extends Error {
  constructor(message = 'Could not decode image file. Please provide a valid JPEG, PNG, or WebP photo.') {
    super(message);
    this.name = 'ImageDecodeError';
  }
}

export interface PreparedPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Validates and scales an image down to ~1280px JPEG before network dispatch.
 * Checks:
 * 1. Raw file size <= 8MB
 * 2. Valid image MIME type
 * 3. Successful decode via Image element (throws ImageDecodeError on corrupted bytes, preventing any provider call)
 * 4. Proportional canvas scaling so max(w, h) <= maxDimension
 * 5. Compression quality stepped down if encoded payload exceeds 3,000,000 characters
 */
export async function preparePhotoForUpload(
  input: File | Blob | string,
  options?: {
    maxDimension?: number;
    quality?: number;
  }
): Promise<PreparedPhoto> {
  const maxDim = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const initialQuality = options?.quality ?? DEFAULT_JPEG_QUALITY;

  let rawSource: string;

  if (typeof input !== 'string') {
    // Input is File or Blob
    if (input.size > MAX_RAW_IMAGE_SIZE_BYTES) {
      const sizeMb = (input.size / (1024 * 1024)).toFixed(1);
      throw new Error(`Photo is larger than 8MB (${sizeMb}MB). Please choose a photo under 8MB.`);
    }

    if (input.type && !input.type.startsWith('image/')) {
      throw new Error('Please select a valid photo (JPEG, PNG, or WebP).');
    }

    rawSource = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new ImageDecodeError('Failed to read image file.'));
      reader.readAsDataURL(input);
    });
  } else {
    rawSource = input;
  }

  if (!rawSource || typeof rawSource !== 'string' || !rawSource.startsWith('data:image/')) {
    throw new ImageDecodeError('Could not decode image file. Please provide a valid JPEG, PNG, or WebP photo.');
  }

  // Load into Image element to verify decode and measure dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new ImageDecodeError('Could not decode image file. Please provide a valid JPEG, PNG, or WebP photo.'));
    img.src = rawSource;
  });

  if (img.width <= 0 || img.height <= 0) {
    throw new ImageDecodeError('Could not decode image file. Image has invalid dimensions.');
  }

  // Compute proportional scaled dimensions
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    if (w >= h) {
      h = Math.max(1, Math.round((h * maxDim) / w));
      w = maxDim;
    } else {
      w = Math.max(1, Math.round((w * maxDim) / h));
      h = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas context for image compression.');
  }

  ctx.drawImage(img, 0, 0, w, h);

  // Encode as JPEG with size ceiling check (server rejects payloads > 3,000,000 chars)
  let quality = initialQuality;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  if (dataUrl.length > MAX_ENCODED_IMAGE_CHARS) {
    quality = 0.70;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > MAX_ENCODED_IMAGE_CHARS) {
    quality = 0.55;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > MAX_ENCODED_IMAGE_CHARS) {
    // If still over 3MB, scale dimensions down further
    const scaleFactor = 0.75;
    canvas.width = Math.max(1, Math.round(w * scaleFactor));
    canvas.height = Math.max(1, Math.round(h * scaleFactor));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    w = canvas.width;
    h = canvas.height;
  }

  if (dataUrl.length > MAX_ENCODED_IMAGE_CHARS) {
    throw new Error('A PNG, JPEG or WebP photo under 3 MB is required.');
  }

  return { dataUrl, width: w, height: h };
}
