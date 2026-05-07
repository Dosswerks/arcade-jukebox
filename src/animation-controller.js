/**
 * Animation Controller
 * Manages CSS animation states (vinyl spin, bubble tubes).
 * Respects prefers-reduced-motion and Page Visibility API.
 */

export class AnimationController {
  constructor() {
    this._vinylElement = null;
    this._bubbleElements = [];
    this._reducedMotion = false;
    this._paused = false;
    this._vinylSpinning = false;

    // Detect reduced motion preference
    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reducedMotion = this._motionQuery.matches;

    // Listen for runtime changes
    this._motionHandler = (e) => {
      this._reducedMotion = e.matches;
      this._applyState();
    };
    this._motionQuery.addEventListener('change', this._motionHandler);
  }

  /**
   * Set DOM element references for animations.
   * @param {HTMLElement} vinyl - The vinyl record element
   * @param {HTMLElement[]} bubbles - Bubble tube container elements
   */
  setElements(vinyl, bubbles) {
    this._vinylElement = vinyl;
    this._bubbleElements = bubbles || [];
    this._applyState();
  }

  /**
   * Pause all animations (tab hidden).
   */
  pause() {
    this._paused = true;
    this._applyState();
  }

  /**
   * Resume animations (tab visible and motion allowed).
   */
  resume() {
    this._paused = false;
    this._applyState();
  }

  /**
   * Set vinyl spin state based on playback.
   * @param {boolean} spinning
   */
  setVinylSpinning(spinning) {
    this._vinylSpinning = spinning;
    this._applyState();
  }

  /**
   * Check if reduced motion is preferred.
   * @returns {boolean}
   */
  isReducedMotion() {
    return this._reducedMotion;
  }

  /**
   * Remove event listeners, clear references.
   */
  destroy() {
    this._motionQuery.removeEventListener('change', this._motionHandler);
    this._vinylElement = null;
    this._bubbleElements = [];
  }

  /**
   * Apply the current animation state to DOM elements.
   * @private
   */
  _applyState() {
    const shouldAnimate = !this._reducedMotion && !this._paused;

    // Vinyl spin
    if (this._vinylElement) {
      if (shouldAnimate && this._vinylSpinning) {
        this._vinylElement.style.animationPlayState = 'running';
      } else {
        this._vinylElement.style.animationPlayState = 'paused';
      }
    }

    // Bubble tubes
    this._bubbleElements.forEach((el) => {
      if (shouldAnimate) {
        el.style.animationPlayState = 'running';
      } else {
        el.style.animationPlayState = 'paused';
      }
    });
  }
}
