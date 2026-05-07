/**
 * Natural Sort
 * Sorts an array of TrackInfo objects by display title using
 * case-insensitive natural numeric sorting.
 *
 * Uses String.prototype.localeCompare with numeric and base sensitivity
 * options for proper natural ordering (e.g., "Track 2" before "Track 10").
 *
 * @param {Array<{title: string}>} tracks - Unsorted track array
 * @returns {Array<{title: string}>} Sorted track array (new array, no mutation)
 */
export function naturalSort(tracks) {
  return [...tracks].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
}
