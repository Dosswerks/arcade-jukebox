/**
 * Social Sharing
 * Provides Web Share API integration for sharing the currently playing track.
 * Uses navigator.share when available, with a clipboard fallback for desktop.
 */

const JUKEBOX_URL = 'https://dosswerks.github.io/arcade-jukebox/';

/**
 * Determines if the Web Share API is available.
 * @returns {boolean}
 */
export function isShareSupported() {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Determines if the Clipboard API is available for fallback.
 * @returns {boolean}
 */
export function isClipboardSupported() {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
}

/**
 * Builds a shareable URL for a given track filename.
 * @param {string|null} filename - The track filename (e.g., "Dagon.mp3")
 * @returns {string} - Full URL with ?track= param, or base URL if no track
 */
export function buildShareURL(filename) {
  if (!filename) return JUKEBOX_URL;
  const url = new URL(JUKEBOX_URL);
  url.searchParams.set('track', filename);
  return url.toString();
}

/**
 * Shares the currently playing track via the Web Share API.
 * Falls back to copying the link to clipboard on unsupported platforms.
 *
 * @param {object} options
 * @param {string|null} options.trackTitle - Display title of the current track
 * @param {string|null} options.trackFilename - Filename for deep link
 * @param {function} [options.onSuccess] - Called after successful share/copy
 * @param {function} [options.onError] - Called on failure
 */
export async function shareTrack({ trackTitle, trackFilename, onSuccess, onError }) {
  const url = buildShareURL(trackFilename);
  const title = trackTitle
    ? `🎵 ${trackTitle} — Dosswerks Arcade Jukebox`
    : 'Dosswerks Arcade Jukebox';
  const text = trackTitle
    ? `Check out "${trackTitle}" on the Dosswerks Arcade Jukebox!`
    : 'Check out the Dosswerks Arcade Jukebox!';

  if (isShareSupported()) {
    try {
      await navigator.share({ title, text, url });
      if (onSuccess) onSuccess('shared');
    } catch (e) {
      // User cancelled share — not an error
      if (e.name === 'AbortError') return;
      if (onError) onError(e);
    }
  } else if (isClipboardSupported()) {
    try {
      await navigator.clipboard.writeText(url);
      if (onSuccess) onSuccess('copied');
    } catch (e) {
      if (onError) onError(e);
    }
  } else {
    if (onError) onError(new Error('Sharing not supported'));
  }
}
