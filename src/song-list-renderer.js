/**
 * Song List Renderer
 * Renders TrackInfo array into DOM container with full accessibility semantics.
 * Uses textContent for all user-derived text (XSS prevention).
 */

export class SongListRenderer {
  /**
   * @param {HTMLElement} container - DOM element for the song list
   * @param {HTMLElement} liveRegion - aria-live region for announcements
   * @param {function} onTrackSelect - Callback when user selects a track (index)
   */
  constructor(container, liveRegion, onTrackSelect) {
    this._container = container;
    this._liveRegion = liveRegion;
    this._onTrackSelect = onTrackSelect;
    this._tracks = [];
    this._activeIndex = -1;
    this._selectedIndex = -1;

    // Set up container accessibility
    this._container.setAttribute('role', 'listbox');
    this._container.setAttribute('aria-label', 'Song list');
  }

  /**
   * Render the full song list.
   * @param {Array<{title: string, filename: string}>} tracks
   */
  render(tracks) {
    this._tracks = tracks;
    this._container.innerHTML = '';

    tracks.forEach((track, index) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      item.setAttribute('data-index', index);
      item.classList.add('song-item');

      // Track number
      const numSpan = document.createElement('span');
      numSpan.classList.add('song-number');
      numSpan.textContent = String(index + 1).padStart(2, '0');

      // Track title (safe text content)
      const titleSpan = document.createElement('span');
      titleSpan.classList.add('song-title');
      titleSpan.textContent = track.title;

      item.appendChild(numSpan);
      item.appendChild(titleSpan);

      // Click/tap handler
      item.addEventListener('click', () => {
        this._onTrackSelect(index);
      });

      this._container.appendChild(item);
    });
  }

  /**
   * Update the active (playing) track highlight.
   * @param {number} index - Index of currently playing track (-1 for none)
   */
  setActiveTrack(index) {
    // Remove previous active
    if (this._activeIndex >= 0) {
      const prev = this._container.querySelector(`[data-index="${this._activeIndex}"]`);
      if (prev) {
        prev.classList.remove('song-item--active');
        prev.removeAttribute('aria-current');
      }
    }

    this._activeIndex = index;

    // Set new active
    if (index >= 0) {
      const current = this._container.querySelector(`[data-index="${index}"]`);
      if (current) {
        current.classList.add('song-item--active');
        current.setAttribute('aria-current', 'true');
        // Scroll into view if needed
        current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      // Announce to screen readers
      if (this._liveRegion && this._tracks[index]) {
        this._liveRegion.textContent = `Now playing: ${this._tracks[index].title}`;
      }
    }
  }

  /**
   * Update the selected (keyboard-focused) track.
   * @param {number} index - Index of focused track (-1 for none)
   */
  setSelectedTrack(index) {
    // Remove previous selection
    if (this._selectedIndex >= 0) {
      const prev = this._container.querySelector(`[data-index="${this._selectedIndex}"]`);
      if (prev) {
        prev.classList.remove('song-item--selected');
        prev.removeAttribute('aria-selected');
        prev.setAttribute('tabindex', '-1');
      }
    }

    this._selectedIndex = index;

    // Set new selection
    if (index >= 0) {
      const current = this._container.querySelector(`[data-index="${index}"]`);
      if (current) {
        current.classList.add('song-item--selected');
        current.setAttribute('aria-selected', 'true');
        current.setAttribute('tabindex', '0');
        current.focus();
      }
    }
  }

  /**
   * Get the number of rendered tracks.
   * @returns {number}
   */
  getTrackCount() {
    return this._tracks.length;
  }
}
