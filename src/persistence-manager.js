/**
 * Persistence Manager
 * Reads/writes playback preferences to localStorage.
 * Gracefully handles unavailable localStorage, quota errors,
 * private browsing, malformed data, and schema version mismatches.
 */

const STORAGE_KEY = 'dosswerks-jukebox-state';
const STORAGE_VERSION = 1;

export class PersistenceManager {
  constructor() {
    this._available = null; // lazy-checked
  }

  /**
   * Check if localStorage is available and writable.
   * @returns {boolean}
   */
  isAvailable() {
    if (this._available !== null) {
      return this._available;
    }
    try {
      const testKey = '__jukebox_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      this._available = true;
    } catch (e) {
      this._available = false;
    }
    return this._available;
  }

  /**
   * Save playback state to localStorage.
   * @param {{ lastTrack: string|null, volume: number, mode: string, shuffleEnabled: boolean }} state
   */
  save(state) {
    if (!this.isAvailable()) return;

    const data = JSON.stringify({
      version: STORAGE_VERSION,
      lastTrack: state.lastTrack,
      volume: state.volume,
      mode: state.mode,
      shuffleEnabled: state.shuffleEnabled,
    });

    try {
      localStorage.setItem(STORAGE_KEY, data);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // Clear old jukebox data and retry once
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(STORAGE_KEY, data);
        } catch (retryError) {
          // Give up — disable persistence for this session
          this._available = false;
        }
      } else {
        // Private browsing or other error — disable silently
        this._available = false;
      }
    }
  }

  /**
   * Load persisted state from localStorage.
   * @returns {{ lastTrack: string|null, volume: number, mode: string, shuffleEnabled: boolean } | null}
   */
  load() {
    if (!this.isAvailable()) return null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      // Schema version check
      if (!parsed || parsed.version !== STORAGE_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return {
        lastTrack: parsed.lastTrack || null,
        volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0,
        mode: parsed.mode || 'play-through',
        shuffleEnabled: !!parsed.shuffleEnabled,
      };
    } catch (e) {
      // Malformed JSON — discard
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        // ignore
      }
      return null;
    }
  }

  /**
   * No-op — included for consistent lifecycle interface.
   */
  destroy() {}
}
