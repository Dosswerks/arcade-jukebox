/**
 * URL Parser
 * Parses deep-link query parameters from the current URL.
 *
 * Supports:
 *   ?track=<filename>  - Auto-select a specific track
 *   ?game=<game-name>  - Filter song list by game prefix
 *
 * @returns {{ track: string | null, game: string | null }}
 */
export function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    track: params.get('track') || null,
    game: params.get('game') || null,
  };
}
