/**
 * Visibility Controller
 * Observes Page Visibility API and dispatches pause/resume signals.
 *
 * Design note: When tab is backgrounded, audio CONTINUES but animations PAUSE.
 * This asymmetry is intentional — audio is the primary function, animations are
 * decorative and consume GPU/battery.
 */

export class VisibilityController {
  /**
   * @param {object} callbacks
   * @param {function} callbacks.onHidden - Called when tab becomes hidden
   * @param {function} callbacks.onVisible - Called when tab becomes visible
   */
  constructor(callbacks) {
    this._callbacks = callbacks;
    this._handler = () => {
      if (document.visibilityState === 'hidden') {
        this._callbacks.onHidden();
      } else {
        this._callbacks.onVisible();
      }
    };
    document.addEventListener('visibilitychange', this._handler);
  }

  /**
   * Remove visibilitychange event listener.
   */
  destroy() {
    document.removeEventListener('visibilitychange', this._handler);
  }
}
