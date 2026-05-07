/**
 * Game Prefix Filter
 * Filters a TrackInfo array by filename prefix (case-insensitive).
 *
 * Used for the ?game= deep-link parameter to show only tracks
 * from a specific game.
 *
 * If no tracks match the prefix, returns the full unfiltered array
 * (per Requirement 10.7).
 *
 * @param {Array<{filename: string}>} tracks - Array of TrackInfo objects
 * @param {string} prefix - Game name prefix to filter by
 * @returns {Array<{filename: string}>} Filtered array, or full array if no matches
 */
export function filterByGamePrefix(tracks, prefix) {
  if (!prefix) {
    return tracks;
  }

  const lowerPrefix = prefix.toLowerCase();
  const filtered = tracks.filter((track) =>
    track.filename.toLowerCase().startsWith(lowerPrefix)
  );

  // If no tracks match, return the full unfiltered list
  return filtered.length > 0 ? filtered : tracks;
}
