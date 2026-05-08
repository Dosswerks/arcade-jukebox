/**
 * UI Controller
 * Coordinates DOM updates: progress bar, time display, active track highlight,
 * now-playing title, loading/buffering states, error notifications (toast).
 */

import { formatTime } from './time-formatter.js';

export class UIController {
  /**
   * @param {object} elements - UIElements references
   */
  constructor(elements) {
    this._el = elements;
    this._toastTimeout = null;
  }

  /**
   * Update progress bar and time displays.
   * @param {number} elapsed - Current time in seconds
   * @param {number} duration - Total duration in seconds
   */
  updateProgress(elapsed, duration) {
    const fraction = duration > 0 ? elapsed / duration : 0;

    if (this._el.progressFill) {
      this._el.progressFill.style.width = `${fraction * 100}%`;
    }
    if (this._el.elapsedTime) {
      this._el.elapsedTime.textContent = formatTime(elapsed);
    }
    if (this._el.totalTime) {
      this._el.totalTime.textContent = formatTime(duration);
    }
  }

  /**
   * Update the now-playing title display.
   * @param {string} title
   */
  setNowPlaying(title) {
    if (this._el.nowPlayingTitle) {
      this._el.nowPlayingTitle.textContent = title;
    }
  }

  /**
   * Show loading overlay.
   */
  showLoading() {
    if (this._el.loadingOverlay) {
      this._el.loadingOverlay.classList.add('visible');
      this._el.loadingOverlay.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Hide loading overlay.
   */
  hideLoading() {
    if (this._el.loadingOverlay) {
      this._el.loadingOverlay.classList.remove('visible');
      this._el.loadingOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Show buffering indicator on progress bar.
   */
  showBuffering() {
    if (this._el.progressBar) {
      this._el.progressBar.classList.add('buffering');
    }
  }

  /**
   * Hide buffering indicator.
   */
  hideBuffering() {
    if (this._el.progressBar) {
      this._el.progressBar.classList.remove('buffering');
    }
  }

  /**
   * Show a toast notification (single-slot, 3s duration).
   * @param {string} message
   * @param {'error'|'info'} [type='info']
   */
  showError(message, type = 'error') {
    if (!this._el.toastContainer) return;

    // Clear existing toast
    if (this._toastTimeout) {
      clearTimeout(this._toastTimeout);
    }

    this._el.toastContainer.textContent = message;
    this._el.toastContainer.setAttribute('role', 'alert');
    this._el.toastContainer.setAttribute(
      'aria-live',
      type === 'error' ? 'assertive' : 'polite'
    );
    this._el.toastContainer.classList.add('visible');

    // Auto-dismiss after 3 seconds
    this._toastTimeout = setTimeout(() => {
      this._el.toastContainer.classList.remove('visible');
    }, 3000);
  }

  /**
   * Show empty library message.
   */
  showEmptyLibrary() {
    if (this._el.songListContainer) {
      this._el.songListContainer.innerHTML = '';
      const msg = document.createElement('div');
      msg.classList.add('empty-library');
      msg.textContent = 'Empty Library — no tracks available';
      msg.setAttribute('role', 'status');
      this._el.songListContainer.appendChild(msg);
    }
  }

  /**
   * Update play/pause button state.
   * @param {boolean} isPlaying
   */
  setPlayButtonState(isPlaying) {
    if (this._el.playPauseBtn) {
      this._el.playPauseBtn.setAttribute(
        'aria-label',
        isPlaying ? 'Pause' : 'Play'
      );
    }
  }

  /**
   * Update loop button state.
   * @param {string} mode - 'loop-one' | 'loop-all' | 'play-through' | 'stop'
   */
  setLoopButtonState(mode) {
    if (this._el.loopBtn) {
      this._el.loopBtn.setAttribute('aria-label', `Playback mode: ${mode}`);
      this._el.loopBtn.classList.toggle('active', mode === 'loop-one' || mode === 'loop-all');

      // Update the loop icon SVG to indicate mode
      const svg = this._el.loopBtn.querySelector('.icon-loop');
      if (svg && mode === 'loop-one') {
        // Add a "1" indicator for loop-one
        let oneText = svg.querySelector('.loop-one-indicator');
        if (!oneText) {
          oneText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          oneText.classList.add('loop-one-indicator');
          oneText.setAttribute('x', '12');
          oneText.setAttribute('y', '15');
          oneText.setAttribute('text-anchor', 'middle');
          oneText.setAttribute('font-size', '8');
          oneText.setAttribute('font-weight', 'bold');
          oneText.setAttribute('fill', 'currentColor');
          oneText.setAttribute('stroke', 'none');
          oneText.textContent = '1';
          svg.appendChild(oneText);
        }
        oneText.style.display = '';
      } else if (svg) {
        const oneText = svg.querySelector('.loop-one-indicator');
        if (oneText) oneText.style.display = 'none';
      }
    }
  }

  /**
   * Update shuffle button state.
   * @param {boolean} enabled
   */
  setShuffleButtonState(enabled) {
    if (this._el.shuffleBtn) {
      this._el.shuffleBtn.classList.toggle('active', enabled);
      this._el.shuffleBtn.setAttribute(
        'aria-label',
        enabled ? 'Shuffle: on' : 'Shuffle: off'
      );
    }
  }

  /**
   * Remove all event listeners, nullify DOM references.
   */
  destroy() {
    if (this._toastTimeout) {
      clearTimeout(this._toastTimeout);
    }
    this._el = {};
  }
}
