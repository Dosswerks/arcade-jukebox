/**
 * Manifest Processor
 * Processes raw filename array into enriched TrackInfo objects.
 * Attempts ID3v2 title extraction, falls back to filename derivation.
 * Applies natural sort to the processed array.
 */

import { parseID3Title } from './id3-parser.js';
import { deriveTitle } from './title-deriver.js';
import { naturalSort } from './natural-sort.js';

const ASSETS_PATH = 'assets/';

/**
 * @typedef {Object} TrackInfo
 * @property {string} filename - Original filename from tracks.js
 * @property {string} path - Relative path to audio file
 * @property {string} title - Display title (ID3 or filename-derived)
 * @property {'id3'|'filename'} titleSource - Source of the title
 * @property {number} originalIndex - Index in the original TRACKS array
 */

/**
 * Process raw filename array into enriched, sorted TrackInfo objects.
 * @param {string[]} filenames - Raw MP3 filename strings from TRACKS global
 * @returns {Promise<TrackInfo[]>} Sorted array of track metadata
 */
export async function processManifest(filenames) {
  const tracks = await Promise.all(
    filenames.map(async (filename, index) => {
      const path = ASSETS_PATH + filename;
      let title = null;
      let titleSource = 'filename';

      // Attempt ID3v2 title extraction (best-effort, HTTPS-only)
      try {
        title = await parseID3Title(path);
        if (title) {
          titleSource = 'id3';
        }
      } catch (e) {
        // Silent failure — fall back to filename
      }

      // Fall back to filename-derived title
      if (!title) {
        title = deriveTitle(filename);
        titleSource = 'filename';
      }

      return {
        filename,
        path,
        title,
        titleSource,
        originalIndex: index,
      };
    })
  );

  return naturalSort(tracks);
}
