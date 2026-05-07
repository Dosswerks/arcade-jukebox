/**
 * ID3v2 Parser
 * Lightweight inline parser that reads the Title field from embedded
 * ID3v2 metadata in MP3 files.
 *
 * This is a BEST-EFFORT, HTTPS-ONLY enhancement.
 * On file:// protocol or any fetch failure, returns null silently.
 */

/**
 * Reads the first ~10KB of an MP3 file and extracts the Title field
 * from ID3v2 headers if present.
 *
 * @param {string} url - Relative URL to the MP3 file (e.g., "assets/song.mp3")
 * @returns {Promise<string|null>} Title string or null if not found/not attempted
 */
export async function parseID3Title(url) {
  // Early bail-out: skip ID3 parsing entirely on file:// protocol
  if (window.location.protocol === 'file:') {
    return null;
  }

  let buffer;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      headers: { 'Range': 'bytes=0-10239' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    buffer = await response.arrayBuffer();
  } catch (e) {
    // Network failure, abort, or CORS error — silent fallback
    return null;
  }

  if (buffer.byteLength < 10) return null;

  const view = new DataView(buffer);

  // Check "ID3" magic bytes at offset 0
  if (view.getUint8(0) !== 0x49 || // 'I'
      view.getUint8(1) !== 0x44 || // 'D'
      view.getUint8(2) !== 0x33) { // '3'
    return null;
  }

  // Read ID3v2 version
  const majorVersion = view.getUint8(3);

  // Read tag size (synchsafe integer at bytes 6-9)
  const tagSize = (view.getUint8(6) << 21) |
                  (view.getUint8(7) << 14) |
                  (view.getUint8(8) << 7) |
                  view.getUint8(9);

  // Iterate frames starting at byte 10
  let offset = 10;
  const maxOffset = Math.min(tagSize + 10, buffer.byteLength);

  while (offset + 10 < maxOffset) {
    // Read frame ID (4 bytes)
    const frameId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );

    // Null frame ID means we've hit padding
    if (frameId === '\x00\x00\x00\x00') break;

    // Read frame size
    let frameSize;
    if (majorVersion >= 4) {
      // ID3v2.4 uses synchsafe integers for frame size
      frameSize = (view.getUint8(offset + 4) << 21) |
                  (view.getUint8(offset + 5) << 14) |
                  (view.getUint8(offset + 6) << 7) |
                  view.getUint8(offset + 7);
    } else {
      // ID3v2.3 uses regular integers
      frameSize = view.getUint32(offset + 4);
    }

    if (frameSize <= 0 || offset + 10 + frameSize > maxOffset) break;

    if (frameId === 'TIT2') {
      // Found the title frame
      const encoding = view.getUint8(offset + 10);
      const textStart = offset + 11;
      const textLength = frameSize - 1;

      if (textLength <= 0) return null;

      return decodeText(buffer, textStart, textLength, encoding);
    }

    offset += 10 + frameSize;
  }

  return null;
}

/**
 * Decode text from an ID3v2 frame based on encoding byte.
 * @param {ArrayBuffer} buffer
 * @param {number} start
 * @param {number} length
 * @param {number} encoding - 0=ISO-8859-1, 1=UTF-16 BOM, 2=UTF-16BE, 3=UTF-8
 * @returns {string|null}
 */
function decodeText(buffer, start, length, encoding) {
  try {
    const bytes = new Uint8Array(buffer, start, length);

    switch (encoding) {
      case 0: // ISO-8859-1
        return Array.from(bytes)
          .filter((b) => b !== 0)
          .map((b) => String.fromCharCode(b))
          .join('');

      case 1: // UTF-16 with BOM
      case 2: { // UTF-16BE
        const decoder = new TextDecoder('utf-16le');
        // Check BOM
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
          return decoder.decode(bytes.slice(2)).replace(/\0/g, '');
        } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
          const be = new TextDecoder('utf-16be');
          return be.decode(bytes.slice(2)).replace(/\0/g, '');
        }
        return decoder.decode(bytes).replace(/\0/g, '');
      }

      case 3: // UTF-8
        return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '');

      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}
