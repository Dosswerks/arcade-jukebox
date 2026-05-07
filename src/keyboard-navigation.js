/**
 * Keyboard Navigation
 * Implements full keyboard support for the jukebox interface.
 *
 * Focus order: Play/Pause → Skip Back → Skip Forward → Volume → Mute → Loop → Shuffle → Song List
 * Song list: Arrow Up/Down moves focus, Enter/Space plays, Home/End jumps
 * Escape: return focus to play button
 */

function setupKeyboardNavigation(ui, playerEngine, songListRenderer, tracks) {
  const songList = ui.songListContainer;
  let focusedSongIndex = 0;

  // Song list keyboard handler
  songList.addEventListener('keydown', (e) => {
    const items = songList.querySelectorAll('[role="option"]');
    if (items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusedSongIndex = Math.min(focusedSongIndex + 1, items.length - 1);
        songListRenderer.setSelectedTrack(focusedSongIndex);
        playerEngine.setSelectedIndex(focusedSongIndex);
        break;

      case 'ArrowUp':
        e.preventDefault();
        focusedSongIndex = Math.max(focusedSongIndex - 1, 0);
        songListRenderer.setSelectedTrack(focusedSongIndex);
        playerEngine.setSelectedIndex(focusedSongIndex);
        break;

      case 'Home':
        e.preventDefault();
        focusedSongIndex = 0;
        songListRenderer.setSelectedTrack(focusedSongIndex);
        playerEngine.setSelectedIndex(focusedSongIndex);
        break;

      case 'End':
        e.preventDefault();
        focusedSongIndex = items.length - 1;
        songListRenderer.setSelectedTrack(focusedSongIndex);
        playerEngine.setSelectedIndex(focusedSongIndex);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        playerEngine.play(focusedSongIndex);
        break;
    }
  });

  // Volume slider keyboard (5% increments handled natively by range input)
  // Just ensure aria-valuenow stays in sync
  if (ui.volumeSlider) {
    ui.volumeSlider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Let native range handle it, then sync
        setTimeout(() => {
          playerEngine.setVolume(parseInt(ui.volumeSlider.value) / 100);
        }, 0);
      }
    });
  }

  // Global Escape handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ui.playPauseBtn) {
        ui.playPauseBtn.focus();
      }
    }
  });
}
