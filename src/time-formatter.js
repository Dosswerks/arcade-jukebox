/**
 * Time Formatter
 * Converts a non-negative number of seconds to M+:SS display format.
 *
 * Examples:
 *   0 → "0:00"
 *   65 → "1:05"
 *   3661 → "61:01"
 *
 * @param {number} seconds - Non-negative integer seconds
 * @returns {string} Formatted time string in M+:SS format
 */
export function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
