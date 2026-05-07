/**
 * Touch Handler
 * Implements touch interaction refinements for mobile UX.
 *
 * - Drag threshold: 10px before recognizing as scroll
 * - Tap detection: fire only if movement < 10px from touchstart
 * - Progress bar scrub uses requestAnimationFrame during active scrub
 * - Passive listeners except on progress bar
 */

// Touch handling is integrated into the app-initializer's event setup.
// This module provides utility functions for touch gesture detection.

const DRAG_THRESHOLD = 10;

/**
 * Creates a tap detector that distinguishes taps from scrolls.
 * @param {HTMLElement} element
 * @param {function} onTap - Called with the event when a tap is detected
 */
function setupTapDetection(element, onTap) {
  let startX = 0;
  let startY = 0;
  let moved = false;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      moved = true;
    }
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    if (!moved) {
      onTap(e);
    }
  }, { passive: true });
}
