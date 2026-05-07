/**
 * Title Deriver
 * Derives a human-readable display title from an MP3 filename.
 *
 * Rules:
 *   1. Remove .mp3 extension (case-insensitive)
 *   2. Replace hyphens and underscores with spaces
 *   3. Capitalize first letter of each word
 *
 * Examples:
 *   "song-title.mp3" → "Song Title"
 *   "ambient_underwater.mp3" → "Ambient Underwater"
 */

/**
 * @param {string} filename - Raw MP3 filename (e.g., "ambient_underwater.mp3")
 * @returns {string} Display title (e.g., "Ambient Underwater")
 */
export function deriveTitle(filename) {
  return filename
    .replace(/\.mp3$/i, '')       // Remove extension
    .replace(/[-_]/g, ' ')        // Replace hyphens/underscores with spaces
    .toLowerCase()                // Normalize to lowercase first
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize first letter of each word
}
