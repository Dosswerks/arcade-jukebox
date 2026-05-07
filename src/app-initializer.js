/**
 * App Initializer
 * Entry point. Orchestrates startup sequence.
 */

// When used in build (concatenated), these are all in the same IIFE scope.
// During development with ES modules, they would be imported.

async function initApp() {
  const ui = getUIElements();

  // Show loading state
  if (ui.loadingOverlay) {
    ui.loadingOverlay.classList.add('visible');
    ui.loadingOverlay.setAttribute('aria-hidden', 'false');
  }

  // Check for TRACKS global
  if (typeof window.TRACKS === 'undefined' || !Array.isArray(window.TRACKS)) {
    showFatalError(ui, 'Music library could not be loaded');
    return;
  }

  if (window.TRACKS.length === 0) {
    hidLoading(ui);
    showEmptyLibrary(ui);
    return;
  }

  // Parse URL query parameters
  const params = parseQueryParams();

  // Process manifest (ID3 + title derivation + sort)
  let tracks;
  try {
    tracks = await processManifest(window.TRACKS);
  } catch (e) {
    showFatalError(ui, 'Failed to process music library');
    return;
  }

  // Apply game prefix filter
  if (params.game) {
    tracks = filterByGamePrefix(tracks, params.game);
  }

  // Store references
  const state = {
    masterPlaylist: tracks,
    filteredPlaylist: tracks,
  };

  // Create controllers
  const songListRenderer = new SongListRenderer(
    ui.songListContainer,
    ui.srAnnouncements,
    (index) => playerEngine.play(index)
  );

  const playerEngine = new PlayerEngine(tracks, { gainNormalization: true });
  const animController = new AnimationController();
  const uiController = new UIController(ui);

  // Set up animation elements
  const bubbleElements = [];
  document.querySelectorAll('.bubble').forEach((el) => bubbleElements.push(el));
  animController.setElements(ui.vinylRecord, bubbleElements);

  // Visibility controller
  const visController = new VisibilityController({
    onHidden: () => {
      animController.pause();
    },
    onVisible: () => {
      animController.resume();
      // Resync progress bar
      const progress = playerEngine.getProgress();
      uiController.updateProgress(progress.elapsed, progress.duration);
    },
  });

  // Render song list
  songListRenderer.render(tracks);

  // Generate bubble elements
  generateBubbles();

  // Restore persisted state
  const playerState = playerEngine.getState();
  uiController.setLoopButtonState(playerState.mode);
  uiController.setShuffleButtonState(playerState.shuffleEnabled);
  if (ui.volumeSlider) {
    ui.volumeSlider.value = String(playerState.volume * 100);
  }

  // If ?track= param, auto-select
  if (params.track) {
    const trackIdx = tracks.findIndex((t) => t.filename === params.track);
    if (trackIdx >= 0) {
      songListRenderer.setSelectedTrack(trackIdx);
      playerEngine.setSelectedIndex(trackIdx);
    }
  } else if (playerState.selectedTrackIndex >= 0) {
    songListRenderer.setSelectedTrack(playerState.selectedTrackIndex);
  }

  // Wire up Player Engine events
  playerEngine.on('play', () => {
    animController.setVinylSpinning(true);
    uiController.setPlayButtonState(true);
  });

  playerEngine.on('pause', () => {
    animController.setVinylSpinning(false);
    uiController.setPlayButtonState(false);
  });

  playerEngine.on('stop', () => {
    animController.setVinylSpinning(false);
    uiController.setPlayButtonState(false);
    uiController.updateProgress(0, 0);
    uiController.setNowPlaying('Select a track...');
  });

  playerEngine.on('trackChange', (data) => {
    songListRenderer.setActiveTrack(data.index);
    uiController.setNowPlaying(data.track.title);
  });

  playerEngine.on('progress', (data) => {
    uiController.updateProgress(data.elapsed, data.duration);
  });

  playerEngine.on('bufferingStart', () => {
    uiController.showBuffering();
  });

  playerEngine.on('bufferingEnd', () => {
    uiController.hideBuffering();
  });

  playerEngine.on('error', () => {
    uiController.showError('Track unavailable, skipping...');
  });

  playerEngine.on('modeChange', (data) => {
    uiController.setLoopButtonState(data.mode);
  });

  playerEngine.on('shuffleChange', (data) => {
    uiController.setShuffleButtonState(data.enabled);
  });

  // Wire up transport controls
  ui.playPauseBtn.addEventListener('click', () => {
    const s = playerEngine.getState();
    if (s.status === 'playing') {
      playerEngine.pause();
    } else if (s.status === 'paused') {
      playerEngine.resume();
    } else {
      // Start from selected or first track
      const idx = s.selectedTrackIndex >= 0 ? s.selectedTrackIndex : 0;
      playerEngine.play(idx);
    }
  });

  ui.skipForwardBtn.addEventListener('click', () => playerEngine.skipForward());
  ui.skipBackBtn.addEventListener('click', () => playerEngine.skipBack());

  // Loop button cycles: play-through → loop-all → loop-one → play-through
  const modes = ['play-through', 'loop-all', 'loop-one'];
  ui.loopBtn.addEventListener('click', () => {
    const current = playerEngine.getState().mode;
    const idx = modes.indexOf(current);
    const next = modes[(idx + 1) % modes.length];
    playerEngine.setMode(next);
  });

  // Shuffle toggle
  ui.shuffleBtn.addEventListener('click', () => {
    const s = playerEngine.getState();
    playerEngine.setShuffle(!s.shuffleEnabled);
  });

  // Volume slider
  ui.volumeSlider.addEventListener('input', (e) => {
    playerEngine.setVolume(parseInt(e.target.value) / 100);
  });

  // Mute button
  ui.muteBtn.addEventListener('click', () => {
    const s = playerEngine.getState();
    playerEngine.setMute(!s.muted);
    ui.muteBtn.textContent = s.muted ? '🔊' : '🔇';
    ui.muteBtn.classList.toggle('muted', !s.muted);
  });

  // Progress bar scrub
  let isScrubbing = false;
  const progressBar = ui.progressBar;

  function handleScrub(e) {
    const rect = progressBar.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    playerEngine.seekTo(fraction);
  }

  progressBar.addEventListener('pointerdown', (e) => {
    isScrubbing = true;
    handleScrub(e);
    progressBar.setPointerCapture(e.pointerId);
  });

  progressBar.addEventListener('pointermove', (e) => {
    if (isScrubbing) handleScrub(e);
  });

  progressBar.addEventListener('pointerup', () => {
    isScrubbing = false;
  });

  // Set up keyboard navigation
  setupKeyboardNavigation(ui, playerEngine, songListRenderer, tracks);

  // Hide loading
  hidLoading(ui);
}

function getUIElements() {
  return {
    songListContainer: document.getElementById('song-list'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    elapsedTime: document.getElementById('elapsed-time'),
    totalTime: document.getElementById('total-time'),
    nowPlayingTitle: document.getElementById('now-playing'),
    vinylRecord: document.getElementById('vinyl'),
    playPauseBtn: document.getElementById('btn-play'),
    skipForwardBtn: document.getElementById('btn-next'),
    skipBackBtn: document.getElementById('btn-prev'),
    volumeSlider: document.getElementById('volume-slider'),
    muteBtn: document.getElementById('btn-mute'),
    loopBtn: document.getElementById('btn-loop'),
    shuffleBtn: document.getElementById('btn-shuffle'),
    loadingOverlay: document.getElementById('loading-overlay'),
    toastContainer: document.getElementById('toast'),
    srAnnouncements: document.getElementById('sr-announcements'),
  };
}

function showFatalError(ui, message) {
  hidLoading(ui);
  if (ui.songListContainer) {
    ui.songListContainer.innerHTML = '';
    const msg = document.createElement('div');
    msg.classList.add('empty-library');
    msg.textContent = message;
    msg.setAttribute('role', 'alert');
    ui.songListContainer.appendChild(msg);
  }
}

function showEmptyLibrary(ui) {
  if (ui.songListContainer) {
    ui.songListContainer.innerHTML = '';
    const msg = document.createElement('div');
    msg.classList.add('empty-library');
    msg.textContent = 'Empty Library — no tracks available';
    msg.setAttribute('role', 'status');
    ui.songListContainer.appendChild(msg);
  }
}

function hidLoading(ui) {
  if (ui.loadingOverlay) {
    ui.loadingOverlay.classList.remove('visible');
    ui.loadingOverlay.setAttribute('aria-hidden', 'true');
  }
}

function generateBubbles() {
  const colors = ['#ff8c00', '#ffaa00', '#ff1493', '#00bfff', '#39ff14', '#9b59b6'];
  const tubes = [document.getElementById('bubble-left'), document.getElementById('bubble-right')];

  tubes.forEach((tube) => {
    if (!tube) return;
    for (let i = 0; i < 8; i++) {
      const bubble = document.createElement('div');
      bubble.classList.add('bubble');
      const size = 4 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const duration = 6 + Math.random() * 8;
      const delay = Math.random() * duration;
      const left = Math.random() * 20;

      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${left}px`;
      bubble.style.background = color;
      bubble.style.boxShadow = `0 0 ${size}px ${color}44`;
      bubble.style.animationDuration = `${duration}s`;
      bubble.style.animationDelay = `-${delay}s`;

      tube.appendChild(bubble);
    }
  });
}

// Boot on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);
