/**
 * Minimal intrinsic-dimension reader for PNG and JPEG buffers. DOCX's ImageRun
 * needs explicit width/height, and we avoid pulling in an image library for a
 * single uploaded logo. Returns null when the format isn't recognised.
 */
export function getImageSize(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 24) {
    return null;
  }

  // PNG: 8-byte signature, then IHDR with width@16 and height@20 (big-endian).
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  if (isPng) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  // JPEG: starts with FFD8; scan segments for a Start-Of-Frame marker.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === undefined) {
        break;
      }
      // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11, SOF13–SOF15 carry frame dimensions.
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      // Skip this segment using its length field.
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  return null;
}

/**
 * Scales intrinsic dimensions to fit within a max box, preserving aspect ratio.
 */
export function fitWithin(
  size: { width: number; height: number },
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (size.width <= 0 || size.height <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
}
