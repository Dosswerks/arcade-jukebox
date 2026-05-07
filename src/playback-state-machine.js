/**
 * Playback State Machine
 * Determines what happens when a track ends.
 *
 * Mode precedence: Loop One > Loop All > Play Through > Stop
 * Shuffle is orthogonal — it affects index resolution but not mode logic.
 */

export class PlaybackStateMachine {
  constructor() {
    this._mode = 'play-through'; // default mode
  }

  /**
   * Set the active playback mode.
   * @param {'loop-one' | 'loop-all' | 'play-through' | 'stop'} mode
   */
  setMode(mode) {
    this._mode = mode;
  }

  /**
   * Get the current playback mode.
   * @returns {'loop-one' | 'loop-all' | 'play-through' | 'stop'}
   */
  getMode() {
    return this._mode;
  }

  /**
   * Determine the action to take when a track ends.
   *
   * @param {number} currentIndex - Index of the track that just finished
   * @param {number} totalTracks - Total number of tracks in the playlist
   * @param {object} [shuffleEngine] - Optional ShuffleEngine for index resolution
   * @returns {{ action: 'play', index: number } | { action: 'stop' }}
   */
  onTrackEnd(currentIndex, totalTracks, shuffleEngine) {
    if (totalTracks <= 0) {
      return { action: 'stop' };
    }

    // Loop One: always restart the same track (highest precedence)
    if (this._mode === 'loop-one') {
      return { action: 'play', index: currentIndex };
    }

    // Stop mode: always stop
    if (this._mode === 'stop') {
      return { action: 'stop' };
    }

    // For Loop All and Play Through, determine the next index
    let nextIndex;

    if (shuffleEngine) {
      // In shuffle mode, advance through the shuffled order
      const currentPosition = shuffleEngine.getPositionOf(currentIndex);
      const nextPosition = currentPosition + 1;

      if (nextPosition >= shuffleEngine.getLength()) {
        // Reached end of shuffled order
        if (this._mode === 'loop-all') {
          // Reshuffle and start from position 0
          shuffleEngine.reshuffle();
          nextIndex = shuffleEngine.getTrackAt(0);
        } else {
          // Play Through: stop at end
          return { action: 'stop' };
        }
      } else {
        nextIndex = shuffleEngine.getTrackAt(nextPosition);
      }
    } else {
      // Sequential mode
      nextIndex = currentIndex + 1;

      if (nextIndex >= totalTracks) {
        if (this._mode === 'loop-all') {
          nextIndex = 0; // Wrap to beginning
        } else {
          // Play Through: stop at end
          return { action: 'stop' };
        }
      }
    }

    return { action: 'play', index: nextIndex };
  }
}
