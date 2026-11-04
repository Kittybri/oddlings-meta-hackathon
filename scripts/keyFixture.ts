import zlib from 'zlib';

/**
 * Creates a minimal valid PNG Buffer using pure Node.js built-ins.
 * @param width image width in pixels
 * @param height image height in pixels
 * @param pixelFn function returning [r, g, b, a] for each (x, y)
 */
export function createPngBuffer(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number]
): Buffer {
  // 1 scanline = 1 filter byte (0 = None) + 4 bytes per pixel (RGBA)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // Helper to create CRC32 checksum
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function createChunk(type: string, data: Buffer): Buffer {
    const len = data.length;
    const header = Buffer.alloc(4 + 4);
    header.writeUInt32BE(len, 0);
    header.write(type, 4, 4, 'ascii');

    const typeAndData = Buffer.concat([header.subarray(4, 8), data]);
    const crc = crc32(typeAndData);

    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([header.subarray(0, 4), typeAndData, crcBuf]);
  }

  // PNG Signature
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: 13 bytes
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // color type 6: RGBA
  ihdrData.writeUInt8(0, 10); // compression 0
  ihdrData.writeUInt8(0, 11); // filter 0
  ihdrData.writeUInt8(0, 12); // interlace 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Generates a clean 128x128 raster fixture of a brass antique key:
 * - Round bow (outer radius 18, inner cutout hole radius 9)
 * - Shaft extending from bow to end
 * - Two distinct teeth on the blade tip
 * - Warm brass color with highlight and shadow
 */
export function generateBrassKeyFixturePng(): Buffer {
  const width = 128;
  const height = 128;

  // Key geometry (horizontal orientation):
  // Bow center: (32, 64)
  // Outer bow radius: 18, Inner hole radius: 8
  // Shaft: y in [60, 68], x in [48, 108]
  // Tooth 1: x in [86, 92], y in [68, 82]
  // Tooth 2: x in [98, 106], y in [68, 88]

  return createPngBuffer(width, height, (x, y) => {
    // Background: clean neutral studio white/light gray
    const bgR = 245;
    const bgG = 247;
    const bgB = 250;

    const bowDx = x - 32;
    const bowDy = y - 64;
    const distToBowCenter = Math.sqrt(bowDx * bowDx + bowDy * bowDy);

    const isBowRing = distToBowCenter <= 18 && distToBowCenter >= 8;
    const isShaft = x >= 46 && x <= 108 && y >= 60 && y <= 68;
    const isTooth1 = x >= 86 && x <= 92 && y >= 68 && y <= 82;
    const isTooth2 = x >= 98 && x <= 106 && y >= 68 && y <= 88;

    if (isBowRing || isShaft || isTooth1 || isTooth2) {
      // Brass palette with 3D gradient/highlights
      // Top highlight:
      const isTopHighlight = (isShaft && y <= 62) || (isBowRing && bowDy < -10);
      const isBottomShadow = (isShaft && y >= 66) || isTooth2;

      if (isTopHighlight) {
        // Bright brass highlight #fde047
        return [253, 224, 71, 255];
      } else if (isBottomShadow) {
        // Deep antique brass shadow #b45309
        return [180, 83, 9, 255];
      }
      // Rich metallic brass #d97706
      return [217, 119, 6, 255];
    }

    // Shadow underneath key for grounding
    const isShadow = (y >= 69 && y <= 72 && x >= 46 && x <= 108) ||
                     (distToBowCenter > 18 && distToBowCenter <= 21 && bowDy > 5);
    if (isShadow) {
      return [220, 225, 232, 255];
    }

    return [bgR, bgG, bgB, 255];
  });
}
