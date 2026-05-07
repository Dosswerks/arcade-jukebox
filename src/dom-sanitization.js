/**
 * DOM Sanitization
 * Safely renders text content into the DOM without HTML injection risk.
 *
 * Uses textContent assignment pattern — never innerHTML with user data.
 * Handles filenames containing special characters (angle brackets,
 * ampersands, quotes) without rendering errors.
 *
 * @param {string} text - Raw text to render safely
 * @returns {HTMLSpanElement} A span element with the text as textContent
 */
export function escapeForDOM(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

/**
 * Sets text content on an existing element safely.
 * @param {HTMLElement} element - Target DOM element
 * @param {string} text - Raw text to set
 */
export function setTextSafe(element, text) {
  element.textContent = text;
}
