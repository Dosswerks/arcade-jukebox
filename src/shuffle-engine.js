/**
 * Shuffle Engine (Fisher-Yates)
 * Generates and manages a pre-shuffled index array.
 * Supports deterministic forward/backward navigation within the shuffled order.
 */

export class ShuffleEngine {
  /**
   * @param {number} trackCount - Total number of tracks to shuffle
   */
  constructor(trackCount) {
    this._trackCount = trackCount;
    this._order = [];
    this.reshuffle();
  }

  /**
   * Generates a new shuffled order using Fisher-Yates algorithm.
   */
  reshuffle() {
    this._order = Array.from({ length: this._trackCount }, (_, i) => i);
    for (let i = this._trackCount - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._order[i], this._order[j]] = [this._order[j], this._order[i]];
    }
  }

  /**
   * Returns the track index at the given position in shuffled order.
   * @param {number} position - Position in the shuffled sequence (0-based)
   * @returns {number} Track index at that position
   */
  getTrackAt(position) {
    if (position < 0 || position >= this._trackCount) {
      return -1;
    }
    return this._order[position];
  }

  /**
   * Returns the shuffled position for a given track index.
   * @param {number} trackIndex - Original track index
   * @returns {number} Position in the shuffled order (-1 if not found)
   */
  getPositionOf(trackIndex) {
    return this._order.indexOf(trackIndex);
  }

  /**
   * Returns total number of tracks.
   * @returns {number}
   */
  getLength() {
    return this._trackCount;
  }

  /**
   * Returns the full shuffled index array (for testing/debugging).
   * @returns {number[]}
   */
  getOrder() {
    return [...this._order];
  }
}
